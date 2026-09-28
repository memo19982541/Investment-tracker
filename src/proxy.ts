import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // A session whose Google access token failed to refresh (e.g. the
  // refresh token expired) must be treated as logged out here too —
  // otherwise this middleware sends it to /login as "not logged in" while
  // requireSession() on every page sends it right back to / as "has an
  // error", producing an infinite redirect loop (ERR_TOO_MANY_REDIRECTS).
  const isLoggedIn = !!req.auth && req.auth.error !== "RefreshAccessTokenError";
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  // /api/cron routes authenticate themselves via CRON_SECRET, not a
  // browser session — an unattended scheduler has no session cookie to
  // pass, so this middleware must not redirect those requests to /login.
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
