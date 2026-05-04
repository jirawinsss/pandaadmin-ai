"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";

export type InboxResult = { ok: true } | { ok: false; error: string };

const VALID_STATUSES = new Set([
  "draft",
  "needs_human",
  "copied",
  "sent",
  "ignored",
]);

/**
 * Update the status of one inbox message + optionally save the edited draft.
 * RLS scopes the update to messages owned by the user's store.
 */
export async function updateInboxMessageAction(opts: {
  id: string;
  status?: string;
  ai_draft?: string;
}): Promise<InboxResult> {
  const ctx = await getCurrentContext();
  if (!ctx) return { ok: false, error: "ยังไม่ได้เข้าสู่ระบบ" };

  if (!opts.id) return { ok: false, error: "ไม่พบ id ข้อความ" };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (opts.status !== undefined) {
    if (!VALID_STATUSES.has(opts.status)) {
      return { ok: false, error: "สถานะไม่ถูกต้อง" };
    }
    patch.status = opts.status;
  }
  if (opts.ai_draft !== undefined) {
    patch.ai_draft = opts.ai_draft;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inbox_messages")
    .update(patch)
    .eq("id", opts.id)
    .eq("store_id", ctx.store.id);
  if (error) return { ok: false, error: `อัปเดตไม่สำเร็จ: ${error.message}` };

  revalidatePath("/inbox");
  return { ok: true };
}
