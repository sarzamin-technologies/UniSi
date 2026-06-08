import { NextResponse, type NextRequest } from "next/server";

/**
 * Allow /embed/* to be loaded inside any frame. Everything else stays
 * SAMEORIGIN by default.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/embed/")) {
    // Modern frame-policy header. (X-Frame-Options doesn't support per-origin
    // allowlists; CSP frame-ancestors does and is what browsers honor first.)
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
    res.headers.delete("X-Frame-Options");
  }
  return res;
}

export const config = {
  matcher: ["/embed/:path*"],
};
