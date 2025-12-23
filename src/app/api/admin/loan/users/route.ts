import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import User from "@/app/models/User";

export async function GET() {
  try {
    await dbConnect();
    const users = await User.find({ role: "user" }).select("_id name email").lean();
    const payload = users.map((u: any) => ({ id: u._id, name: u.name, email: u.email }));
    return NextResponse.json({ success: true, users: payload });
  } catch (err) {
    console.error("GET /api/admin/loan/users error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
