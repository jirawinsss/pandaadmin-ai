"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";
import { planLimits } from "@/lib/plans";
import { brainSchema, type BrainInput } from "./schema";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveBrainAction(raw: BrainInput): Promise<SaveResult> {
  const ctx = await getCurrentContext();
  if (!ctx) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const parsed = brainSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบฟอร์ม" };
  }
  const { store: storeFields, products, faqs } = parsed.data;

  const limits = planLimits(ctx.profile.plan);
  if (products.length > limits.products) {
    return {
      ok: false,
      error: `แพ็กเกจของคุณกำหนดสินค้าได้ไม่เกิน ${limits.products} ชิ้น`,
    };
  }

  const supabase = await createClient();
  const storeId = ctx.store.id;

  // 1. Update store fields
  {
    const { error } = await supabase
      .from("stores")
      .update({
        name: storeFields.name,
        description: storeFields.description || null,
        brand_voice: storeFields.brand_voice || null,
        voice_examples: storeFields.voice_examples || null,
        shipping_policy: storeFields.shipping_policy || null,
        return_policy: storeFields.return_policy || null,
        payment_methods: storeFields.payment_methods || null,
        current_promotions: storeFields.current_promotions || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);
    if (error) return { ok: false, error: `บันทึกร้านไม่สำเร็จ: ${error.message}` };
  }

  // 2. Diff products (keep id stable so post_history.product_id survives).
  // Generate UUIDs server-side for new rows so a single upsert handles both
  // insert and update — leaving id undefined would send NULL which violates
  // the PK on insert.
  {
    const rows = products.map((p) => ({
      id: p.id ?? crypto.randomUUID(),
      store_id: storeId,
      name: p.name,
      price: p.price || null,
      description: p.description || null,
      key_features: p.key_features || null,
      target_customer: p.target_customer || null,
    }));
    const keptIds = rows.map((r) => r.id);

    const delQuery = supabase.from("products").delete().eq("store_id", storeId);
    const { error: delErr } =
      keptIds.length > 0
        ? await delQuery.not("id", "in", `(${keptIds.join(",")})`)
        : await delQuery;
    if (delErr) return { ok: false, error: `ลบสินค้าไม่สำเร็จ: ${delErr.message}` };

    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from("products")
        .upsert(rows, { onConflict: "id" });
      if (upErr) return { ok: false, error: `บันทึกสินค้าไม่สำเร็จ: ${upErr.message}` };
    }
  }

  // 3. Diff faqs (same pattern)
  {
    const rows = faqs.map((f) => ({
      id: f.id ?? crypto.randomUUID(),
      store_id: storeId,
      question: f.question,
      answer: f.answer,
    }));
    const keptIds = rows.map((r) => r.id);

    const delQuery = supabase.from("faqs").delete().eq("store_id", storeId);
    const { error: delErr } =
      keptIds.length > 0
        ? await delQuery.not("id", "in", `(${keptIds.join(",")})`)
        : await delQuery;
    if (delErr) return { ok: false, error: `ลบ FAQ ไม่สำเร็จ: ${delErr.message}` };

    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from("faqs")
        .upsert(rows, { onConflict: "id" });
      if (upErr) return { ok: false, error: `บันทึก FAQ ไม่สำเร็จ: ${upErr.message}` };
    }
  }

  revalidatePath("/brain");
  revalidatePath("/dashboard");
  return { ok: true };
}
