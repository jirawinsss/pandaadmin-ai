import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set in .env.local — get a key from https://console.anthropic.com",
      );
    }
    cached = new Anthropic();
  }
  return cached;
}

export const REPLY_MODEL = "claude-sonnet-4-6";
