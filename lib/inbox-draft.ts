import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";

import { getAnthropic, REPLY_MODEL } from "@/lib/anthropic";
import { buildInboxDraftSystemPrompt } from "@/lib/ai-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  INTENTS,
  type Intent,
  type RiskLevel,
} from "@/app/(app)/reply/types";
import type {
  StoreRow,
  ProductRow,
  FaqRow,
} from "@/lib/store";

const InboxDraftSchema = z.object({
  ai_draft: z.string(),
  intent: z.enum(INTENTS),
  risk_level: z.enum(["low", "medium", "high"]),
  should_handoff: z.boolean(),
});

export type InboxDraft = {
  ai_draft: string;
  intent: Intent;
  risk_level: RiskLevel;
  should_handoff: boolean;
};

export type ConversationTurn = {
  role: "customer" | "merchant";
  text: string;
};

const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 1200;

function buildHistoryBlock(turns: ConversationTurn[]): string {
  // Take the most recent turns up to the cap, oldest-first when rendered
  const trimmed = turns.slice(-MAX_HISTORY_TURNS);
  const lines: string[] = [];
  let chars = 0;
  for (const t of trimmed) {
    const text = t.text.length > 200 ? t.text.slice(0, 200) + "…" : t.text;
    const line =
      t.role === "customer"
        ? `ลูกค้าทักก่อนหน้านี้: "${text}"`
        : `ร้านเคยตอบไปว่า: "${text}"`;
    if (chars + line.length > MAX_HISTORY_CHARS) break;
    lines.push(line);
    chars += line.length;
  }
  return lines.join("\n");
}

/**
 * Conservative fallback when AI fails or store has no context.
 * Always handoff so the merchant doesn't accidentally send a bot apology.
 */
const HANDOFF_FALLBACK: InboxDraft = {
  ai_draft:
    "ขอบคุณที่ทักนะคะ ทางร้านจะตรวจสอบและกลับมาตอบโดยเร็วที่สุดค่ะ 🙏",
  intent: "อื่นๆ",
  risk_level: "medium",
  should_handoff: true,
};

/**
 * Generate a single AI draft for one customer message.
 * Uses the service-role admin client because the webhook is unauthenticated.
 * If the store is missing or has no products+faqs, returns HANDOFF_FALLBACK.
 *
 * `priorTurns` (optional) — recent customer↔merchant conversation history
 * for context awareness. Only sent merchant replies should be included
 * (drafts that were never sent would mislead the model).
 */
export async function generateInboxDraft(opts: {
  storeId: string;
  customerMessage: string;
  priorTurns?: ConversationTurn[];
}): Promise<InboxDraft> {
  const admin = createAdminClient();

  const [
    { data: storeRaw },
    { data: productsRaw },
    { data: faqsRaw },
  ] = await Promise.all([
    admin.from("stores").select("*").eq("id", opts.storeId).single(),
    admin.from("products").select("*").eq("store_id", opts.storeId),
    admin.from("faqs").select("*").eq("store_id", opts.storeId),
  ]);

  const store = storeRaw as StoreRow | null;
  const products = (productsRaw ?? []) as ProductRow[];
  const faqs = (faqsRaw ?? []) as FaqRow[];

  if (!store?.name?.trim()) {
    // No store context — bail to safe fallback
    return HANDOFF_FALLBACK;
  }
  if (products.length === 0 && faqs.length === 0) {
    return HANDOFF_FALLBACK;
  }

  const systemPrompt = buildInboxDraftSystemPrompt({ store, products, faqs });

  // History goes in the user content, NOT the system prompt — keeps the
  // system prompt cache-stable per store.
  const historyBlock =
    opts.priorTurns && opts.priorTurns.length > 0
      ? buildHistoryBlock(opts.priorTurns)
      : "";
  const userContent = historyBlock
    ? `[บริบทการสนทนาก่อนหน้า — ใช้ประกอบความเข้าใจ ห้ามตอบซ้ำสิ่งที่ร้านตอบไปแล้ว]\n${historyBlock}\n\n[ข้อความล่าสุดที่คุณต้องร่างคำตอบ]\n${opts.customerMessage}`
    : opts.customerMessage;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.parse({
      model: REPLY_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: {
        format: zodOutputFormat(InboxDraftSchema),
        effort: "low",
      },
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
    });

    if (!response.parsed_output) {
      console.error("[inbox-draft] no parsed_output");
      return HANDOFF_FALLBACK;
    }
    return response.parsed_output;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(
        `[inbox-draft] anthropic ${err.status}: ${err.message}`,
      );
    } else {
      console.error("[inbox-draft] error:", err);
    }
    return HANDOFF_FALLBACK;
  }
}
