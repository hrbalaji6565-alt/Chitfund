// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import Member from "@/app/models/Member";
import { signToken } from "@/app/lib/jwt"; // must exist

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json();

    console.log("Login attempt:", { userId, password: password ? "***" : "missing" });

    if (!userId || !password) {
      console.log("Missing credentials");
      return NextResponse.json({ success: false, message: "UserID and password required" }, { status: 400 });
    }

    await dbConnect();
    console.log("Database connected");

    const member = await Member.findOne({ userId });
    console.log("Member found:", member ? { id: member._id, userId: member.userId, name: member.name } : "No member found");
    
    if (!member) {
      console.log("Member not found for userId:", userId);
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    const match = await bcrypt.compare(password, member.password);
    console.log("Password match:", match);
    
    if (!match) {
      console.log("Password mismatch for userId:", userId);
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    const token = signToken({ id: member._id, userId: member.userId, role: member.role });
    console.log("Token generated successfully");

    const res = NextResponse.json({
      success: true,
      message: "Login successful",
      member: {
        id: member._id,
        name: member.name,
        userId: member.userId,
        role: member.role,
        token,
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

    console.log("Login successful for userId:", userId);
    return res;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
