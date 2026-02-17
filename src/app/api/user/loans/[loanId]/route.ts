import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel.js";
import LoanTransaction from "@/app/models/LoanTransaction";
import { isCurrentMonth, isPastMonth, isFutureMonth } from "@/app/lib/loanUtils";
import mongoose from "mongoose";

export async function GET(req: Request, { params }: { params: Promise<{ loanId: string }> }) {
  try {
    const { loanId } = await params;
    
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || 
                  req.headers.get("cookie")?.split("memberToken=")[1]?.split(";")[0];

    if (!token) {
      return NextResponse.json({ success: false, message: "No token provided" }, { status: 401 });
    }

    const decoded = verifyToken(token) as { id?: string; userId?: string };
    const memberId = decoded?.id || decoded?.userId;
    if (!memberId) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    await dbConnect();

    const loan = await Loan.findOne({ 
      _id: loanId, 
      userId: memberId 
    }).lean();

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    const loanObjectId = mongoose.Types.ObjectId.isValid(String(loanId))
      ? new mongoose.Types.ObjectId(String(loanId))
      : null;

    const paymentRequests = await LoanTransaction.find({
      userId: memberId,
      $or: loanObjectId ? [{ loanId }, { loanId: loanObjectId }] : [{ loanId }],
      status: { $in: ["Pending", "Failed"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const requestMap = new Map<
      number,
      { status: "pending" | "rejected"; utrNumber?: string; createdAt?: Date | string }
    >();

    for (const row of paymentRequests) {
      const month = Number(row.emiMonth ?? 0);
      if (!month || requestMap.has(month)) continue;
      requestMap.set(month, {
        status: row.status === "Pending" ? "pending" : "rejected",
        utrNumber: row.utr || undefined,
        createdAt: row.createdAt || row.transactionDate,
      });
    }

    // Add current month info to each EMI
    const enhancedSchedule = loan.schedule.map((emi) => {
      const rec = emi as unknown as Record<string, unknown>;
      const emiDate = new Date(String(rec.dueDate ?? ""));
      const isCurrentMonthEMI = isCurrentMonth(emiDate);
      const isPastMonthEMI = isPastMonth(emiDate);
      const isFutureMonthEMI = isFutureMonth(emiDate);
      const monthNumber = Number(rec.monthNumber ?? 0);
      const request = requestMap.get(monthNumber);

      return {
        ...rec,
        monthNumber,
        isCurrentMonth: isCurrentMonthEMI,
        isPastMonth: isPastMonthEMI,
        isFutureMonth: isFutureMonthEMI,
        canPay: isCurrentMonthEMI && rec.status === "pending" && request?.status !== "pending",
        paymentRequestStatus: request?.status ?? null,
        paymentRequestUtr: request?.utrNumber ?? null,
        paymentRequestDate: request?.createdAt ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      loan: {
        ...loan,
        schedule: enhancedSchedule
      }
    });

  } catch (error) {
    console.error("Error fetching loan details:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loan details" },
      { status: 500 }
    );
  }
}
