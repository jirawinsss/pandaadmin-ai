import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/**
 * Cached singleton client. The default Anthropic SDK timeout is 10 minutes
 * — way too long for a webhook background worker. Cap at 25s so a wedged
 * upstream call never holds memory or blocks the event loop indefinitely.
 * Per-request callers can override this in the request options.
 */
export function getAnthropic(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set in .env.local — get a key from https://console.anthropic.com",
      );
    }
    cached = new Anthropic({
      timeout: 25_000,
      maxRetries: 1,
    });
  }
  return cached;
}

export const REPLY_MODEL = "claude-sonnet-4-6";
