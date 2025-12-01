// app/api/admin/transactions/route.ts
import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import Group from "@/app/models/ChitGroup";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const groupId = url.searchParams.get("groupId") ?? undefined;
    const memberId = url.searchParams.get("memberId") ?? undefined;

    const q: Record<string, string | undefined> = { status: "pending" };
    if (groupId) q.groupId = groupId;
    if (memberId) q.memberId = memberId;

    // newest first
    const payments = await Payment.find(q).sort({ createdAt: -1 }).lean();

    // ensure each payment has memberName (if not, try to fill from embedded member)
    const normalized = payments.map((p: Record<string, unknown>) => ({
      ...p,
      memberName: p.memberName ?? (p.member && (p.member as Record<string, unknown>).name) ?? undefined,
      allocationSummary: (p.rawMeta as Record<string, unknown>)?.allocationSummary ?? (p as Record<string, unknown>).appliedAllocation ?? undefined,
    }));

    return NextResponse.json({ success: true, payments: normalized });
  } catch (err) {
    console.error("GET /api/admin/transactions error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const paymentId = String(body.paymentId ?? "");
    const approve = body.approve === true;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote : "";

    if (!paymentId) return NextResponse.json({ success: false, error: "paymentId required" }, { status: 400 });

    const payment = await Payment.findById(paymentId);
    if (!payment) return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });

    if (!approve) {
      payment.status = "rejected";
      payment.adminNote = adminNote || "Rejected by admin";
      await payment.save();
      return NextResponse.json({ success: true, payment });
    }

    // Approve flow
    if (payment.status === "approved") {
      // already approved
      return NextResponse.json({ success: true, payment, message: "Already approved" });
    }

    payment.status = "approved";
    payment.approvedAt = new Date();
    payment.adminNote = adminNote || "Approved by admin";
    await payment.save();

    const amount = Number(payment.amount ?? 0) || 0;
    const groupId = String(payment.groupId ?? "");
    if (amount > 0 && groupId) {
      // atomic increment
      await Group.findByIdAndUpdate(groupId, { $inc: { collectedAmount: amount } }).lean();
    }

    return NextResponse.json({ success: true, payment });
  } catch (err) {
    console.error("POST /api/admin/transactions error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
