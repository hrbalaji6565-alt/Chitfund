// src/app/api/collections/loan-pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import Member from "@/app/models/Member";
import { verifyToken } from "@/app/lib/jwt";
import type { JwtPayload } from "jsonwebtoken";

interface CollectionJwtPayload extends JwtPayload {
  id: string;
}

type LoanEMIPendingItem = {
  id: string;
  loanId: string;
  loanName: string;
  memberId: string;
  memberName: string;
  emiMonth: number;
  expected: number;
  paid: number;
  pending: number;
  dueDate: string;
  status: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Verify collector authentication
    const token = req.cookies.get("collectionToken")?.value ?? "";
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const decodedRaw = verifyToken(token) as CollectionJwtPayload | string | null;
    if (!decodedRaw || typeof decodedRaw === "string" || !decodedRaw.id) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Get current date for due/overdue calculation
    const now = new Date();

    // Fetch all active loans with their EMI schedules
    const loans = await Loan.find({
      // Only active loans
      $or: [
        { status: { $exists: false } },
        { status: { $ne: "completed" } }
      ]
    })
    .populate("userId", "name phone")
    .lean();

    const pendingItems: LoanEMIPendingItem[] = [];

    for (const loan of loans) {
      if (!isRecord(loan) || !loan.schedule || !Array.isArray(loan.schedule)) {
        continue;
      }

      const memberInfo = isRecord(loan.userId) ? loan.userId : null;
      const memberName = memberInfo?.name ? String(memberInfo.name) : "Unknown Member";
      // Handle both populated and non-populated userId
      const memberId = memberInfo?._id ? String(memberInfo._id) : String(loan.userId);
      const loanId = String(loan._id);

      // Process each EMI in the schedule
      for (const emi of loan.schedule) {
        if (!isRecord(emi)) continue;

        const monthNumber = toNumber(emi.monthNumber);
        const emiAmount = toNumber(emi.emiAmount);
        const paidAmount = toNumber(emi.paidAmount);
        const pending = Math.max(0, emiAmount - paidAmount);
        const status = String(emi.status || "pending");
        const dueDate = emi.dueDate ? new Date(String(emi.dueDate)) : null;

        // Show ALL EMIs that have pending amounts (regardless of due date)
        // Collector should see all monthly EMIs, but can only collect on/after due date
        if (pending > 0 && dueDate) {
          pendingItems.push({
            id: `${loanId}-${monthNumber}`,
            loanId,
            loanName: `Loan-${loanId.slice(-6)}`,
            memberId,
            memberName,
            emiMonth: monthNumber,
            expected: emiAmount,
            paid: paidAmount,
            pending,
            dueDate: dueDate.toISOString(),
            status
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      items: pendingItems
    });

  } catch (err) {
    console.error("GET /api/collections/loan-pending error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load pending loan EMIs" },
      { status: 500 }
    );
  }
}