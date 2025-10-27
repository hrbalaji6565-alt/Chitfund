// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const adminToken = req.cookies.get("adminToken")?.value;
  const url = req.nextUrl.pathname;

  // 🛡 Protect admin routes
  if (url.startsWith("/admin")) {
    if (!adminToken) {
      // Not logged in → redirect to login
      const loginUrl = new URL("/", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ✅ Allow access
  return NextResponse.next();
}

// 👇 Match all /admin routes
export const config = {
  matcher: ["/admin/:path*"],
};
