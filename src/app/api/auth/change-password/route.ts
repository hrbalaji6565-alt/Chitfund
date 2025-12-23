import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import Member from "@/app/models/Member";
import { verifyToken } from "@/app/lib/jwt";
import type { JwtPayload } from "jsonwebtoken";

type TokenPayload = JwtPayload & {
  id?: string;
};

export async function POST(req: Request) {
  try {
    const { oldPassword, newPassword } = await req.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Old and new password required" },
        { status: 400 }
      );
    }

    // 🔐 read cookie
    const cookie = req.headers.get("cookie") ?? "";
    const token = cookie
      .split("; ")
      .find((c) => c.startsWith("memberToken="))
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token) as string | TokenPayload;

    // ✅ TYPE GUARD
    if (typeof decoded === "string" || !decoded.id) {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    await dbConnect();

    const member = await Member.findById(decoded.id);
    if (!member) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const match = await bcrypt.compare(oldPassword, member.password);
    if (!match) {
      return NextResponse.json(
        { success: false, message: "Old password incorrect" },
        { status: 400 }
      );
    }

    member.password = await bcrypt.hash(newPassword, 10);
    await member.save();

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("change-password error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
