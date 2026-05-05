import "server-only";

/**
 * Send a text reply to LINE using the one-shot replyToken from the webhook
 * event. The token is valid for ~1 minute and can only be used once — do
 * NOT retry on failure with the same token; fall back to draft mode instead.
 */
export async function lineReplyText(opts: {
  channelAccessToken: string;
  replyToken: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!opts.replyToken) return { ok: false, error: "missing replyToken" };
  if (!opts.text.trim()) return { ok: false, error: "empty text" };

  // 5s hard timeout via AbortSignal — a wedged TCP connection to LINE
  // would otherwise hold the queue slot for the SDK default (~minutes)
  // and starve the next AI job.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken: opts.replyToken,
        messages: [{ type: "text", text: opts.text }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `LINE ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "LINE reply timed out after 5s" };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}
