import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/login",
  "/reset",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  console.log(`Middleware running for: ${pathname}`);

  // Allow next internals / static / api proxy
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/wireframes") ||
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


