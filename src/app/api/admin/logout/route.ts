// /app/api/admin/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Logged out" });
  res.cookies.set("adminToken", "", {
    path: "/",
    httpOnly: true,
    maxAge: 0,
  });
  return res;
}
