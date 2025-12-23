// app/api/collections/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import CollectionUser from "@/app/models/CollectionUser";
import { verifyToken } from "@/app/lib/jwt";
import type { JwtPayload } from "jsonwebtoken";

interface CollectionJwtPayload extends JwtPayload {
  id: string;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const token = req.cookies.get("collectionToken")?.value ?? "";
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const rawDecoded = verifyToken(token) as CollectionJwtPayload | string | null;

    if (!rawDecoded || typeof rawDecoded === "string" || !rawDecoded.id) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = rawDecoded.id;

    const user = await CollectionUser.findById(userId).lean();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const assignedGroupIds =
      Array.isArray(user.assignedGroupIds)
        ? user.assignedGroupIds.map((id) => String(id))
        : [];

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("GET /api/collections/me error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
