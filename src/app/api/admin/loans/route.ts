// src/app/api/admin/loans/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/Loan";
import LoanPayment from "@/app/models/LoanPayment";
import {
  buildLoanSchedule,
  calculateInstallment,
  computePenalty,
  LoanScheduleItem,
} from "@/app/lib/loanUtils";

type UnknownRecord = Record<string, unknown>;

type LoanDoc = {
  _id: string;
  memberId: string;
  principal: number;
  monthlyInterestRate: number;
  tenureMonths: number;
  dueDayOfMonth: number;
  penaltyRate: number;
  installmentAmount: number;
  startDate: Date;
  status?: string;
};

type LoanPaymentDoc = {
  _id: string;
  loanId: string;
  memberId: string;
  monthIndex: number;
  dueDate: Date;
  baseAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  totalDue: number;
  paidAmount: number;
  status: string;
  source: string;
  utr?: string;
  method?: string;
  paidAt?: Date;
};

export async function GET(req: NextRequest) {
  await dbConnect();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // ---------- DETAILS (for modal) ----------
  if (id) {
    const loanDoc = await Loan.findById(id).lean<LoanDoc | null>();
    if (!loanDoc) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    const payments = await LoanPayment.find({ loanId: id })
      .sort({ monthIndex: 1 })
      .lean<LoanPaymentDoc[]>();

    const schedule: LoanScheduleItem[] = buildLoanSchedule({
      principal: loanDoc.principal,
      tenureMonths: loanDoc.tenureMonths,
      monthlyInterestRate: loanDoc.monthlyInterestRate,
      installmentAmount: loanDoc.installmentAmount,
      startDate: loanDoc.startDate,
      dueDayOfMonth: loanDoc.dueDayOfMonth,
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
      loan: {
        ...loanDoc,
        _id: String(loanDoc._id),
        status: loanDoc.status ?? "active",
      },
      schedule,
      payments: paymentsWithPenalty,
    });
  }

  // ---------- LIST ----------
  const loanDocs = await Loan.find().lean<LoanDoc[]>();
  const loans = loanDocs.map((l) => ({
    _id: String(l._id),
    memberId: l.memberId,
    principal: l.principal,
    monthlyInterestRate: l.monthlyInterestRate,
    tenureMonths: l.tenureMonths,
    dueDayOfMonth: l.dueDayOfMonth,
    penaltyRate: l.penaltyRate,
    installmentAmount: l.installmentAmount,
    status: l.status ?? "active",
  }));

  return NextResponse.json({
    success: true,
    loans,
  });
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = (await req
      .json()
      .catch(() => ({}))) as UnknownRecord;

    const memberId = String(body.memberId ?? "").trim();
    const principal = Number(body.principal ?? 0);
    const monthlyInterestRate = Number(
      body.monthlyInterestRate ?? 0,
    );
    const tenureMonths = Number(body.tenureMonths ?? 0);
    const dueDayOfMonth = Number(body.dueDayOfMonth ?? 10);
    const penaltyRate = Number(body.penaltyRate ?? 0);
    const startDateStr =
      typeof body.startDate === "string"
        ? body.startDate
        : undefined;

    if (
      !memberId ||
      principal <= 0 ||
      monthlyInterestRate < 0 ||
      tenureMonths <= 0 ||
      dueDayOfMonth <= 0 ||
      penaltyRate < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "memberId, principal, monthlyInterestRate, tenureMonths, dueDayOfMonth, penaltyRate required",
        },
        { status: 400 },
      );
    }

    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date();

    const { emi } = calculateInstallment(
      principal,
      tenureMonths,
      monthlyInterestRate,
    );

    const created = await Loan.create({
      memberId,
      principal,
      monthlyInterestRate,
      tenureMonths,
      dueDayOfMonth,
      penaltyRate,
      installmentAmount: emi,
      startDate,
      status: "active",
    });

    const schedule = buildLoanSchedule({
      principal,
      tenureMonths,
      monthlyInterestRate,
      installmentAmount: emi,
      startDate,
      dueDayOfMonth,
    });

    const bulk: UnknownRecord[] = [];

    for (const s of schedule) {
      bulk.push({
        loanId: created.id,
        memberId,
        monthIndex: s.monthIndex,
        dueDate: new Date(s.dueDate),
        baseAmount: s.baseAmount,
        interestAmount: s.interestAmount,
        penaltyAmount: 0,
        totalDue: s.emiAmount,
        paidAmount: 0,
        status: "pending",
        source: "admin",
      });
    }

    if (bulk.length) {
      await LoanPayment.insertMany(bulk);
    }

    return NextResponse.json({
      success: true,
      loan: {
        ...created.toObject(),
        _id: String(created._id),
        status: created.status ?? "active",
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/admin/loans error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to create loan",
      },
      { status: 500 },
    );
  }
}
