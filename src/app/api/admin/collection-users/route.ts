import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import CollectionUser from "@/app/models/CollectionUser";
import bcrypt from "bcryptjs";

type CreateBody = {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  role?: "collector" | "admin";
  assignedGroupIds?: string[];
};

export async function GET() {
  try {
    await dbConnect();
    const users = await CollectionUser.find().lean();

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: String(u._id),
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
        active: u.active,
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/admin/collection-users error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load collection users" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = (await req.json()) as CreateBody;

    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!name || !phone || !email || !password) {
      return NextResponse.json(
        { success: false, error: "name, phone, email, password required" },
        { status: 400 },
      );
    }

    const existing = await CollectionUser.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Email already used" },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const assignedGroupIds =
      body.assignedGroupIds?.map((id) => id).filter((id) => id) ?? [];

    const doc = await CollectionUser.create({
      name,
      phone,
      email,
      passwordHash,
      role: body.role ?? "collector",
      assignedGroupIds,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: String(doc._id),
        name: doc.name,
        phone: doc.phone,
        email: doc.email,
        role: doc.role,
        active: doc.active,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/admin/collection-users error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create collection user" },
      { status: 500 },
    );
  }
}
