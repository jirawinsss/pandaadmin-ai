"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/app/(auth)/login/actions";

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }
  if (password.length < 8) {
    return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // If "Confirm email" is ON in Supabase Auth settings, signUp returns a user
  // but no session — they must verify before they can log in.
  if (!data.session) {
    redirect(
      "/login?notice=" +
        encodeURIComponent("สมัครสำเร็จ — กรุณายืนยันอีเมลก่อนเข้าใช้งาน"),
    );
  }

  revalidatePath("/", "layout");
  redirect("/brain?welcome=1");
}
