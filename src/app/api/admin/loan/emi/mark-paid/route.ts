import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import LoanTransaction from "@/app/models/LoanTransaction";
import { verifyToken } from "@/app/lib/jwt";

type CollectBody = {
  loanId?: string;
  monthNumber?: number;
  amount?: number;
  paymentMode?: "CASH" | "UPI";
  utrNumber?: string;
};

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    map[k.trim()] = decodeURIComponent((v || []).join("=").trim());
  });
  return map;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function PATCH(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies["adminToken"];

    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(token) as { id?: string; role?: string } | null;
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as CollectBody;
    const loanId = String(body.loanId ?? "");
    const monthNumber = Number(body.monthNumber ?? 0);
    const paymentMode = String(body.paymentMode ?? "CASH").toUpperCase() as "CASH" | "UPI";
    const amount = toNum(body.amount ?? 0);
    const utrNumber = String(body.utrNumber ?? "").trim();

    if (!loanId || !Number.isFinite(monthNumber) || monthNumber <= 0) {
      return NextResponse.json(
        { success: false, message: "loanId and valid monthNumber are required" },
        { status: 400 }
      );
    }

    if (!["CASH", "UPI"].includes(paymentMode)) {
      return NextResponse.json(
        { success: false, message: "paymentMode must be CASH or UPI" },
        { status: 400 }
      );
    }

    if (paymentMode === "UPI" && !utrNumber) {
      return NextResponse.json(
        { success: false, message: "UTR number is required for UPI payments" },
        { status: 400 }
      );
    }

    await dbConnect();

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    const scheduleItem = loan.schedule.find((item: unknown) => {
      const rec = item as Record<string, unknown>;
      return Number(rec.monthNumber ?? 0) === monthNumber;
    });

    if (!scheduleItem) {
      return NextResponse.json(
        { success: false, message: "EMI schedule item not found" },
        { status: 404 }
      );
    }

    const emiAmount = toNum(scheduleItem.emiAmount);
    const alreadyPaid = toNum(scheduleItem.paidAmount);
    const pending = Math.max(0, emiAmount - alreadyPaid);

    if (pending <= 0 || scheduleItem.status === "paid") {
      return NextResponse.json(
        { success: false, message: "EMI is already fully paid" },
        { status: 400 }
      );
    }

    const collectAmount = amount > 0 ? amount : pending;
    if (collectAmount <= 0 || collectAmount > pending) {
      return NextResponse.json(
        { success: false, message: `Invalid amount. Pending amount is ${pending}` },
        { status: 400 }
      );
    }

    const dueDate = new Date(scheduleItem.dueDate);
    const now = new Date();
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    if (now < dueDate) {
      return NextResponse.json(
        { success: false, message: `EMI cannot be collected before due date (${dueDate.toLocaleDateString("en-IN")})` },
        { status: 400 }
      );
    }

    const newPaid = alreadyPaid + collectAmount;
    const newStatus = newPaid >= emiAmount ? "paid" : "pending";

    scheduleItem.paidAmount = newPaid;
    scheduleItem.status = newStatus;
    scheduleItem.paymentMode = paymentMode;
    scheduleItem.paymentDate = new Date();
    scheduleItem.transactionId = `ADMIN-${Date.now()}`;
    scheduleItem.utrNumber = paymentMode === "UPI" ? utrNumber : null;

    if (newStatus === "paid") {
      const nextUnpaid = loan.schedule.find((item: unknown) => {
        const rec = item as Record<string, unknown>;
        return String(rec.status ?? "") !== "paid" && Number(rec.monthNumber ?? 0) > monthNumber;
      });
      loan.nextEMIDueDate = nextUnpaid ? nextUnpaid.dueDate : null;
    }

    await loan.save();

    await LoanTransaction.create({
      userId: loan.userId,
      loanId,
      loanName: loan.memberName || `Loan ${loanId}`,
      emiMonth: monthNumber,
      amount: collectAmount,
      paymentMethod: paymentMode,
      transactionType: "EMI Payment",
      status: "Paid",
      utr: paymentMode === "UPI" ? utrNumber : undefined,
      referenceId: scheduleItem.transactionId,
      transactionDate: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "EMI collected successfully",
      updatedEmi: {
        monthNumber,
        emiAmount,
        paidAmount: newPaid,
        status: newStatus,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/loan/emi/mark-paid error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
