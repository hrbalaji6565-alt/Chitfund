import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Member from "@/app/models/Member";

export async function GET() {
  try {
    await dbConnect();
    const members = await Member.find({}).select("_id name").lean();
    const payload = members.map((m: any) => ({ id: m._id, name: m.name }));
    return NextResponse.json({ success: true, members: payload });
  } catch (err) {
    console.error("GET /api/admin/members error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
