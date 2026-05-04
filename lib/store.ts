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
 * Fetch the signed-in user's profile + their (single) store.
 * Returns null if not signed in. Throws if signed in but no profile/store
 * (which would mean the signup trigger failed — surface it loudly).
 */
export async function getCurrentContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: stores }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);

  if (!profile || !stores || stores.length === 0) {
    throw new Error(
      "Profile or store missing. The signup trigger may have failed — re-run 0001_init.sql.",
    );
  }

  return {
    user,
    profile: profile as ProfileRow,
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
