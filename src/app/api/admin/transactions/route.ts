// app/api/admin/transactions/route.ts
import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import Group from "@/app/models/ChitGroup";
import Member from "@/app/models/Member";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseAllocationSummary = (input: unknown): Array<{
  monthIndex?: number;
  amount?: number;
  penaltyApplied?: number;
}> => {
  let raw: unknown = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = undefined;
    }
  }

  let sourceArray: unknown[] | null = null;
  if (Array.isArray(raw)) {
    sourceArray = raw;
  } else if (isRecord(raw)) {
    const maybe = raw.allocation ?? raw.alloc ?? raw.allocationSummary;
    if (Array.isArray(maybe)) sourceArray = maybe;
  }

  if (!sourceArray) return [];

  return sourceArray
    .map((it) => {
      if (!isRecord(it)) return null;
      const monthIndex = toNumber(it.monthIndex);
      const amount =
        typeof it.amount === "number"
          ? it.amount
          : typeof it.principalPaid === "number"
            ? it.principalPaid
            : typeof it.apply === "number"
              ? it.apply
              : undefined;
      const penaltyApplied =
        typeof it.penaltyApplied === "number"
          ? it.penaltyApplied
          : typeof it.penaltyPaid === "number"
            ? it.penaltyPaid
            : 0;
      return {
        monthIndex: Number.isFinite(monthIndex) ? Math.round(monthIndex) : undefined,
        amount: Number.isFinite(Number(amount)) ? Number(amount) : undefined,
        penaltyApplied: Number.isFinite(Number(penaltyApplied)) ? Number(penaltyApplied) : 0,
      };
    })
    .filter((x): x is { monthIndex?: number; amount?: number; penaltyApplied?: number } => x !== null);
};

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

export async function PATCH(req: NextRequest) {
  try {
    await dbConnect();
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const paymentId = String(body.paymentId ?? "");
    const amountRaw = body.amount;
    const memberSlotIdRaw = body.memberSlotId ?? body.slotId;
    const referenceRaw = body.reference ?? body.utr ?? body.txn ?? body.txnid;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote : undefined;
    const allocationSummaryRaw = body.allocationSummary ?? body.rawMeta;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: "paymentId required" }, { status: 400 });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ success: false, error: "Only pending payments can be edited" }, { status: 400 });
    }

    if (amountRaw !== undefined) {
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
      }
      payment.amount = amount;
    }

    if (memberSlotIdRaw !== undefined) {
      const memberSlotId = String(memberSlotIdRaw ?? "");
      if (!memberSlotId) {
        payment.memberSlotId = undefined;
      } else {
        const groupDoc = await Group.findById(payment.groupId).lean();
        const slots = normalizeGroupMemberSlots((groupDoc as UnknownRecord | null)?.members);
        const slotAllowed = slots.some(
          (s) => String(s.slotId) === memberSlotId && String(s.memberId) === String(payment.memberId),
        );
        if (!slotAllowed) {
          return NextResponse.json({ success: false, error: "Invalid member slot for this group/member" }, { status: 400 });
        }
        payment.memberSlotId = memberSlotId;
      }
    }

    if (referenceRaw !== undefined) {
      const ref = String(referenceRaw ?? "");
      payment.reference = ref || undefined;
      payment.utr = ref || undefined;
    }
    if (adminNote !== undefined) {
      payment.adminNote = adminNote;
    }

    if (allocationSummaryRaw !== undefined) {
      const allocated = parseAllocationSummary(allocationSummaryRaw);
      if (!allocated.length) {
        return NextResponse.json({ success: false, error: "Invalid allocationSummary" }, { status: 400 });
      }
      payment.allocated = allocated.map((a) => ({
        monthIndex: a.monthIndex,
        amount: a.amount,
        penaltyApplied: a.penaltyApplied ?? 0,
      }));
      const rawMeta = (payment.rawMeta && isRecord(payment.rawMeta)) ? payment.rawMeta : {};
      payment.rawMeta = { ...rawMeta, allocationSummary: allocated };
    }

    await payment.save();
    return NextResponse.json({ success: true, payment });
  } catch (err) {
    console.error("PATCH /api/admin/transactions error:", err);
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
