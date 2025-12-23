// app/api/collections/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import CollectionUser from "@/app/models/CollectionUser";
import bcrypt from "bcryptjs";
import { signToken } from "@/app/lib/jwt";

type LoginBody = {
  email?: string;
  password?: string;
};

interface CollectionUserDoc {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "collector" | "admin";
  active: boolean;
  assignedGroupIds?: unknown[];
  passwordHash: string;
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "email and password required" },
        { status: 400 },
      );
    }

    const user = await CollectionUser.findOne({ email })
      .select("+passwordHash")
      .lean<CollectionUserDoc | null>();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { success: false, error: "User is inactive" },
        { status: 403 },
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const assignedGroupIds =
      Array.isArray(user.assignedGroupIds)
        ? user.assignedGroupIds.map(id => String(id))
        : [];

    // JWT banao (admin/member jaisa hi logic use karo)
    const token = signToken({ id: String(user._id), role: user.role });

    const res = NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        active: user.active,
        assignedGroupIds,
      },
      token,
    });

    // Cookie set karo: middleware + /api/collections/me isi ko padhenge
    res.cookies.set("collectionToken", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/collections/login error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to login" },
      { status: 500 },
    );
  }
}
