"use server";

import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

export async function changePasswordAction(
  _prev: SettingsResult | undefined,
  formData: FormData,
): Promise<SettingsResult> {
  const newPassword = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (newPassword.length < 8) {
    return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }
  if (newPassword !== confirm) {
    return { ok: false, error: "รหัสผ่านยืนยันไม่ตรงกัน" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: `เปลี่ยนรหัสผ่านไม่สำเร็จ: ${error.message}` };
  }

  return { ok: true };
}
