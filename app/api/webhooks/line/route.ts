import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLineSignature } from "@/lib/line";
import {
  generateInboxDraft,
  type ConversationTurn,
  type InboxDraft,
} from "@/lib/inbox-draft";
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

type PendingDraft = {
  rowId: string;
  storeId: string;
  externalUserId: string | null;
  messageText: string;
  replyToken: string | undefined;
};

/**
 * POST /api/webhooks/line
 *
 * Critical path is kept short and synchronous so Phusion Passenger workers
 * are released to handle the next request within ~200ms — regardless of
 * event count or AI latency:
 *
 *   1. Rate limit (in-memory, per IP)
 *   2. Read raw body + check signature header
 *   3. Find matching integration via HMAC verify (1 SELECT)
 *   4. Persist all incoming messages to inbox_messages with empty ai_draft
 *      (1 batch UPSERT — idempotent via the unique constraint on
 *      store_id, platform, external_message_id)
 *   5. Fire-and-forget the AI work and return 200 OK
 *
 * The AI work runs as an unawaited Promise on the Node event loop:
 *   - DOES NOT use Next.js `after()`. On Phusion Passenger / self-hosted
 *     Node, `after()` keeps the request handler "in flight" until the
 *     callback resolves, which holds the worker process busy and was the
 *     direct cause of the Max Processes 120/120 incident. A bare Promise
 *     that is never awaited continues running on the event loop after the
 *     handler returns, freeing the worker for new requests.
 *   - For each persisted row: load conversation context, generate draft,
 *     UPDATE the row, and (if eligible) send the auto-reply via LINE.
 *   - Errors are caught at every stage so AI failure NEVER affects the
 *     webhook response or crashes the process.
 *
 * Always returns 200 once we get past signature verify so LINE doesn't
 * pile up retries for our own internal failures.
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const reqId = Math.random().toString(36).slice(2, 8);

  // 1. Rate limit — generous because LINE servers share IPs across stores
  const ip = getClientIp(req.headers);
  if (!consumeBucket(`webhook:line:${ip}`, 600, 60_000)) {
    console.warn(`[line] [recv:rate-limited] req=${reqId} ip=${ip}`);
    return NextResponse.json(
      { ok: false, error: "rate limited" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  // 2. Read raw body (must come before any parsing for HMAC)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error(`[line] [recv:body-fail] req=${reqId}`, e);
    return NextResponse.json({ ok: true });
  }

  const signature = req.headers.get("x-line-signature");
  if (!signature) {
    console.warn(`[line] [sig:fail] req=${reqId} reason=missing-header`);
    return NextResponse.json(
      { ok: false, error: "missing signature" },
      { status: 401 },
    );
  }

  // 3. Find matching integration via HMAC verify
  let matched: LineIntegrationRow | null = null;
  try {
    const admin = createAdminClient();
    const { data: integrationsRaw, error: listErr } = await admin
      .from("line_integrations")
      .select(
        "id, store_id, channel_secret, channel_access_token, is_enabled, auto_reply_mode, auto_reply_intents",
      )
      .eq("is_enabled", true);

    if (listErr) {
      console.error(
        `[line] [db:list-fail] req=${reqId} error=${listErr.message}`,
      );
      // 200 so LINE doesn't retry — we'll catch this on our end via logs
      return NextResponse.json({ ok: true });
    }

    const integrations = (integrationsRaw ?? []) as LineIntegrationRow[];
    if (integrations.length === 0) {
      return NextResponse.json({ ok: true });
    }

    for (const integ of integrations) {
      if (verifyLineSignature(rawBody, signature, integ.channel_secret)) {
        matched = integ;
        break;
      }
    }
  } catch (e) {
    console.error(`[line] [db:list-throw] req=${reqId}`, e);
    return NextResponse.json({ ok: true });
  }

  if (!matched) {
    console.warn(`[line] [sig:fail] req=${reqId} reason=no-matching-secret`);
    return NextResponse.json(
      { ok: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  console.log(`[line] [sig:ok] req=${reqId} store=${matched.store_id}`);

  // 'off' mode = signal to skip everything (no persist, no AI, no reply)
  if (matched.auto_reply_mode === "off") {
    return NextResponse.json({ ok: true });
  }

  // 4. Parse events
  let parsed: { events?: LineEvent[] };
  try {
    parsed = JSON.parse(rawBody);
  } catch (e) {
    console.error(`[line] [recv:parse-fail] req=${reqId}`, e);
    return NextResponse.json({ ok: true });
  }
  const events = parsed.events ?? [];
  if (events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Filter to text messages we can actually draft for. Sticker / image /
  // file / follow / unfollow events are acknowledged but not persisted.
  const textEvents = events.filter(isProcessableTextEvent);
  if (textEvents.length === 0) {
    console.log(
      `[line] [done] req=${reqId} ms=${Date.now() - startedAt} reason=no-text events=${events.length}`,
    );
    return NextResponse.json({ ok: true });
  }

  // 5. Batch persist — single UPSERT for all events. Idempotent via the
  // unique constraint, so a LINE retry for the same event becomes a no-op
  // and won't appear in `data` (because of ignoreDuplicates: true).
  let pendingDrafts: PendingDraft[] = [];
  try {
    const admin = createAdminClient();
    const insertRows = textEvents.map((event) => ({
      store_id: matched!.store_id,
      platform: "line",
      external_user_id: event.source?.userId ?? null,
      external_message_id: event.message?.id ?? null,
      message_text: event.message!.text!.trim(),
      // ai_draft, intent, risk_level filled in by the background task
      ai_draft: null,
      intent: null,
      risk_level: "low",
      status: "draft",
      raw_event: event,
    }));

    const { data, error } = await admin
      .from("inbox_messages")
      .upsert(insertRows, {
        onConflict: "store_id,platform,external_message_id",
        ignoreDuplicates: true,
      })
      .select("id, external_message_id");

    if (error) {
      console.error(
        `[line] [db:upsert-fail] req=${reqId} error=${error.message}`,
      );
      return NextResponse.json({ ok: true });
    }

    // Map inserted rows back to the original events so we can carry the
    // replyToken and userId into the background task. Anything missing
    // from `data` is a duplicate (LINE retry) — skip it.
    const insertedById = new Map<string, string>();
    for (const r of (data ?? []) as Array<{
      id: string;
      external_message_id: string | null;
    }>) {
      if (r.external_message_id) {
        insertedById.set(r.external_message_id, r.id);
      }
    }

    pendingDrafts = textEvents
      .map((event): PendingDraft | null => {
        const extId = event.message?.id;
        if (!extId) return null;
        const rowId = insertedById.get(extId);
        if (!rowId) return null;
        return {
          rowId,
          storeId: matched!.store_id,
          externalUserId: event.source?.userId ?? null,
          messageText: event.message!.text!.trim(),
          replyToken: event.replyToken,
        };
      })
      .filter((p): p is PendingDraft => p !== null);

    console.log(
      `[line] [db:upsert-ok] req=${reqId} inserted=${pendingDrafts.length} duplicate=${textEvents.length - pendingDrafts.length}`,
    );
  } catch (e) {
    console.error(`[line] [db:upsert-throw] req=${reqId}`, e);
    return NextResponse.json({ ok: true });
  }

  // 6. Fire-and-forget AI work — DO NOT await this Promise. The handler
  // returns immediately so Phusion Passenger releases the worker; the
  // Promise continues running on Node's event loop until it resolves.
  if (pendingDrafts.length > 0) {
    const integration = matched;
    void runBackgroundDrafts(integration, pendingDrafts, reqId).catch((e) => {
      console.error(`[line] [ai:bg-throw] req=${reqId}`, e);
    });
  }

  console.log(
    `[line] [done] req=${reqId} ms=${Date.now() - startedAt} events=${textEvents.length} pending=${pendingDrafts.length}`,
  );
  return NextResponse.json({ ok: true });
}

function isProcessableTextEvent(event: LineEvent): boolean {
  if (event.type !== "message") return false;
  if (event.message?.type !== "text") return false;
  if (!event.message.text?.trim()) return false;
  return true;
}

/**
 * Background AI work — runs after the webhook has already returned 200.
 * Sequential within a single webhook batch (rare for LINE to send >1 event
 * per delivery); concurrent webhooks run their backgrounds in parallel.
 * Every operation is wrapped in try/catch so a single bad row never breaks
 * the others, and an unhandled error here can never crash the process or
 * affect future webhook responses.
 */
async function runBackgroundDrafts(
  integration: LineIntegrationRow,
  drafts: PendingDraft[],
  reqId: string,
) {
  const admin = createAdminClient();
  for (const d of drafts) {
    try {
      await processOnePending(admin, integration, d, reqId);
    } catch (e) {
      console.error(`[line] [ai:row-throw] req=${reqId} row=${d.rowId}`, e);
    }
  }
}

async function processOnePending(
  admin: ReturnType<typeof createAdminClient>,
  integration: LineIntegrationRow,
  pending: PendingDraft,
  reqId: string,
) {
  // Load prior conversation — best effort, failure is non-fatal
  let priorTurns: ConversationTurn[] = [];
  if (pending.externalUserId) {
    try {
      priorTurns = await loadPriorTurns(
        admin,
        pending.storeId,
        pending.externalUserId,
        pending.rowId,
      );
    } catch (e) {
      console.error(
        `[line] [ai:prior-fail] req=${reqId} row=${pending.rowId}`,
        e,
      );
    }
  }

  // Generate AI draft
  console.log(`[line] [ai:start] req=${reqId} row=${pending.rowId}`);
  const aiStartedAt = Date.now();
  let draft: InboxDraft;
  try {
    draft = await generateInboxDraft({
      storeId: pending.storeId,
      customerMessage: pending.messageText,
      priorTurns,
    });
  } catch (e) {
    console.error(`[line] [ai:fail] req=${reqId} row=${pending.rowId}`, e);
    // Leave row as-is so the merchant can refresh / manually reply
    return;
  }
  console.log(
    `[line] [ai:done] req=${reqId} row=${pending.rowId} intent=${draft.intent} risk=${draft.risk_level} ms=${Date.now() - aiStartedAt}`,
  );

  const initialStatus =
    draft.should_handoff || draft.risk_level === "high"
      ? "needs_human"
      : "draft";

  // Update row with the generated draft
  try {
    const { error } = await admin
      .from("inbox_messages")
      .update({
        ai_draft: draft.ai_draft,
        intent: draft.intent,
        risk_level: draft.risk_level,
        status: initialStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pending.rowId);
    if (error) {
      console.error(
        `[line] [db:draft-update-fail] req=${reqId} row=${pending.rowId} error=${error.message}`,
      );
      return;
    }
  } catch (e) {
    console.error(
      `[line] [db:draft-update-throw] req=${reqId} row=${pending.rowId}`,
      e,
    );
    return;
  }

  // Auto-reply gate — fail-closed
  if (!shouldAutoReply(integration, draft)) return;
  if (!pending.replyToken) return;

  // Try to auto-send via LINE Messaging API
  console.log(`[line] [reply:start] req=${reqId} row=${pending.rowId}`);
  let sendRes: { ok: true } | { ok: false; error: string };
  try {
    sendRes = await lineReplyText({
      channelAccessToken: integration.channel_access_token,
      replyToken: pending.replyToken,
      text: draft.ai_draft,
    });
  } catch (e) {
    console.error(`[line] [reply:throw] req=${reqId} row=${pending.rowId}`, e);
    sendRes = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    if (sendRes.ok) {
      console.log(`[line] [reply:done] req=${reqId} row=${pending.rowId}`);
      await admin
        .from("inbox_messages")
        .update({
          status: "sent",
          auto_sent: true,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.rowId);
    } else {
      console.error(
        `[line] [reply:fail] req=${reqId} row=${pending.rowId} error=${sendRes.error}`,
      );
      await admin
        .from("inbox_messages")
        .update({
          status: "needs_human",
          send_error: sendRes.error.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.rowId);
    }
  } catch (e) {
    console.error(
      `[line] [db:status-update-throw] req=${reqId} row=${pending.rowId}`,
      e,
    );
  }
}

/**
 * Pull recent customer messages + sent merchant replies for the same LINE
 * user. Drafts that weren't sent are excluded — treating them as merchant
 * replies would mislead the model. The just-inserted current row is
 * excluded so it doesn't appear as both "history" and "the message to
 * reply to".
 */
async function loadPriorTurns(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string,
  externalUserId: string,
  excludeRowId: string,
): Promise<ConversationTurn[]> {
  const { data: rows } = await admin
    .from("inbox_messages")
    .select("id, message_text, ai_draft, status")
    .eq("store_id", storeId)
    .eq("external_user_id", externalUserId)
    .order("created_at", { ascending: true })
    .limit(20);

  const turns: ConversationTurn[] = [];
  for (const r of (rows ?? []) as Array<{
    id: string;
    message_text: string;
    ai_draft: string | null;
    status: string;
  }>) {
    if (r.id === excludeRowId) continue;
    turns.push({ role: "customer", text: r.message_text });
    if (r.ai_draft && (r.status === "sent" || r.status === "copied")) {
      turns.push({ role: "merchant", text: r.ai_draft });
    }
  }
  return turns;
}

/**
 * Hard gate for auto-reply. Every condition must pass — fail-closed by
 * design. Risky drafts always fall back to draft mode regardless of
 * merchant config.
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
