"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";

export type LineConfigResult = { ok: true } | { ok: false; error: string };

const VALID_MODES = new Set(["draft", "auto_safe", "off"]);

/**
 * Save LINE OA credentials and toggles for the current user's store.
 * Token / secret fields submitted EMPTY are kept unchanged (user only
 * needs to retype them when rotating).
 */
export async function saveLineIntegrationAction(
  formData: FormData,
): Promise<LineConfigResult> {
  const ctx = await getCurrentContext();
  if (!ctx) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const tokenInput = String(formData.get("channel_access_token") ?? "").trim();
  const secretInput = String(formData.get("channel_secret") ?? "").trim();
  const isEnabled = formData.get("is_enabled") === "on";
  const mode = String(formData.get("auto_reply_mode") ?? "draft");

  if (!VALID_MODES.has(mode)) {
    return { ok: false, error: "โหมดไม่ถูกต้อง" };
  }
  // We currently only support 'draft' and 'off' — auto_safe is coming soon.
  // Silently downgrade auto_safe to draft for safety.
  const safeMode = mode === "auto_safe" ? "draft" : mode;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("line_integrations")
    .select("id, channel_access_token, channel_secret")
    .eq("store_id", ctx.store.id)
    .maybeSingle();

  // Resolve the values to write — fall back to existing when fields left blank
  const finalToken = tokenInput || existing?.channel_access_token;
  const finalSecret = secretInput || existing?.channel_secret;

  if (!finalToken || !finalSecret) {
    return {
      ok: false,
      error: "กรุณากรอก Channel Access Token และ Channel Secret",
    };
  }

  if (existing) {
    const { error } = await supabase
      .from("line_integrations")
      .update({
        channel_access_token: finalToken,
        channel_secret: finalSecret,
        is_enabled: isEnabled,
        auto_reply_mode: safeMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  } else {
    const { error } = await supabase.from("line_integrations").insert({
      store_id: ctx.store.id,
      channel_access_token: finalToken,
      channel_secret: finalSecret,
      is_enabled: isEnabled,
      auto_reply_mode: safeMode,
    });
    if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/integrations/line");
  return { ok: true };
}
