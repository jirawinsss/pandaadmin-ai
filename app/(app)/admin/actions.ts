"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { PLAN_LIMITS } from "@/lib/plans";

const VALID_PLANS = new Set(Object.keys(PLAN_LIMITS));

export type AdminResult = { ok: true } | { ok: false; error: string };

export async function updateUserPlanAction(
  userId: string,
  plan: string,
): Promise<AdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) {
    return { ok: false, error: "ไม่มีสิทธิ์ admin" };
  }

  if (!userId || !VALID_PLANS.has(plan)) {
    return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ plan })
    .eq("id", userId);
  if (error) {
    console.error("[admin] update plan error:", error);
    return { ok: false, error: `อัปเดตไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function resetUserUsageAction(
  userId: string,
): Promise<AdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) {
    return { ok: false, error: "ไม่มีสิทธิ์ admin" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      usage_reply: 0,
      usage_post: 0,
      usage_reset_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) {
    return { ok: false, error: `รีเซ็ตไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/admin");
  return { ok: true };
}
