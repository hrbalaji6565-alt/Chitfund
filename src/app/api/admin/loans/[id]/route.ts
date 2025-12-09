// src/app/api/admin/loans/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan, { ILoan } from "@/app/models/Loan";
import LoanPayment, { ILoanPayment } from "@/app/models/LoanPayment";
import {
  buildLoanSchedule,
  computePenalty,
  LoanScheduleItem,
} from "@/app/lib/loanUtils";

type RouteContext = {
  // 🔴 Next 15: params is a Promise – MUST await
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await dbConnect();

    const { id } = await ctx.params; // ✅ real id yaha milega

    const loanDoc = await Loan.findById(id).lean<ILoan | null>();
    if (!loanDoc) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    const payments = await LoanPayment.find({ loanId: id })
      .sort({ monthIndex: 1 })
      .lean<ILoanPayment[]>();

    const schedule: LoanScheduleItem[] = buildLoanSchedule({
      principal: loanDoc.principal,
      monthlyInterestRate: loanDoc.monthlyInterestRate,
      tenureMonths: loanDoc.tenureMonths,
      installmentAmount: loanDoc.installmentAmount,
      dueDayOfMonth: loanDoc.dueDayOfMonth,
      startDate: loanDoc.startDate,
    });

    const now = new Date();

    const paymentsWithPenalty = payments.map((p) => {
      if (p.status === "approved") return p;

      const penalty = computePenalty(
        loanDoc.installmentAmount,
        loanDoc.penaltyRate,
        p.dueDate,
        now,
      );
      const totalDue = loanDoc.installmentAmount + penalty;

      return {
        ...p,
        penaltyAmount: penalty,
        totalDue,
      };
    });

    return NextResponse.json({
      success: true,
      loan: loanDoc,
      schedule,
      payments: paymentsWithPenalty,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("GET /api/admin/loans/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load loan" },
      { status: 500 },
    );
  }
}
