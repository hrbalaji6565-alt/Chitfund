// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Sirf cookies se token lo (edge runtime)
  const adminToken = req.cookies.get("adminToken")?.value || "";
  const memberToken = req.cookies.get("memberToken")?.value || "";
  const collectionToken = req.cookies.get("collectionToken")?.value || "";

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/";

  const isUserPath = pathname === "/user" || pathname.startsWith("/user/");
  const isUserLogin = pathname === "/";

  const isCollectionPath =
    pathname === "/collection" || pathname.startsWith("/collection/");
  const isCollectionLogin = pathname === "/";

  // 🔒 Admin routes protect (login page ko chhod ke)
  if (isAdminPath && !isAdminLogin) {
    if (!adminToken) {
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // 🔒 User routes protect (login ko chhod ke)
  if (isUserPath && !isUserLogin) {
    if (!memberToken) {
      url.pathname = "/";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // 🔒 Collection routes protect
  if (isCollectionPath && !isCollectionLogin) {
    if (!collectionToken) {
      url.pathname = "/";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*", "/collection/:path*"],
};
