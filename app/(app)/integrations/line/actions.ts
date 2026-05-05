"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";
import { INTENTS } from "@/app/(app)/reply/types";
import { invalidateIntegrationsCache } from "@/lib/line-integration-cache";

export type LineConfigResult = { ok: true } | { ok: false; error: string };

const VALID_MODES = new Set(["draft", "auto_safe", "off"]);
const VALID_INTENTS = new Set<string>(INTENTS);

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

  // Intent whitelist for auto_safe — multi-checkbox.
  // formData.getAll returns FormDataEntryValue[]; filter to known intents.
  const rawIntents = formData.getAll("auto_reply_intents").map(String);
  const intents = Array.from(
    new Set(rawIntents.filter((v) => VALID_INTENTS.has(v))),
  );

  // If not in auto_safe mode, persist an empty whitelist so toggling back
  // doesn't surprise-enable old picks.
  const finalIntents = mode === "auto_safe" ? intents : [];

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
        auto_reply_mode: mode,
        auto_reply_intents: finalIntents,
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
      auto_reply_mode: mode,
      auto_reply_intents: finalIntents,
    });
    if (error) return { ok: false, error: `บันทึกไม่สำเร็จ: ${error.message}` };
  }

  // Invalidate the in-memory integration cache used by the webhook so
  // the toggle / mode / whitelist changes take effect on the very next
  // webhook (otherwise the cache TTL would delay it up to 30s).
  invalidateIntegrationsCache();

  revalidatePath("/integrations/line");
  return { ok: true };
}
