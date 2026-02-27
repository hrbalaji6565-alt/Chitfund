import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import Payment from "@/app/models/Payment";
import LoanTransaction from "@/app/models/LoanTransaction";
import Member from "@/app/models/Member";
import { verifyToken } from "@/app/lib/jwt";
import { calculateEndDate, generateEMISchedule } from "@/app/lib/loanUtils";
import mongoose from "mongoose";

type UnknownRecord = Record<string, unknown>;

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    const raw = (v || []).join("=").trim();
    try {
      map[k.trim()] = decodeURIComponent(raw);
    } catch {
      map[k.trim()] = raw;
    }
  });
  return map;
}

async function resolveParams(context: unknown): Promise<{ loanId: string }> {
  if (!context || typeof context !== "object") {
    throw new Error("Missing route context");
  }
  const ctx = context as Record<string, unknown>;
  const raw = ctx.params as unknown;
  const params = raw instanceof Promise ? await raw : raw;

  if (
    !params ||
    typeof params !== "object" ||
    !("loanId" in (params as Record<string, unknown>))
  ) {
    throw new Error("Missing params.loanId");
  }

  const loanId = String((params as Record<string, unknown>).loanId);
  return { loanId };
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function monthLabelFromDueDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleString("en-US", { month: "long" })} ${d.getFullYear()}`;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateValue(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getAdminFromReq(req: NextRequest): { ok: true } | { ok: false; res: NextResponse } {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies["adminToken"];

  if (!token) {
    return {
      ok: false,
      res: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
    };
  }

  let decoded: unknown = null;
  try {
    decoded = verifyToken(token);
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!decoded || typeof decoded !== "object" || (decoded as { role?: unknown }).role !== "admin") {
    return {
      ok: false,
      res: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}

export async function GET(req: NextRequest, context: unknown) {
  try {
    const auth = getAdminFromReq(req);
    if (!auth.ok) return auth.res;

    const { loanId } = await resolveParams(context);
    if (!isValidObjectId(loanId)) {
      return NextResponse.json({ success: false, message: "Invalid loan ID" }, { status: 400 });
    }

    await dbConnect();

    const loan = await Loan.findById(loanId).lean();

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    const loanRec = loan as unknown as UnknownRecord;
    const memberId = loanRec.userId;
    const memberIdStr = memberId ? String(memberId) : "";
    const member = memberIdStr && isValidObjectId(memberIdStr)
      ? await Member.findById(memberIdStr).select("_id name userId mobile").lean()
      : null;
    const memberObj = (member as unknown as UnknownRecord | null) ?? null;

    const allPayments = memberIdStr
      ? await Payment.find({
        memberId: isValidObjectId(memberIdStr)
          ? { $in: [memberIdStr, new mongoose.Types.ObjectId(memberIdStr)] }
          : memberIdStr,
        status: { $in: ["approved", "submitted"] },
      })
          .select("allocated approvedAt createdAt")
          .lean()
      : [];

    const paymentMap = new Map<string, { amount: number; date: string | null }>();

    for (const payment of allPayments as UnknownRecord[]) {
      const allocated = Array.isArray(payment.allocated) ? payment.allocated : [];

      for (const allocationRaw of allocated) {
        if (!allocationRaw || typeof allocationRaw !== "object") continue;
        const allocation = allocationRaw as UnknownRecord;
        const allocLoanId = allocation.loanId ? String(allocation.loanId) : "";
        const allocMonth = Number(allocation.monthNumber ?? 0);
        if (!allocLoanId || allocLoanId !== loanId || !allocMonth) continue;

        const key = String(allocMonth);
        const existing = paymentMap.get(key) ?? { amount: 0, date: null };
        const allocAmount = Number(allocation.amount ?? 0);
        const paymentDate = toIso(payment.approvedAt) ?? toIso(payment.createdAt);
        paymentMap.set(key, {
          amount: existing.amount + (Number.isFinite(allocAmount) ? allocAmount : 0),
          date: existing.date ?? paymentDate,
        });
      }
    }

    const schedule = Array.isArray(loanRec.schedule) ? loanRec.schedule : [];
    const now = new Date();
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const processedSchedule = schedule.map((emiRaw) => {
      const emi = (emiRaw && typeof emiRaw === "object") ? (emiRaw as UnknownRecord) : {};

      const monthNumber = Number(emi.monthNumber ?? 0);
      const emiAmount = Number(emi.emiAmount ?? 0);
      const dueIso = toIso(emi.dueDate);
      const dueDateObj = dueIso ? new Date(dueIso) : null;
      const dueDateStart = dueDateObj
        ? new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate())
        : null;

      const isOverdue = dueDateStart ? dueDateStart < nowStart : false;

      const paymentInfo = paymentMap.get(String(monthNumber)) ?? { amount: 0, date: null };
      const paidAmount = Number(emi.paidAmount ?? 0) + paymentInfo.amount;

      const rawStatus = String(emi.status ?? "pending").toLowerCase();
      let status: "paid" | "pending" = rawStatus === "paid" || paidAmount >= emiAmount ? "paid" : "pending";

      const basePenalty = Number(emi.penalty ?? 0);
      const penalty = isOverdue && status !== "paid" ? emiAmount * 0.02 : basePenalty;
      const totalDue = emiAmount + penalty;

      if (status !== "paid" && paidAmount >= totalDue) {
        status = "paid";
      }

      return {
        monthNumber,
        monthName: monthLabelFromDueDate(dueIso),
        dueDate: dueIso,
        emiAmount,
        penalty,
        totalDue,
        paidAmount,
        status,
        paymentDate: paymentInfo.date,
      };
    });

    processedSchedule.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.monthNumber - b.monthNumber;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const totalCount = processedSchedule.length;
    const paidCount = processedSchedule.filter((s) => s.status === "paid").length;
    const overallStatus = totalCount > 0 && paidCount === totalCount
      ? "completed"
      : paidCount > 0
        ? "in_progress"
        : "active";

    const formattedLoan = {
      _id: String(loanRec._id ?? ""),
      memberId: memberIdStr,
      memberName: String(loanRec.memberName ?? memberObj?.name ?? "Unknown"),
      memberUserId: String(memberObj?.userId ?? ""),
      memberMobile: String(memberObj?.mobile ?? ""),
      principal: Number(loanRec.principal ?? 0),
      monthlyInterestPercent: Number(loanRec.monthlyInterestPercent ?? 0),
      durationMonths: Number(loanRec.durationMonths ?? 0),
      durationType: String(loanRec.durationType ?? "MONTHS"),
      durationValue: Number(loanRec.durationValue ?? loanRec.durationMonths ?? 0),
      startDate: toIso(loanRec.startDate),
      endDate: toIso(loanRec.endDate),
      nextEMIDueDate: toIso(loanRec.nextEMIDueDate),
      emiAmount: Number(loanRec.emiAmount ?? 0),
      schedule: processedSchedule,
      status: overallStatus,
      createdAt: toIso(loanRec.createdAt),
      updatedAt: toIso(loanRec.updatedAt),
    };

    return NextResponse.json({ success: true, loan: formattedLoan });
  } catch (err) {
    console.error("GET /api/admin/loan/[loanId] error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: unknown) {
  try {
    const auth = getAdminFromReq(req);
    if (!auth.ok) return auth.res;

    const { loanId } = await resolveParams(context);
    if (!isValidObjectId(loanId)) {
      return NextResponse.json({ success: false, message: "Invalid loan ID" }, { status: 400 });
    }

    await dbConnect();

    const deleted = await Loan.findByIdAndDelete(loanId);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    await LoanTransaction.deleteMany({
      $or: [
        { loanId },
        { loanId: new mongoose.Types.ObjectId(loanId) },
      ],
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Loan deleted successfully" });
  } catch (err) {
    console.error("DELETE /api/admin/loan/[loanId] error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: unknown) {
  try {
    const auth = getAdminFromReq(req);
    if (!auth.ok) return auth.res;

    const { loanId } = await resolveParams(context);
    if (!isValidObjectId(loanId)) {
      return NextResponse.json({ success: false, message: "Invalid loan ID" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const principal = toNumber(body.amount ?? body.principal);
    const monthlyInterestPercent = toNumber(body.monthlyInterestPercent);
    const durationType = String(body.durationType ?? "MONTHS").toUpperCase() === "DAYS" ? "DAYS" : "MONTHS";
    const durationValue = Math.max(1, Math.round(toNumber(body.durationValue ?? body.durationMonths)));
    const emiAmount = toNumber(body.emiAmount);
    const startDateRaw = String(body.startDate ?? "");

    if (!startDateRaw || !Number.isFinite(principal) || principal <= 0) {
      return NextResponse.json({ success: false, message: "Valid principal and startDate are required" }, { status: 400 });
    }
    if (!Number.isFinite(monthlyInterestPercent) || monthlyInterestPercent < 0) {
      return NextResponse.json({ success: false, message: "Invalid monthly interest percent" }, { status: 400 });
    }
    if (!Number.isFinite(emiAmount) || emiAmount <= 0) {
      return NextResponse.json({ success: false, message: "Invalid EMI amount" }, { status: 400 });
    }

    await dbConnect();

    const loanDoc = await Loan.findById(loanId);
    if (!loanDoc) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    const startDate = toDateValue(startDateRaw);
    if (!startDate) {
      return NextResponse.json({ success: false, message: "Invalid startDate" }, { status: 400 });
    }

    let endDate: Date | null = null;
    if (body.endDate) {
      endDate = toDateValue(body.endDate);
    }
    if (!endDate) {
      const endDateStr = calculateEndDate(
        startDate.toISOString().split("T")[0],
        durationType,
        durationValue,
      );
      endDate = toDateValue(endDateStr);
    }
    if (!endDate) {
      return NextResponse.json({ success: false, message: "Invalid endDate" }, { status: 400 });
    }

    const existingScheduleRaw = Array.isArray(loanDoc.schedule) ? loanDoc.schedule : [];
    const existingByMonth = new Map<number, UnknownRecord>();
    for (const item of existingScheduleRaw as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const rec = item as UnknownRecord;
      const monthNumber = Math.max(1, Math.round(toNumber(rec.monthNumber)));
      existingByMonth.set(monthNumber, rec);
    }

    const freshSchedule = generateEMISchedule(
      startDate.toISOString().split("T")[0],
      durationType,
      durationValue,
      emiAmount,
    );

    const mergedSchedule = freshSchedule.map((row) => {
      const old = existingByMonth.get(Math.max(1, Math.round(toNumber(row.monthNumber))));
      const oldPaid = old ? toNumber(old.paidAmount) : 0;
      const oldPenalty = old ? toNumber(old.penalty) : 0;
      const oldStatus = old ? String(old.status ?? "pending").toLowerCase() : "pending";
      const effectiveStatus =
        oldStatus === "paid" || oldPaid >= toNumber(row.emiAmount) ? "paid" : "pending";

      return {
        monthNumber: Math.max(1, Math.round(toNumber(row.monthNumber))),
        emiAmount: toNumber(row.emiAmount),
        dueDate: toDateValue(row.dueDate) ?? row.dueDate,
        penalty: oldPenalty > 0 ? oldPenalty : 0,
        paidAmount: oldPaid > 0 ? oldPaid : 0,
        status: effectiveStatus,
        paymentMode: old?.paymentMode ?? null,
        paymentDate: old?.paymentDate ?? null,
        transactionId: old?.transactionId ?? null,
        utrNumber: old?.utrNumber ?? null,
      };
    });

    const nextPending = mergedSchedule
      .filter((item) => String(item.status) !== "paid")
      .sort((a, b) => new Date(String(a.dueDate)).getTime() - new Date(String(b.dueDate)).getTime())[0];

    loanDoc.principal = principal;
    loanDoc.monthlyInterestPercent = monthlyInterestPercent;
    loanDoc.durationType = durationType;
    loanDoc.durationValue = durationValue;
    loanDoc.durationMonths = durationType === "MONTHS" ? durationValue : 1;
    loanDoc.startDate = startDate;
    loanDoc.endDate = endDate;
    loanDoc.emiAmount = emiAmount;
    loanDoc.schedule = mergedSchedule;
    loanDoc.nextEMIDueDate = nextPending ? new Date(String(nextPending.dueDate)) : null;

    await loanDoc.save();

    return NextResponse.json({
      success: true,
      message: "Loan updated successfully",
      loanId,
    });
  } catch (err) {
    console.error("PUT /api/admin/loan/[loanId] error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
