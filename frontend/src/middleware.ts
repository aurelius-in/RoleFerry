import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/reset",
  "/__debug",
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
    pathname.startsWith("/assets") ||
    pathname.startsWith("/wireframes") ||
    pathname.startsWith("/__debug") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get("rf_session")?.value;
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


