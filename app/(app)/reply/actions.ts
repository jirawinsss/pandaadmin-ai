"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentContext,
  getStoreFaqs,
  getStoreProducts,
} from "@/lib/store";
import { planLimits } from "@/lib/plans";
import { buildBulkReplySystemPrompt } from "@/lib/ai-context";
import { getAnthropic, REPLY_MODEL } from "@/lib/anthropic";
import {
  INTENTS,
  MAX_MESSAGES_PER_BATCH,
  REPLY_GOALS,
  splitCustomerMessages,
  type BulkReplyItem,
  type ReplyGoal,
} from "./types";

// Zod schema enforced by output_config.format
const ReplyItemSchema = z.object({
  customer_message: z.string(),
  intent: z.enum(INTENTS),
  sales_note: z.string(),
  short_reply: z.string(),
  polite_reply: z.string(),
  closing_reply: z.string(),
  risk_level: z.enum(["low", "medium", "high"]),
  should_handoff: z.boolean(),
});
const BulkReplyResponseSchema = z.object({
  items: z.array(ReplyItemSchema),
});

const VALID_GOALS = new Set<string>(REPLY_GOALS.map((g) => g.value));

export type GenerateBulkResult =
  | { ok: true; items: BulkReplyItem[]; usageRemaining: number }
  | { ok: false; error: string; needsBrain?: boolean };

export async function generateBulkRepliesAction(opts: {
  rawInput: string;
  goal: string;
}): Promise<GenerateBulkResult> {
  const ctx = await getCurrentContext();
  if (!ctx) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const goal = opts.goal as ReplyGoal;
  if (!VALID_GOALS.has(goal)) {
    return { ok: false, error: "เป้าหมายการตอบไม่ถูกต้อง" };
  }
  const goalLabel =
    REPLY_GOALS.find((g) => g.value === goal)?.label ?? "ตอบข้อมูล";

  const customers = splitCustomerMessages(opts.rawInput);
  if (customers.length === 0) {
    return { ok: false, error: "กรุณาวางข้อความลูกค้าอย่างน้อย 1 รายการ" };
  }
  if (customers.length > MAX_MESSAGES_PER_BATCH) {
    return {
      ok: false,
      error: `ครั้งละไม่เกิน ${MAX_MESSAGES_PER_BATCH} รายการ — ลดจำนวนแล้วลองใหม่`,
    };
  }

  // Plan limit — 1 batch = 1 reply usage
  const limits = planLimits(ctx.profile.plan);
  if (ctx.profile.usage_reply >= limits.reply) {
    return {
      ok: false,
      error: `ใช้งานครบ ${limits.reply} ครั้งของแพ็กเกจแล้ว — รอรีเซ็ตเดือนถัดไป หรืออัปเกรดแพ็กเกจ`,
    };
  }

  // Setup gate — need name + at least some context
  if (!ctx.store.name?.trim()) {
    return {
      ok: false,
      error:
        "กรุณาตั้งชื่อร้านและกรอกข้อมูลใน 'ข้อมูลร้าน' ก่อน — AI ต้องรู้จักร้านคุณถึงจะตอบได้แม่น",
      needsBrain: true,
    };
  }

  const [products, faqs] = await Promise.all([
    getStoreProducts(ctx.store.id),
    getStoreFaqs(ctx.store.id),
  ]);

  if (products.length === 0 && faqs.length === 0) {
    return {
      ok: false,
      error:
        "ยังไม่มีสินค้าหรือ FAQ ในร้าน — เพิ่มอย่างน้อย 1 อย่างใน 'ข้อมูลร้าน' ก่อน เพื่อให้ AI ตอบได้แม่น",
      needsBrain: true,
    };
  }

  const systemPrompt = buildBulkReplySystemPrompt({
    store: ctx.store,
    products,
    faqs,
    goal,
    goalLabel,
  });

  const userMessage =
    `ข้อความลูกค้า ${customers.length} ราย — เป้าหมายการตอบ: ${goalLabel}\n\n` +
    customers
      .map((m, i) => `ลูกค้า #${i + 1}: ${m}`)
      .join("\n\n") +
    `\n\nวิเคราะห์ทีละราย ส่งกลับเป็น items[] ตามลำดับเดิม`;

  // Call Claude with structured output
  let items: BulkReplyItem[];
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.parse({
      model: REPLY_MODEL,
      max_tokens: 4096,
      thinking: { type: "disabled" },
      output_config: {
        format: zodOutputFormat(BulkReplyResponseSchema),
        effort: "low",
      },
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    if (!response.parsed_output) {
      console.error("[bulk-reply] no parsed_output", response);
      return { ok: false, error: "AI ส่งโครงสร้างผิด ลองใหม่อีกครั้ง" };
    }
    items = response.parsed_output.items;
    if (items.length === 0) {
      return { ok: false, error: "AI ไม่ได้สร้างคำตอบ ลองใหม่อีกครั้ง" };
    }
  } catch (err) {
    console.error("[bulk-reply] anthropic error:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "ระบบ AI กำลังโดนใช้หนัก ลองใหม่อีก 1 นาที" };
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        error: "ANTHROPIC_API_KEY ไม่ถูกต้อง — ตรวจสอบ .env.local",
      };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: `เรียก AI ไม่สำเร็จ (${err.status}): ${err.message}`,
      };
    }
    return { ok: false, error: "เรียก AI ไม่สำเร็จ — กรุณาลองใหม่" };
  }

  // Save batch to history (combined readable text — uses existing schema)
  const combinedCustomerMsg =
    `[${customers.length} รายการ — เป้าหมาย: ${goalLabel}]\n` +
    customers.map((m, i) => `${i + 1}. ${m}`).join("\n");

  const combinedAiReply = items
    .map((it, i) => {
      const handoff = it.should_handoff ? " [แอดมินตรวจสอบ]" : "";
      return [
        `--- ลูกค้า ${i + 1} (${it.intent}, ${it.risk_level}${handoff}) ---`,
        `📝 ${it.sales_note}`,
        `[สั้น] ${it.short_reply}`,
        `[สุภาพ] ${it.polite_reply}`,
        `[ปิดการขาย] ${it.closing_reply}`,
      ].join("\n");
    })
    .join("\n\n");

  const supabase = await createClient();
  const { error: insertErr } = await supabase.from("reply_history").insert({
    store_id: ctx.store.id,
    customer_msg: combinedCustomerMsg,
    ai_reply: combinedAiReply,
  });
  if (insertErr) {
    console.error("[bulk-reply] insert error:", insertErr);
    // Don't hard-fail — replies are useful even if history save flopped
  }

  const newUsage = ctx.profile.usage_reply + 1;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ usage_reply: newUsage })
    .eq("id", ctx.user.id);
  if (updErr) {
    console.error("[bulk-reply] usage_reply update error:", updErr);
  }

  revalidatePath("/reply");
  revalidatePath("/dashboard");

  return {
    ok: true,
    items,
    usageRemaining: Math.max(0, limits.reply - newUsage),
  };
}
