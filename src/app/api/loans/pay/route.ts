import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/Loan";
import LoanPayment from "@/app/models/LoanPayment";
import { computePenalty } from "@/app/lib/loanUtils";

// Same: implement from your auth
const getUserIdFromRequest = async (_req: NextRequest): Promise<string> => {
  return "";
};

type UnknownRecord = Record<string, unknown>;

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const loanId = String(body.loanId ?? "").trim();
    const monthIndex = Number(body.monthIndex ?? 0);
    const utr =
      typeof body.utr === "string" ? body.utr.trim() : "";
    const method =
      typeof body.method === "string" ? body.method.toLowerCase() : "upi";

    if (!loanId || monthIndex <= 0 || !utr) {
      return NextResponse.json(
        {
          success: false,
          error: "loanId, monthIndex & utr required",
        },
        { status: 400 },
      );
    }

    const loan = await Loan.findOne({
      _id: loanId,
      memberId: userId,
    }).lean();
    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    const payment = await LoanPayment.findOne({
      loanId,
      monthIndex,
    });
    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment schedule not found" },
        { status: 404 },
      );
    }

    if (payment.status === "approved") {
      return NextResponse.json(
        { success: false, error: "Already paid" },
        { status: 400 },
      );
    }

    const now = new Date();
    const penalty = computePenalty(
      loan.installmentAmount,
      loan.penaltyRate,
      payment.dueDate,
      now,
    );
    const totalDue = loan.installmentAmount + penalty;

    payment.penaltyAmount = penalty;
    payment.totalDue = totalDue;
    payment.paidAmount = totalDue;
    payment.paidAt = now;
    payment.utr = utr;
    payment.method = method;
    payment.status = "submitted";
    payment.source = "user";

    await payment.save();

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/loans/pay error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Payment failed",
      },
      { status: 500 },
    );
  }
}
