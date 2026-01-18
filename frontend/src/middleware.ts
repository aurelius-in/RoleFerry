import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || "rf_session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/reset",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files from /public (e.g. /rf_logo.png) without auth.
  // Without this, logo/image requests get redirected to /login and appear "broken" in prod.
  const looksLikeStaticFile = /\.[a-zA-Z0-9]+$/.test(pathname);
  if (looksLikeStaticFile) {
    return NextResponse.next();
  }

  // Allow next internals / static / api proxy
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (PUBLIC_PATHS.has(pathname)) {
    // If already logged in, don't let users land on /login again.
    if (pathname === "/login" && session) {
      const url = req.nextUrl.clone();
      url.pathname = "/job-preferences";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};


