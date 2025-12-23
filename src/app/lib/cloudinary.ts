// src/app/lib/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

cloudinary.config({
  cloud_name: cloudName,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

export async function uploadBase64Image(base64: string, folder = "products") {
  // Accept raw base64 or data URL
  const data = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
  const res = await cloudinary.uploader.upload(data, { folder, resource_type: "image" });
  return { url: res.secure_url, public_id: res.public_id };
}

export async function destroyByPublicId(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn("cloudinary.destroy error:", err);
  }
}

/** Extract public_id from a Cloudinary URL (best-effort) */
export function extractPublicIdFromUrl(url: string): string | null {
  // Matches: /upload/(v123/)?<public_id>.<ext>
  const m = url.match(/\/upload\/(?:v\d+\/)?([^\.\/]+)\.[a-zA-Z0-9]+$/);
  return m ? m[1] : null;
}
