import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLineSignature } from "@/lib/line";
import { generateInboxDraft, type InboxDraft } from "@/lib/inbox-draft";
import { lineReplyText } from "@/lib/line-send";

// Force Node runtime — we use crypto + the Anthropic SDK
export const runtime = "nodejs";
// Disable any caching
export const dynamic = "force-dynamic";

type LineIntegrationRow = {
  id: string;
  store_id: string;
  channel_secret: string;
  channel_access_token: string;
  is_enabled: boolean;
  auto_reply_mode: string;
  auto_reply_intents: string[] | null;
};

type LineEvent = {
  type: string;
  replyToken?: string;
  message?: { type: string; id?: string; text?: string };
  source?: { userId?: string };
  webhookEventId?: string;
};

/**
 * POST /api/webhooks/line
 *
 * Receive a LINE webhook, verify HMAC signature against ANY enabled
 * integration's channel_secret, then for each text message event generate
 * an AI draft and persist it as an inbox_messages row in 'draft' status
 * (or 'needs_human' if the AI flags it as risky).
 *
 * Always returns 200 once we've identified the integration so LINE doesn't
 * retry. Per-event errors are logged but swallowed.
 *
 * TODO: when we have many integrations, replace try-each-secret routing
 * with per-store webhook URLs (`/api/webhooks/line/[store_id]`) — store_id
 * is in `event.source` for some event types but not consistently, so the
 * cleaner fix is a unique URL per store.
 */
export async function POST(req: NextRequest) {
  // Read raw body BEFORE any parsing — required for signature verification
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing signature" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();

  // Find which integration this signature was signed with.
  const { data: integrationsRaw, error: listErr } = await admin
    .from("line_integrations")
    .select(
      "id, store_id, channel_secret, channel_access_token, is_enabled, auto_reply_mode, auto_reply_intents",
    )
    .eq("is_enabled", true);

  if (listErr) {
    console.error("[line webhook] list integrations error:", listErr.message);
    // Tell LINE OK so it doesn't retry forever — we'll catch this on our end
    return NextResponse.json({ ok: true });
  }

  const integrations = (integrationsRaw ?? []) as LineIntegrationRow[];
  if (integrations.length === 0) {
    // No active integrations — accept and move on
    return NextResponse.json({ ok: true });
  }

  let matched: LineIntegrationRow | null = null;
  for (const integ of integrations) {
    if (verifyLineSignature(rawBody, signature, integ.channel_secret)) {
      matched = integ;
      break;
    }
  }

  if (!matched) {
    // Signature didn't match any active integration.
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  // If the merchant chose 'off', acknowledge but do nothing
  if (matched.auto_reply_mode === "off") {
    return NextResponse.json({ ok: true });
  }

  // Parse events
  let parsed: { events?: LineEvent[] };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const events = parsed.events ?? [];

  // Process each event independently. Don't let one error tank the rest.
  for (const event of events) {
    try {
      await handleLineEvent(admin, matched, event);
    } catch (e) {
      console.error("[line webhook] event error:", e);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleLineEvent(
  admin: ReturnType<typeof createAdminClient>,
  integration: LineIntegrationRow,
  event: LineEvent,
) {
  // v1 supports text messages only — sticker/image/file/follow/unfollow are ignored
  if (event.type !== "message") return;
  if (event.message?.type !== "text") return;
  const messageText = event.message.text?.trim();
  if (!messageText) return;

  const externalUserId = event.source?.userId ?? null;
  const externalMessageId = event.message.id ?? null;

  const draft = await generateInboxDraft({
    storeId: integration.store_id,
    customerMessage: messageText,
  });

  const initialStatus =
    draft.should_handoff || draft.risk_level === "high"
      ? "needs_human"
      : "draft";

  // Idempotent insert — unique index on (store_id, platform, external_message_id)
  // means duplicates from LINE retries become no-ops. .select() returns the
  // inserted row OR an empty array if it was a duplicate — we use that to
  // skip auto-reply on retries (the original replyToken would be expired).
  const { data: insertedRows, error } = await admin
    .from("inbox_messages")
    .upsert(
      {
        store_id: integration.store_id,
        platform: "line",
        external_user_id: externalUserId,
        external_message_id: externalMessageId,
        message_text: messageText,
        ai_draft: draft.ai_draft,
        intent: draft.intent,
        risk_level: draft.risk_level,
        status: initialStatus,
        raw_event: event,
      },
      {
        onConflict: "store_id,platform,external_message_id",
        ignoreDuplicates: true,
      },
    )
    .select("id");

  if (error) {
    console.error("[line webhook] upsert error:", error.message);
    return;
  }

  const rowId = insertedRows?.[0]?.id;
  // Duplicate (retry) — original event already handled, skip auto-reply
  if (!rowId) return;

  // Auto-reply gate
  if (!shouldAutoReply(integration, draft)) return;

  const replyToken = event.replyToken;
  if (!replyToken) return;

  const sendRes = await lineReplyText({
    channelAccessToken: integration.channel_access_token,
    replyToken,
    text: draft.ai_draft,
  });

  if (sendRes.ok) {
    await admin
      .from("inbox_messages")
      .update({
        status: "sent",
        auto_sent: true,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);
  } else {
    console.error("[line webhook] auto-reply failed:", sendRes.error);
    await admin
      .from("inbox_messages")
      .update({
        status: "needs_human",
        send_error: sendRes.error.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);
  }
}

/**
 * Hard gate for auto-reply. Every condition must pass — fail-closed by design.
 * Risky drafts always fall back to draft mode regardless of merchant config.
 */
function shouldAutoReply(
  integration: LineIntegrationRow,
  draft: InboxDraft,
): boolean {
  if (integration.auto_reply_mode !== "auto_safe") return false;
  if (draft.should_handoff) return false;
  if (draft.risk_level !== "low") return false;
  if (!draft.ai_draft.trim()) return false;
  const whitelist = integration.auto_reply_intents ?? [];
  if (whitelist.length === 0) return false;
  if (!whitelist.includes(draft.intent)) return false;
  return true;
}
