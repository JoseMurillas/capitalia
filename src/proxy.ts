import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login"]);

/**
 * First line of defence: redirects unauthenticated requests to /login and
 * keeps logged-in users away from the login page. Real authorization happens
 * in `requireSession()` on every server entry point.
 */
export default auth((request) => {
  const { nextUrl } = request;
  const isLoggedIn = Boolean(request.auth?.user);
  const isPublic = PUBLIC_PATHS.has(nextUrl.pathname);

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", nextUrl);
    if (nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except Auth.js routes, the token-protected inbox API, Next internals and static assets.
    "/((?!api/auth|api/inbox|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
