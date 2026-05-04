import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// We don't have generated Database types, so widen to a loose untyped client.
type AdminClient = SupabaseClient;

let cached: AdminClient | null = null;

/**
 * Service-role Supabase client — BYPASSES RLS.
 * Use only inside admin-gated server actions (after verifying isAdmin).
 * Never expose this to the client bundle.
 */
export function createAdminClient(): AdminClient {
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY (or URL) not set in .env.local",
      );
    }
    cached = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
