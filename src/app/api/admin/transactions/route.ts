// app/api/admin/transactions/route.ts
import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import Group from "@/app/models/ChitGroup";
import Member from "@/app/models/Member";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const groupId = url.searchParams.get("groupId") ?? undefined;
    const memberId = url.searchParams.get("memberId") ?? undefined;
    const collectedById = url.searchParams.get("collectedById") ?? undefined;
    const qParam = (url.searchParams.get("q") ?? "").trim();

    // allow status=all, default pending
    const statusParam = url.searchParams.get("status") ?? "pending";

    const pageParam = Number(url.searchParams.get("page") ?? "");
    const limitParam = Number(url.searchParams.get("limit") ?? "");
    const shouldPaginate =
      Number.isFinite(pageParam) &&
      pageParam > 0 &&
      Number.isFinite(limitParam) &&
      limitParam > 0;

    const page = shouldPaginate ? Math.floor(pageParam) : 1;
    const limit = shouldPaginate ? Math.min(100, Math.floor(limitParam)) : 0;

    const q: Record<string, unknown> = {};
    if (statusParam !== "all") {
      q.status = statusParam;
    }
    if (groupId) q.groupId = groupId;
    if (memberId) q.memberId = memberId;
    if (collectedById) q["rawMeta.collectedById"] = collectedById;
    if (qParam) {
      const escaped = qParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      const [memberMatches, groupMatches] = await Promise.all([
        Member.find({
          $or: [
            { name: rx },
            { userId: rx },
            { mobile: rx },
            { groupName: rx },
          ],
        })
          .select("_id")
          .limit(100)
          .lean(),
        Group.find({ name: rx }).select("_id").limit(100).lean(),
      ]);

      const memberIds = memberMatches.map((m) => String(m._id));
      const groupIds = groupMatches.map((g) => String(g._id));
      const isObjectId = /^[a-fA-F0-9]{24}$/.test(qParam);
      const amountValue = Number(qParam);

      const orFilters: Record<string, unknown>[] = [
        { memberName: rx },
        { groupName: rx },
        { utr: rx },
        { reference: rx },
        { adminNote: rx },
        { "rawMeta.memberName": rx },
        { "rawMeta.groupName": rx },
        { "rawMeta.collectorName": rx },
      ];

      if (memberIds.length > 0) {
        orFilters.push({ memberId: { $in: memberIds } });
      }
      if (groupIds.length > 0) {
        orFilters.push({ groupId: { $in: groupIds } });
      }
      if (isObjectId) {
        orFilters.push({ _id: qParam });
        orFilters.push({ memberId: qParam });
        orFilters.push({ groupId: qParam });
      }
      if (Number.isFinite(amountValue)) {
        orFilters.push({ amount: amountValue });
      }

      q.$or = orFilters;
    }

    let payments: Record<string, unknown>[] = [];
    let total = 0;

    if (shouldPaginate) {
      total = await Payment.countDocuments(q);
      payments = (await Payment.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()) as Record<string, unknown>[];
    } else {
      payments = (await Payment.find(q).sort({ createdAt: -1 }).lean()) as Record<
        string,
        unknown
      >[];
      total = payments.length;
    }

    const normalized = payments.map((p: Record<string, unknown>) => ({
      ...p,
      memberName:
        p.memberName ??
        (p.member && (p.member as Record<string, unknown>).name) ??
        undefined,
      allocationSummary:
        (p.rawMeta as Record<string, unknown>)?.allocationSummary ??
        (p as Record<string, unknown>).appliedAllocation ??
        undefined,
    }));

    if (!shouldPaginate) {
      return NextResponse.json({ success: true, payments: normalized });
    }

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      payments: normalized,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/transactions error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
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

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const paymentId = String(body.paymentId ?? "");

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId required" },
        { status: 400 },
      );
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    const amount = Number(payment.amount ?? 0) || 0;
    const groupId = String(payment.groupId ?? "");

    // IMPORTANT: if approved, reverse group collected amount
    if (payment.status === "approved" && amount > 0 && groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $inc: { collectedAmount: -amount },
      }).lean();
    }

    await Payment.findByIdAndDelete(paymentId);

    return NextResponse.json({
      success: true,
      message:
        payment.status === "approved"
          ? "Approved payment deleted and collection reversed"
          : "Payment deleted",
    });
  } catch (err) {
    console.error("DELETE /api/admin/transactions error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
