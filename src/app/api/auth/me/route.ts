import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

type User = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  roles: string[];
  createdAt?: string;
};

// Define JWT payload type
interface JWTPayload {
  _id?: string;
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  createdAt?: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_in_production";

export async function GET(req: NextRequest) {
  try {
    const cookieToken =
      req.cookies.get("memberToken")?.value || null;

    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization") || "";

    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    const token = cookieToken ?? bearerToken ?? null;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Not authenticated" },
        { status: 401 }
      );
    }

    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const user: User = {
      _id: String(payload._id ?? payload.id ?? payload.userId ?? ""),
      name: payload.name ?? "",
      email: payload.email ?? "",
      phone: payload.phone,
      roles: payload.roles ?? [],
      createdAt: payload.createdAt,
    };

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
