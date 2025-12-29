// src/app/api/collections/loan-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import LoanTransaction from "@/app/models/LoanTransaction";
import { verifyToken } from "@/app/lib/jwt";
import type { JwtPayload } from "jsonwebtoken";

interface CollectionJwtPayload extends JwtPayload {
  id: string;
}

interface LoanTransactionDoc {
  amount: number;
  createdAt: Date | string;
  collectorId?: string;
  status?: string;
}

type LoanStats = {
  todayTotal: number;
  monthTotal: number;
  yearTotal: number;
  totalTransactions: number;
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Verify collector authentication
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

    const collectorId = decodedRaw.id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get loan transactions collected by this collector
    const transactions = await LoanTransaction.find({
      collectorId: collectorId,
      status: "Paid",
    })
      .select("amount createdAt collectorId status")
      .lean<LoanTransactionDoc[]>();

    const result: LoanStats = {
      todayTotal: 0,
      monthTotal: 0,
      yearTotal: 0,
      totalTransactions: transactions.length,
    };

    for (const t of transactions) {
      const createdAt =
        t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
      const amount = typeof t.amount === "number" ? t.amount : 0;

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
    console.error("GET /api/collections/loan-stats error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load loan collection stats" },
      { status: 500 },
    );
  }
}