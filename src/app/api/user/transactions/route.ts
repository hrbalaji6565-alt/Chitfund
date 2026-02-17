// app/api/user/transactions/route.ts
import dbConnect from "@/app/lib/mongodb";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId") ?? undefined;

    // Do not return all users' transactions when memberId is missing.
    if (!memberId) {
      return NextResponse.json([]);
    }

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    const paymentsColl = db.collection("payments");

    const q: Record<string, unknown> = mongoose.Types.ObjectId.isValid(memberId)
      ? {
        $or: [
          { memberId },
          { memberId: new mongoose.Types.ObjectId(memberId) },
        ],
      }
      : { memberId };

    const results = await paymentsColl.find(q).sort({ createdAt: -1 }).limit(200).toArray();

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
