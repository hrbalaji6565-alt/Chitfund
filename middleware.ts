// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Sirf cookies se token lo (edge runtime)
  const adminToken = req.cookies.get("adminToken")?.value || "";
  const memberToken = req.cookies.get("memberToken")?.value || "";

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/";

  const isUserPath =
    pathname === "/user" || pathname.startsWith("/user/");
  const isUserLogin = pathname === "/";

  // 🔒 Admin routes protect (login page ko chhod ke)
  if (isAdminPath && !isAdminLogin) {
    if (!adminToken) {
      url.pathname = "/"; // ya "/" agar home pe bhejna hai
      return NextResponse.redirect(url);
    }
  }

  // 🔒 User routes protect (login ko chhod ke)
  if (isUserPath && !isUserLogin) {
    if (!memberToken) {
      url.pathname = "/"; // ya "/" agar home pe bhejna hai
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*"],
};
