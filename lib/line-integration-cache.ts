import "server-only";

// In-memory cache for `line_integrations WHERE is_enabled = true`.
//
// Without this, every LINE webhook does a Supabase SELECT to find the
// matching integration — ~80–200ms RTT per webhook. Under a burst of
// concurrent webhooks, those round-trips stack up and the LSAPI worker
// pool fills with requests waiting on Supabase. With this cache the
// lookup is O(1) memory after the first webhook in each TTL window.
//
// TTL is 30s — chosen so config changes (toggle on/off, intent
// whitelist edit, mode change) take effect within at most 30 seconds.
// Saves can also call invalidate() to apply changes immediately.

export type CachedIntegration = {
  id: string;
  store_id: string;
  channel_secret: string;
  channel_access_token: string;
  is_enabled: boolean;
  auto_reply_mode: string;
  auto_reply_intents: string[] | null;
};

const TTL_MS = 30_000;

let cache: { ts: number; rows: CachedIntegration[] } | null = null;

/**
 * Returns cached enabled integrations or runs `fetcher` if cache is empty
 * or expired. The fetcher is called at most once per TTL window even
 * under a burst of concurrent webhooks (single in-flight refresh is NOT
 * deduped — see note below).
 *
 * Note on stampedes: if 50 concurrent webhooks arrive when cache is
 * expired, all 50 will call fetcher in parallel before any of them
 * populates the cache. That's fine — Supabase handles 50 SELECTs at
 * once, and after the first one returns, subsequent webhooks within the
 * same TTL window hit the cache. We accept a small once-per-TTL stampede
 * over the complexity of an in-flight promise dedup.
 */
export async function getEnabledIntegrationsCached(
  fetcher: () => Promise<CachedIntegration[]>,
): Promise<CachedIntegration[]> {
  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) {
    return cache.rows;
  }
  const rows = await fetcher();
  cache = { ts: now, rows };
  return rows;
}

/**
 * Force the next call to refetch from the database.
 * Call this from any action that mutates line_integrations so the change
 * propagates immediately instead of waiting up to TTL_MS.
 */
export function invalidateIntegrationsCache(): void {
  cache = null;
}

export function getCacheStats() {
  return {
    populated: cache !== null,
    age_ms: cache ? Date.now() - cache.ts : null,
    rows: cache?.rows.length ?? 0,
    ttl_ms: TTL_MS,
  };
}
