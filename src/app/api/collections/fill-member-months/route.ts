import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";
import MemberLedger from "@/app/models/MemberLedger";
import Member from "@/app/models/Member";
import mongoose from "mongoose";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type AllocationInput = {
  monthIndex: number; // 1-based
  amount: number;
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json().catch(() => ({}))) as UnknownRecord;

    const groupId = String(body.groupId ?? "");

    // ✅ support single or multiple
    const memberIdsRaw =
      Array.isArray(body.memberIds)
        ? body.memberIds
        : body.memberId
        ? [body.memberId]
        : [];

    const allocationsRaw = body.allocations ?? body.months ?? [];

    const skipExisting =
      body.skipExisting === undefined ? true : Boolean(body.skipExisting);

    const forceLedgerDueAmount =
      body.forceLedgerDueAmount === undefined
        ? true
        : Boolean(body.forceLedgerDueAmount);

    if (!groupId || !memberIdsRaw.length) {
      return NextResponse.json(
        { success: false, error: "groupId and memberId(s) are required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json(
        { success: false, error: "Invalid groupId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(allocationsRaw) || !allocationsRaw.length) {
      return NextResponse.json(
        { success: false, error: "allocations array is required" },
        { status: 400 }
      );
    }

    const group = (await Group.findById(groupId).lean()) as
      | UnknownRecord
      | null;

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 }
      );
    }

    const totalMonths = Math.max(1, toNumber(group.totalMonths));
    const startDate = new Date(
      typeof group.startDate === "string" ? group.startDate : new Date()
    );

    const allocations: AllocationInput[] = allocationsRaw
      .filter(isRecord)
      .map((a) => ({
        monthIndex: Math.max(1, Math.round(toNumber(a.monthIndex))),
        amount: toNumber(a.amount),
      }))
      .filter((a) => a.monthIndex >= 1 && a.amount > 0)
      .map((a) => ({
        ...a,
        monthIndex: Math.min(a.monthIndex, totalMonths),
      }))
      .sort((a, b) => a.monthIndex - b.monthIndex);

    if (!allocations.length) {
      return NextResponse.json(
        { success: false, error: "No valid allocations found" },
        { status: 400 }
      );
    }

    let globalCreated = 0;
    let globalSkippedExisting = 0;
    let globalSkippedZero = 0;
    let globalUpdatedLedger = 0;

    // 🔁 LOOP MEMBERS
    for (const rawMemberId of memberIdsRaw) {
      const memberId = String(rawMemberId);

      if (!mongoose.Types.ObjectId.isValid(memberId)) continue;

      let memberTotalAmount = 0;

      for (const alloc of allocations) {
        const month = alloc.monthIndex;
        const amount = alloc.amount;

        if (!amount || amount <= 0) {
          globalSkippedZero++;
          continue;
        }

        if (skipExisting) {
          const existingPayment = await Payment.findOne({
            groupId,
            memberId,
            status: "approved",
            $or: [
              { "allocated.monthIndex": month },
              { "allocated.monthIndex": Math.max(0, month - 1) },
              { "allocation.monthIndex": month },
              { "rawMeta.allocationDetails.monthIndex": month },
              { "rawMeta.allocationSummary.monthIndex": month },
              { "rawMeta.monthIndex": month },
            ],
          }).select("_id");

          if (existingPayment) {
            globalSkippedExisting++;
            continue;
          }
        }

        const approvedDate = new Date(startDate);
        approvedDate.setMonth(startDate.getMonth() + (month - 1));

        const payment = await Payment.create({
          memberId: new mongoose.Types.ObjectId(memberId),
          groupId: new mongoose.Types.ObjectId(groupId),
          amount,
          type: "CASH",
          status: "approved",
          approvedAt: approvedDate,
          allocated: [
            {
              monthIndex: Math.max(0, month - 1),
              amount,
              penaltyApplied: 0,
            },
          ],
          allocationDetails: [
            {
              monthIndex: month,
              principalPaid: amount,
              penaltyPaid: 0,
            },
          ],
          rawMeta: {
            collectedVia: "bulk-fill-member",
            monthIndex: month,
            allocationDetails: [
              {
                monthIndex: month,
                principalPaid: amount,
                penaltyPaid: 0,
              },
            ],
            paymentKind: "backfill",
          },
        });

        globalCreated++;
        memberTotalAmount += amount;

        const ledgerMonthIdx = Math.max(0, month - 1);

        const ledger = await MemberLedger.findOne({
          memberId,
          groupId,
          monthIndex: ledgerMonthIdx,
        });

        if (ledger) {
          ledger.paidAmount = amount;
          ledger.penaltyAmount = 0;
          if (forceLedgerDueAmount) {
            ledger.dueAmount = amount;
          }
          ledger.status = "Paid";
          await ledger.save();

          await MemberLedger.findByIdAndUpdate(ledger._id, {
            $addToSet: { payments: payment._id },
          }).catch(() => {});

          globalUpdatedLedger++;
        }
      }

      if (memberTotalAmount > 0) {
        await Member.findByIdAndUpdate(memberId, {
          $inc: {
            totalPaid: memberTotalAmount,
            pendingAmount: -memberTotalAmount,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: "Bulk member backfill completed",
      totalCreated: globalCreated,
      skippedExisting: globalSkippedExisting,
      skippedZero: globalSkippedZero,
      updatedLedger: globalUpdatedLedger,
    });
  } catch (error) {
    console.error("POST /api/collections/fill-member-months error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }
}
