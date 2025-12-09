import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/Loan";
import LoanPayment from "@/app/models/LoanPayment";
import { computePenalty } from "@/app/lib/loanUtils";

// TODO: Replace this with your auth/session user id
const getUserIdFromRequest = async (_req: NextRequest): Promise<string> => {
  // e.g. read from cookies/session
  return ""; // fill with your current user's memberId
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const memberId = await getUserIdFromRequest(req);
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const loans = await Loan.find({ memberId }).lean();
    const loanIds = loans.map((l) => l._id.toString());

    const payments = await LoanPayment.find({
      loanId: { $in: loanIds },
    })
      .sort({ monthIndex: 1 })
      .lean();

    const now = new Date();

    const result = loans.map((loan) => {
      const pForLoan = payments.filter(
        (p) => p.loanId === loan._id.toString(),
      );

      const enriched = pForLoan.map((p) => {
        const dueDate = new Date(p.dueDate);
        const isApproved = p.status === "approved";
        const penalty = isApproved
          ? p.penaltyAmount
          : computePenalty(
              loan.installmentAmount,
              loan.penaltyRate,
              dueDate,
              now,
            );
        return {
          ...p,
          currentPenalty: penalty,
          currentTotalDue: loan.installmentAmount + penalty,
        };
      });

      const nextPending = enriched.find(
        (p) => p.status === "pending" || p.status === "submitted",
      );

      return {
        ...loan,
        payments: enriched,
        nextDue: nextPending ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      loans: result,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/api/loans/user error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load loans" },
      { status: 500 },
    );
  }
}
