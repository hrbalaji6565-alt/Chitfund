// src/app/api/collections/collector-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import { verifyToken } from "@/app/lib/jwt";
import type { JwtPayload } from "jsonwebtoken";

interface CollectionJwtPayload extends JwtPayload {
  id: string;
}

interface PaymentDoc {
  amount: number;
  createdAt: Date | string;
  collectorRole?: string;
  status?: string;
}

type Stats = {
  todayTotal: number;
  monthTotal: number;
  yearTotal: number;
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // auth sirf check ke liye, stats hum role se filter karenge
    const token = req.cookies.get("collectionToken")?.value ?? "";
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const decodedRaw = verifyToken(token) as CollectionJwtPayload | string | null;
    if (!decodedRaw || typeof decodedRaw === "string" || !decodedRaw.id) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // IMPORTANT:
    // yaha sirf collectorRole: "collector" pe filter.
    // isse admin ke collections hat jayenge.
    const payments = await Payment.find({
      collectorRole: "collector",
      // agar tum status field use karte ho to yaha add karna:
      // status: "success",
    })
      .select("amount createdAt collectorRole status")
      .lean<PaymentDoc[]>();

    const result: Stats = {
      todayTotal: 0,
      monthTotal: 0,
      yearTotal: 0,
    };

    for (const p of payments) {
      const createdAt =
        p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt);
      const amount = typeof p.amount === "number" ? p.amount : 0;

      if (createdAt >= startOfYear) {
        result.yearTotal += amount;
      }
      if (createdAt >= startOfMonth) {
        result.monthTotal += amount;
      }
      if (createdAt >= startOfToday) {
        result.todayTotal += amount;
      }
    }

    return NextResponse.json({
      success: true,
      stats: result,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/collections/collector-stats error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load collector stats" },
      { status: 500 },
    );
  }
}
