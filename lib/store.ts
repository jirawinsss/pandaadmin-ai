import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StoreRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  brand_voice: string | null;
  voice_examples: string | null;
  shipping_policy: string | null;
  return_policy: string | null;
  payment_methods: string | null;
  current_promotions: string | null;
};

export type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  price: string | null;
  description: string | null;
  key_features: string | null;
  target_customer: string | null;
};

export type FaqRow = {
  id: string;
  store_id: string;
  question: string;
  answer: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  plan: string;
  usage_reply: number;
  usage_post: number;
  usage_reset_at: string;
};

/**
 * True if the timestamp falls in a month earlier than `now` (any year).
 */
function isFromPreviousMonth(iso: string, now: Date = new Date()): boolean {
  const t = new Date(iso);
  return (
    t.getUTCFullYear() < now.getUTCFullYear() ||
    (t.getUTCFullYear() === now.getUTCFullYear() &&
      t.getUTCMonth() < now.getUTCMonth())
  );
}

/**
 * Fetch the signed-in user's profile + their (single) store.
 * Returns null if not signed in. Throws if signed in but no profile/store
 * (which would mean the signup trigger failed — surface it loudly).
 *
 * Side effect: lazy monthly usage reset — if `usage_reset_at` is from a
 * previous calendar month, this call resets usage_reply / usage_post to 0
 * and bumps usage_reset_at to now(). Avoids needing a cron.
 */
export async function getCurrentContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profileRaw }, { data: stores }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  if (!profileRaw || !stores || stores.length === 0) {
    throw new Error(
      "Profile or store missing. The signup trigger may have failed — re-run 0001_init.sql.",
    );
  }

  let profile = profileRaw as ProfileRow;

  if (isFromPreviousMonth(profile.usage_reset_at)) {
    const nowIso = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({
        usage_reply: 0,
        usage_post: 0,
        usage_reset_at: nowIso,
      })
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) {
      // Don't break the request if the reset write fails — log + keep stale
      // counters; next request will retry.
      console.error("[lazy-reset] update failed:", error);
    } else if (updated) {
      profile = updated as ProfileRow;
    }
  }

  return {
    user,
    profile,
    store: stores[0] as StoreRow,
  };
}

export async function getStoreProducts(storeId: string): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ProductRow[];
}

export async function getStoreFaqs(storeId: string): Promise<FaqRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faqs")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  return (data ?? []) as FaqRow[];
}
