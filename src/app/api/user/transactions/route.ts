// app/api/user/transactions/route.ts
import dbConnect from "@/app/lib/mongodb";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId") ?? undefined;

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }
    const paymentsColl = db.collection("payments");

     const q: Record<string, unknown> = {};
    if (memberId) {
      // keep existing behavior – store raw memberId string
      q.memberId = memberId;
    }

    const results = await paymentsColl.find(q).sort({ createdAt: -1 }).limit(200).toArray();

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
