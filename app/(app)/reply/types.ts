// Plain data + types — safe to import from both server and client.
// (no "server-only" or "use server" directive)

export const INTENTS = [
  "ถามราคา",
  "ขอโปร",
  "ลังเล",
  "พร้อมซื้อ",
  "ขอวิธีใช้",
  "เปรียบเทียบ",
  "กังวลความน่าเชื่อถือ",
  "อื่นๆ",
] as const;
export type Intent = (typeof INTENTS)[number];

export type RiskLevel = "low" | "medium" | "high";

export type BulkReplyItem = {
  customer_message: string;
  intent: Intent;
  sales_note: string;
  short_reply: string;
  polite_reply: string;
  closing_reply: string;
  risk_level: RiskLevel;
  should_handoff: boolean;
};

export const REPLY_GOALS = [
  { value: "info", label: "ตอบข้อมูล" },
  { value: "close", label: "ปิดการขาย" },
  { value: "recommend", label: "แนะนำสินค้า" },
  { value: "objection", label: "แก้ข้อโต้แย้ง" },
  { value: "follow-up", label: "ติดตามลูกค้า" },
  { value: "polite", label: "ตอบแบบสุภาพทั่วไป" },
] as const;
export type ReplyGoal = (typeof REPLY_GOALS)[number]["value"];

export const MAX_MESSAGES_PER_BATCH = 10;

/**
 * Split raw paste into customer messages.
 * Heuristics, in order:
 *   1. ≥60% of non-empty lines start with "- " or "1." / "1)"  →  one msg per bulleted line
 *   2. blank-line separated paragraphs                          →  one msg per paragraph
 *   3. otherwise                                                →  single message (entire text)
 *
 * Always trims, drops empties, caps at MAX_MESSAGES_PER_BATCH.
 */
export function splitCustomerMessages(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const bulletPattern = /^(?:-|\d+[.)])\s+/;
  const lines = text.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const bullets = nonEmpty.filter((l) => bulletPattern.test(l));

  if (
    bullets.length >= 2 &&
    bullets.length >= Math.ceil(nonEmpty.length * 0.6)
  ) {
    return nonEmpty
      .map((l) => l.replace(bulletPattern, "").trim())
      .filter(Boolean)
      .slice(0, MAX_MESSAGES_PER_BATCH);
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.slice(0, MAX_MESSAGES_PER_BATCH);
  }

  return [text];
}
