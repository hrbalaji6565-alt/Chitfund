import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/Loan";
import LoanPayment from "@/app/models/LoanPayment";
import { computePenalty } from "@/app/lib/loanUtils";

export async function GET() {
  await dbConnect();
  const loans = await Loan.find({ status: "active" }).lean();
  const loanIds = loans.map((l) => l._id.toString());

  const payments = await LoanPayment.find({
    loanId: { $in: loanIds },
    status: "pending",
  })
    .sort({ dueDate: 1 })
    .lean();

  const now = new Date();

  const list = payments.map((p) => {
    const loan = loans.find(
      (l) => l._id.toString() === p.loanId.toString(),
    );
    if (!loan) return null;

    const penalty = computePenalty(
      loan.installmentAmount,
      loan.penaltyRate,
      p.dueDate,
      now,
    );
    const totalDue = loan.installmentAmount + penalty;

    return {
      loanId: p.loanId.toString(),
      memberId: p.memberId,
      monthIndex: p.monthIndex,
      dueDate: p.dueDate,
      installmentAmount: loan.installmentAmount,
      penalty,
      totalDue,
    };
  });

  const filtered = list.filter(
    (x): x is NonNullable<typeof x> => x !== null,
  );

  return NextResponse.json({
    success: true,
    items: filtered,
  });
}
