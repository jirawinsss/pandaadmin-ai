import { NextRequest, NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLineSignature } from "@/lib/line";
import { generateInboxDraft, type InboxDraft } from "@/lib/inbox-draft";
import { lineReplyText } from "@/lib/line-send";
import { consumeBucket, getClientIp } from "@/lib/ratelimit";

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
 * Verifies HMAC against any enabled integration's channel_secret, then
 * SCHEDULES per-event AI drafting + auto-reply via `after()` so the response
 * returns to LINE in <100ms regardless of event count or AI latency. Without
 * this, a slow Anthropic call would tie up the Node process for 5–15s per
 * event, exhausting Hostinger / Phusion Passenger workers under load.
 *
 * Always returns 200 once the integration is identified so LINE doesn't
 * retry. Per-event errors are logged inside `after()` and swallowed.
 *
 * Rate limit: 600 req/min per IP. LINE servers share IPs across stores —
 * generous limit prevents abuse without blocking legitimate traffic.
 */
export async function POST(req: NextRequest) {
  // Rate limit by IP — generous because LINE servers are shared
  const ip = getClientIp(req.headers);
  if (!consumeBucket(`webhook:line:${ip}`, 600, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "rate limited" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

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
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  if (matched.auto_reply_mode === "off") {
    return NextResponse.json({ ok: true });
  }

  // Parse events synchronously (cheap)
  let parsed: { events?: LineEvent[] };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const events = parsed.events ?? [];

  if (events.length > 0) {
    // Schedule AI drafting + DB upsert + auto-reply AFTER the response.
    // Captured `admin` and `matched` are safe to hold across the response —
    // admin is a cached singleton, matched is a plain object.
    const integration = matched;
    after(async () => {
      for (const event of events) {
        try {
          await handleLineEvent(admin, integration, event);
        } catch (e) {
          console.error("[line webhook] event error:", e);
        }
      }
    });
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

  // Idempotent insert — unique constraint on (store_id, platform,
  // external_message_id). .select() returns the inserted row OR an empty
  // array if it was a duplicate — we use that to skip auto-reply on retries
  // (the original replyToken would already be expired).
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
  if (!rowId) return; // duplicate — already handled

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
