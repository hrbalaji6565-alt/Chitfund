import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/Loan";
import LoanPayment from "@/app/models/LoanPayment";
import { computePenalty } from "@/app/lib/loanUtils";

type UnknownRecord = Record<string, unknown>;

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;

    const loanId = String(body.loanId ?? "").trim();
    const monthIndex = Number(body.monthIndex ?? 0);
    const amount = Number(body.amount ?? 0);
    const collectorId =
      typeof body.collectedById === "string"
        ? body.collectedById
        : undefined;
    const method =
      typeof body.method === "string" ? body.method.toLowerCase() : "cash";

    if (!loanId || monthIndex <= 0 || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "loanId, monthIndex, amount required",
        },
        { status: 400 },
      );
    }

    const loan = await Loan.findById(loanId).lean();
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

    if (amount < totalDue) {
      return NextResponse.json(
        {
          success: false,
          error: `Amount is less than total due (${totalDue})`,
        },
        { status: 400 },
      );
    }

    payment.penaltyAmount = penalty;
    payment.totalDue = totalDue;
    payment.paidAmount = amount;
    payment.paidAt = now;
    payment.status = "approved";
    payment.source = "collector";
    payment.collectedById = collectorId ?? null;
    payment.collectorRole = "collector";
    payment.method = method;

    await payment.save();

    const pendingCount = await LoanPayment.countDocuments({
      loanId,
      status: { $ne: "approved" },
    });
    if (pendingCount === 0) {
      await Loan.findByIdAndUpdate(loanId, { status: "closed" });
    }

    return NextResponse.json({ success: true, payment });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/loans/collector/collect error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to collect loan",
      },
      { status: 500 },
    );
  }
}
