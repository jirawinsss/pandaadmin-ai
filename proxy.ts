import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// EXPLICIT whitelist — proxy only runs on paths that genuinely need auth
// or auth-redirect logic. Everything else (homepage, /api/*, static assets,
// bot-probe paths like /wp-admin) skips proxy entirely so:
//   - LiteSpeed can serve static / from cache without invoking Node middleware
//   - LINE webhook hits zero proxy overhead
//   - Bot scans of random paths fall straight to Next's static _not-found
//     instead of running our rate-limit / bot-deny / Supabase session code
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/dashboard",
    "/brain/:path*",
    "/brain",
    "/reply/:path*",
    "/reply",
    "/post/:path*",
    "/post",
    "/inbox/:path*",
    "/inbox",
    "/integrations/:path*",
    "/integrations",
    "/settings/:path*",
    "/settings",
    "/admin/:path*",
    "/admin",
    "/login",
    "/register",
  ],
};
