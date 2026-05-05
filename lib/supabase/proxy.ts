import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { consumeBucket, getClientIp } from "@/lib/ratelimit";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/brain",
  "/reply",
  "/post",
  "/inbox",
  "/integrations",
  "/settings",
  "/admin",
];
const AUTH_PREFIXES = ["/login", "/register"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Cheap reject for obvious vulnerability scanners (WordPress, PHP, env probes).
 * Saves a Node render + Supabase auth call per probe.
 */
function isBotProbe(path: string): boolean {
  if (/\.(php|asp|aspx|jsp|cgi|env|sql)$/i.test(path)) return true;
  if (/^\/(wp-|wordpress|phpmyadmin|administrator|vendor\/|\.aws|\.ssh|\.env|\.git|\.svn|\.well-known\/security)/i.test(path)) return true;
  if (path === "/xmlrpc.php" || path === "/HNAP1") return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Fast deny for bot probes — no Supabase, no Node render
  if (isBotProbe(path)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  // 2. Per-IP rate limit (120 req / minute) — protects all paths the proxy
  // sees. Webhook is excluded by matcher and rate-limits itself separately
  // because LINE servers share IPs across stores.
  const ip = getClientIp(request.headers);
  if (!consumeBucket(`proxy:${ip}`, 120, 60_000)) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "content-type": "text/plain", "retry-after": "60" },
    });
  }

  // 3. Skip the Supabase auth round-trip entirely for paths that don't need
  // it (homepage, marketing, public assets that slip past the matcher).
  // Only protected and auth-redirect paths need the session check.
  const needsAuthCheck =
    startsWithAny(path, PROTECTED_PREFIXES) ||
    startsWithAny(path, AUTH_PREFIXES);
  if (!needsAuthCheck) {
    return NextResponse.next({ request });
  }

  // 4. Auth path — refresh session + redirect logic
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do NOT add logic between createServerClient and getUser().
  // It can cause hard-to-debug random logouts because session refresh runs
  // here. Keep this single call before any redirect logic below.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && startsWithAny(path, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && startsWithAny(path, AUTH_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
