// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = req.nextUrl.pathname;

  // IMPORTANT: read only cookies here (edge runtime)
  const adminToken = req.cookies.get("adminToken")?.value || "";
  const memberToken = req.cookies.get("memberToken")?.value || localStorage.getItem("memberToken") || "";

  // Protect admin routes
  if (pathname.startsWith("/admin")) {
    if (!adminToken) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // Protect user routes (exact /user and any subpath)
  if (pathname === "/user" || pathname.startsWith("/user/")) {
    if (!memberToken) {
      url.pathname = "/";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*"],
};
