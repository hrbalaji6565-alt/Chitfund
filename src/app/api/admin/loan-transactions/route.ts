import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import LoanTransaction from "@/app/models/LoanTransaction";
import Loan from "@/app/models/loanModel";
import Member from "@/app/models/Member";
import mongoose from "mongoose";

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

function getAdminToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.replace("Bearer ", "").trim();
  const cookies = parseCookies(req.headers.get("cookie"));
  return cookies.adminToken || "";
}

function isAdmin(req: Request) {
  const token = getAdminToken(req);
  if (!token) return false;
  let decoded: { id?: string; role?: string } | null = null;
  try {
    decoded = verifyToken(token) as { id?: string; role?: string } | null;
  } catch {
    return false;
  }
  return Boolean(decoded?.id && decoded?.role === "admin");
}

export async function GET(req: Request) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ success: false, message: "Invalid admin token" }, { status: 401 });
    }

    await dbConnect();

    const url = new URL(req.url);
    const memberIdParam = url.searchParams.get("memberId") ?? "";

    const query: Record<string, unknown> = {};
    if (memberIdParam) {
      if (mongoose.Types.ObjectId.isValid(memberIdParam)) {
        query.$or = [
          { userId: memberIdParam },
          { userId: new mongoose.Types.ObjectId(memberIdParam) },
        ];
      } else {
        query.userId = memberIdParam;
      }
    }

    const transactions = await LoanTransaction.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const uniqueUserIds = Array.from(
      new Set(
        transactions
          .map((tx) => String(tx.userId ?? ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      )
    );

    const members = uniqueUserIds.length
      ? await Member.find({ _id: { $in: uniqueUserIds } })
          .select("_id name userId")
          .lean()
      : [];

    const memberMap = new Map(
      members.map((m) => [
        String((m as unknown as Record<string, unknown>)._id ?? ""),
        m as unknown as Record<string, unknown>,
      ])
    );

    const formattedTransactions = transactions.map((transaction) => {
      const member = memberMap.get(String(transaction.userId ?? ""));
      return {
        _id: transaction._id,
        userName: String(member?.name ?? "Unknown User"),
        userIdField: String(member?.userId ?? "Unknown"),
        loanId: String(transaction.loanId ?? ""),
        loanName: transaction.loanName || `Loan ${transaction.loanId}`,
        emiMonth: Number(transaction.emiMonth ?? 0),
        amount: Number(transaction.amount ?? 0),
        paymentMethod: transaction.paymentMethod || "UNKNOWN",
        status: transaction.status || "Unknown",
        utr: transaction.utr || transaction.referenceId || "-",
        date: transaction.createdAt || transaction.transactionDate,
      };
    });

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error("Error fetching admin loan transactions:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loan transactions" },
      { status: 500 }
    );
  }
}

type PatchBody = {
  transactionId?: string;
  action?: "approve" | "reject";
};

export async function PATCH(req: Request) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ success: false, message: "Invalid admin token" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchBody;
    const transactionId = String(body.transactionId ?? "");
    const action = String(body.action ?? "").toLowerCase();

    if (!transactionId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "transactionId and valid action are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    const tx = await LoanTransaction.findById(transactionId);
    if (!tx) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 });
    }

    if (tx.status === "Paid") {
      return NextResponse.json({ success: false, message: "Transaction already approved" }, { status: 409 });
    }
    if (tx.status === "Failed") {
      return NextResponse.json({ success: false, message: "Transaction already rejected" }, { status: 409 });
    }

    if (action === "reject") {
      tx.status = "Failed";
      await tx.save();
      return NextResponse.json({ success: true, message: "Payment rejected successfully" });
    }

    const loanId = String(tx.loanId);
    const monthNumber = Number(tx.emiMonth);
    const amount = Number(tx.amount ?? 0);

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
    if (!schedule.length) {
      return NextResponse.json({ success: false, message: "Loan EMI schedule is missing" }, { status: 409 });
    }

    const scheduleItem = schedule.find((item: unknown) => {
      const rec = item as Record<string, unknown>;
      return Number(rec.monthNumber ?? 0) === monthNumber;
    });

    if (!scheduleItem) {
      return NextResponse.json({ success: false, message: "EMI schedule item not found" }, { status: 404 });
    }

    const emiAmount = Number(scheduleItem.emiAmount ?? 0);
    const alreadyPaid = Number(scheduleItem.paidAmount ?? 0);
    const remaining = Math.max(0, emiAmount - alreadyPaid);

    if (remaining <= 0 || scheduleItem.status === "paid") {
      tx.status = "Paid";
      await tx.save();
      return NextResponse.json({ success: true, message: "EMI already completed", alreadyCompleted: true });
    }

    const amountToApply = Math.min(remaining, Math.max(0, amount));
    if (amountToApply <= 0) {
      return NextResponse.json({ success: false, message: "Invalid transaction amount" }, { status: 400 });
    }

    const newPaid = alreadyPaid + amountToApply;
    const newStatus = newPaid >= emiAmount ? "paid" : "pending";

    scheduleItem.paidAmount = newPaid;
    scheduleItem.status = newStatus;
    scheduleItem.paymentMode = tx.paymentMethod;
    scheduleItem.paymentDate = new Date();
    scheduleItem.transactionId = tx.referenceId || `ADMIN-${Date.now()}`;
    scheduleItem.utrNumber = tx.paymentMethod === "UPI" ? tx.utr || null : null;

    if (newStatus === "paid") {
      const nextUnpaid = schedule.find((item: unknown) => {
        const rec = item as Record<string, unknown>;
        return String(rec.status ?? "") !== "paid" && Number(rec.monthNumber ?? 0) > monthNumber;
      });
      loan.nextEMIDueDate = nextUnpaid ? nextUnpaid.dueDate : null;
    }

    await loan.save();

    tx.status = "Paid";
    tx.transactionDate = new Date();
    await tx.save();

    return NextResponse.json({
      success: true,
      message: "Payment approved and EMI updated successfully",
      updatedEmi: {
        monthNumber,
        emiAmount,
        paidAmount: newPaid,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error("Error updating admin loan transaction:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
