// app/api/cloudinary/delete/route.ts
import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type BodyShape = { public_id?: string };

// POST /api/cloudinary/delete
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as BodyShape;
    const { public_id } = body;

    if (!public_id || typeof public_id !== "string") {
      return NextResponse.json({ success: false, error: "public_id required" }, { status: 400 });
    }

    // cloudinary.v2.uploader.destroy returns a promise
    const result = await cloudinary.uploader.destroy(public_id);

    // cloudinary returns an object like { result: "ok" } or { result: "not found" }
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("Cloudinary destroy error:", err);
    return NextResponse.json({ success: false, error: "delete failed" }, { status: 500 });
  }
}
