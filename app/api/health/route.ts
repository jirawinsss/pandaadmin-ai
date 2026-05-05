import { NextResponse } from "next/server";
import { getQueueStats } from "@/lib/ai-queue";
import { getCacheStats } from "@/lib/line-integration-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Tells you whether the Node process is alive AT ALL — does NOT touch the
 * database, AI, or any external service. If this returns 200 but other
 * routes 503, the bottleneck is downstream (Supabase / Anthropic / a
 * specific route handler), not the process pool.
 *
 * Excluded from the proxy matcher (path starts with /api/) so it never
 * hits Supabase auth either.
 *
 * ai_queue.active / .backlog tells you whether the LINE webhook is
 * currently saturated with AI work. If backlog ≥ max_backlog, new
 * webhooks fall back to draft mode (no auto-send) to avoid worker
 * starvation.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ts: Date.now(),
    pid: process.pid,
    uptime_s: Math.round(process.uptime()),
    node: process.version,
    env: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabase_anon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabase_service: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    ai_queue: getQueueStats(),
    integration_cache: getCacheStats(),
  });
}
