"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentContext,
  getStoreFaqs,
  getStoreProducts,
  type ProductRow,
} from "@/lib/store";
import { planLimits } from "@/lib/plans";
import { buildPostSystemPrompt } from "@/lib/ai-context";
import { POST_TYPES, type PostType } from "@/lib/post-types";
import { getAnthropic, REPLY_MODEL } from "@/lib/anthropic";

const VALID_POST_TYPES = new Set<string>(POST_TYPES.map((p) => p.value));

export type GeneratePostResult =
  | { ok: true; post: string; usageRemaining: number }
  | { ok: false; error: string };

export async function generatePostAction(opts: {
  productId: string;
  postType: string;
  note?: string;
}): Promise<GeneratePostResult> {
  const ctx = await getCurrentContext();
  if (!ctx) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const { productId, postType } = opts;
  const note = (opts.note ?? "").trim();

  if (!productId) return { ok: false, error: "กรุณาเลือกสินค้า" };
  if (!VALID_POST_TYPES.has(postType))
    return { ok: false, error: "ประเภทโพสต์ไม่ถูกต้อง" };
  if (note.length > 1000)
    return { ok: false, error: "บันทึกเพิ่มเติมยาวเกินไป (เกิน 1,000 ตัวอักษร)" };

  // Plan limit
  const limits = planLimits(ctx.profile.plan);
  if (ctx.profile.usage_post >= limits.post) {
    return {
      ok: false,
      error: `ใช้งานครบ ${limits.post} ครั้งของแพ็กเกจแล้ว — รอรีเซ็ตเดือนถัดไป`,
    };
  }

  // Find the product (must belong to this user's store — RLS enforces too,
  // but explicit check gives better error)
  const allProducts = await getStoreProducts(ctx.store.id);
  const product: ProductRow | undefined = allProducts.find(
    (p) => p.id === productId,
  );
  if (!product) {
    return { ok: false, error: "ไม่พบสินค้านี้ในร้านของคุณ" };
  }

  // Build prompt
  const faqs = await getStoreFaqs(ctx.store.id);
  const systemBase = buildPostSystemPrompt({
    store: ctx.store,
    faqs,
    product,
    postType: postType as PostType,
  });

  // Per-request user message — only the optional note goes here so the
  // system prompt above stays a stable cache prefix
  const userMessage = note
    ? `บันทึกเพิ่มเติมจากเจ้าของร้าน:\n${note}`
    : "สร้างโพสต์ตามบริบทข้างบน";

  // Call Claude
  let postText = "";
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: REPLY_MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: systemBase,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    for (const block of response.content) {
      if (block.type === "text") postText += block.text;
    }
    postText = postText.trim();
    if (!postText) {
      return { ok: false, error: "AI ไม่ได้สร้างโพสต์ ลองใหม่อีกครั้ง" };
    }
  } catch (err) {
    console.error("[post] anthropic error:", err);
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

  // Save and increment
  const supabase = await createClient();

  const { error: insertErr } = await supabase.from("post_history").insert({
    store_id: ctx.store.id,
    product_id: product.id,
    post_type: postType,
    content: postText,
  });
  if (insertErr) {
    console.error("[post] insert error:", insertErr);
    return { ok: false, error: "บันทึกประวัติไม่สำเร็จ" };
  }

  const newUsage = ctx.profile.usage_post + 1;
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ usage_post: newUsage })
    .eq("id", ctx.user.id);
  if (updErr) {
    console.error("[post] usage_post update error:", updErr);
  }

  revalidatePath("/post");
  revalidatePath("/dashboard");

  return {
    ok: true,
    post: postText,
    usageRemaining: Math.max(0, limits.post - newUsage),
  };
}
