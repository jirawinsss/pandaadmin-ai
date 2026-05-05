import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip:
  //   - /api/* — route handlers manage their own auth/rate limit; webhook
  //     needs the lowest possible latency
  //   - _next internals + static assets
  //   - icon / favicon / robots / sitemap (return 200 from public/ or app/)
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon\\.ico|icon\\.(?:svg|png|ico)|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|txt)$).*)",
  ],
};
