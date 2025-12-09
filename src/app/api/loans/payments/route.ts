import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/Loan";
import LoanPayment from "@/app/models/LoanPayment";
import { computePenalty } from "@/app/lib/loanUtils";

type UnknownRecord = Record<string, unknown>;

export async function GET() {
  await dbConnect();
  const payments = await LoanPayment.find({
    status: { $in: ["submitted", "pending"] },
  })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, payments });
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;

    const paymentId = String(body.paymentId ?? "").trim();
    const approve = Boolean(body.approve ?? true);

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId required" },
        { status: 400 },
      );
    }

    const payment = await LoanPayment.findById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    if (!approve) {
      payment.status = "rejected";
      await payment.save();
      return NextResponse.json({ success: true, payment });
    }

    const loan = await Loan.findById(payment.loanId).lean();
    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    const penalty = computePenalty(
      loan.installmentAmount,
      loan.penaltyRate,
      payment.dueDate,
      payment.paidAt ?? now,
    );
    const totalDue = loan.installmentAmount + penalty;

    payment.penaltyAmount = penalty;
    payment.totalDue = totalDue;
    payment.paidAmount = totalDue;
    payment.status = "approved";
    if (!payment.paidAt) payment.paidAt = now;
    await payment.save();

    const pendingCount = await LoanPayment.countDocuments({
      loanId: payment.loanId,
      status: { $ne: "approved" },
    });

    if (pendingCount === 0) {
      await Loan.findByIdAndUpdate(payment.loanId, {
        status: "closed",
      });
    }

    return NextResponse.json({ success: true, payment });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/admin/loans/payments error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to update payment",
      },
      { status: 500 },
    );
  }
}
