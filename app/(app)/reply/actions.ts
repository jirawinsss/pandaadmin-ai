"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentContext,
  getStoreFaqs,
  getStoreProducts,
} from "@/lib/store";
import { planLimits } from "@/lib/plans";
import { buildStoreSystemPrompt } from "@/lib/ai-context";
import { getAnthropic, REPLY_MODEL } from "@/lib/anthropic";

export type GenerateReplyResult =
  | { ok: true; reply: string; usageRemaining: number }
  | { ok: false; error: string };

export async function generateReplyAction(
  customerMsg: string,
): Promise<GenerateReplyResult> {
  const ctx = await getCurrentContext();
  if (!ctx) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const message = customerMsg.trim();
  if (!message) return { ok: false, error: "กรุณาพิมพ์ข้อความลูกค้า" };
  if (message.length > 5000)
    return { ok: false, error: "ข้อความยาวเกินไป (เกิน 5,000 ตัวอักษร)" };

  // Plan limit
  const limits = planLimits(ctx.profile.plan);
  if (ctx.profile.usage_reply >= limits.reply) {
    return {
      ok: false,
      error: `ใช้งานครบ ${limits.reply} ครั้งของแพ็กเกจแล้ว — รอรีเซ็ตเดือนถัดไป หรืออัปเกรดแพ็กเกจ`,
    };
  }

  // Setup gate
  if (!ctx.store.name?.trim()) {
    return {
      ok: false,
      error: "กรุณาตั้งชื่อร้านและกรอกข้อมูลในหน้า 'ข้อมูลร้าน' ก่อน",
    };
  }

  // Build context
  const [products, faqs] = await Promise.all([
    getStoreProducts(ctx.store.id),
    getStoreFaqs(ctx.store.id),
  ]);
  const systemPrompt = buildStoreSystemPrompt({
    store: ctx.store,
    products,
    faqs,
  });

  // Call Claude
  let aiReply = "";
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: REPLY_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: message }],
    });

    for (const block of response.content) {
      if (block.type === "text") aiReply += block.text;
    }
    aiReply = aiReply.trim();

    if (!aiReply) {
      return { ok: false, error: "AI ไม่ได้สร้างคำตอบ ลองใหม่อีกครั้ง" };
    }
  } catch (err) {
    console.error("[reply] anthropic error:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "ระบบ AI กำลังโดนใช้หนัก ลองใหม่อีก 1 นาที" };
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "ANTHROPIC_API_KEY ไม่ถูกต้อง — ตรวจสอบ .env.local" };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: `เรียก AI ไม่สำเร็จ (${err.status}): ${err.message}`,
      };
    }
    return { ok: false, error: "เรียก AI ไม่สำเร็จ — กรุณาลองใหม่" };
  }

  // Save to history + increment usage
  const supabase = await createClient();

  const { error: insertErr } = await supabase.from("reply_history").insert({
    store_id: ctx.store.id,
    customer_msg: message,
    ai_reply: aiReply,
  });
  if (insertErr) {
    console.error("[reply] insert error:", insertErr);
    return { ok: false, error: "บันทึกประวัติไม่สำเร็จ" };
  }

  const newUsage = ctx.profile.usage_reply + 1;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ usage_reply: newUsage })
    .eq("id", ctx.user.id);
  if (updErr) {
    // Reply is already saved — log but don't fail user-facing
    console.error("[reply] usage_reply update error:", updErr);
  }

  revalidatePath("/reply");
  revalidatePath("/dashboard");

  return {
    ok: true,
    reply: aiReply,
    usageRemaining: Math.max(0, limits.reply - newUsage),
  };
}
