import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Only a fast redirect for signed-out visitors. The cookie is not verified
// here; every page, action and route checks the session on the server.
// API routes are left out so they can answer 401 JSON instead of a redirect.
export function proxy(request: NextRequest): NextResponse {
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: [
    "/((?!sign-in|about|api/|_next/static|_next/image|favicon.ico|tmdb-logo.svg|icon|apple-icon|manifest).*)",
  ],
};
