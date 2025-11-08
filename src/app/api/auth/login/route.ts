// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import Member from "@/app/models/Member";
import { signToken } from "@/app/lib/jwt"; // must exist

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password required" }, { status: 400 });
    }

    await dbConnect();

    const member = await Member.findOne({ email });
    if (!member) return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });

    const match = await bcrypt.compare(password, member.password);
    if (!match) return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });

    const token = signToken({ id: member._id, email: member.email, role: member.role });

    const res = NextResponse.json({
      success: true,
      message: "Login successful",
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        role: member.role,
        avatarUrl: member.avatarUrl,
      },
    });

    // set cookie (httpOnly)
    res.cookies.set("memberToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
