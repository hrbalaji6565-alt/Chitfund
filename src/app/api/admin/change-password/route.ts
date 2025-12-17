import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dbConnect from "@/app/lib/mongodb";
import User from "@/app/models/User";

type Body = {
  oldPassword: string;
  newPassword: string;
};

export async function POST(req: NextRequest) {
  try {
    const { oldPassword, newPassword } = (await req.json()) as Body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Old password and new password are required" },
        { status: 400 }
      );
    }

    const token = (await cookies()).get("adminToken")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as { id: string; email: string; role: string };

    if (payload.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Not authorized" },
        { status: 403 }
      );
    }

    await dbConnect();

    const admin = await User.findById(payload.id);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Admin not found" },
        { status: 404 }
      );
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Old password is incorrect" },
        { status: 400 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return NextResponse.json(
      { success: false, message: "Failed to change password" },
      { status: 500 }
    );
  }
}
