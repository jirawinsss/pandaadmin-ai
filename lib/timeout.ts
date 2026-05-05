import "server-only";

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Race a promise against a deadline. If the promise doesn't settle within
 * `ms`, throws TimeoutError. The timer is always cleared in `finally` so
 * we don't leak handles.
 *
 * Use this around any external call that could hang the request handler
 * (Supabase, LINE Messaging API, Anthropic). Webhook critical-path callers
 * should use a short budget (≤5s); background workers can use longer.
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
