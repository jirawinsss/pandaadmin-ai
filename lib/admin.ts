import "server-only";
import type { User } from "@supabase/supabase-js";

/**
 * True if the user's email appears in the comma-separated ADMIN_EMAILS env var.
 * Case-insensitive. Whitespace tolerated.
 */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user?.email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const allowList = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(user.email.toLowerCase());
}
