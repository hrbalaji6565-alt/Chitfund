import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";
import MemberLedger from "@/app/models/MemberLedger";
import Member from "@/app/models/Member";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";
import mongoose from "mongoose";

type UnknownRecord = Record<string, unknown>;

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type SlotRef = { memberId: string; slotId: string };

const computePerMemberInstallment = (
  g: UnknownRecord,
  totalMembers: number,
): number => {
  const monthlyFromModel = toNumber(g.monthlyInstallment);
  if (monthlyFromModel > 0) return Math.round(monthlyFromModel);

  const chitValue = toNumber(g.chitValue);
  const totalMonths = Math.max(1, toNumber(g.totalMonths));
  if (!chitValue || !totalMonths || totalMembers <= 0) return 0;

  const monthlyTotal = Math.round(chitValue / totalMonths);
  return Math.round(monthlyTotal / Math.max(1, totalMembers));
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const groupId = String(body.groupId ?? "");
    const tillMonthRaw = toNumber(body.tillMonth ?? 0);
    const tillMonth = Math.max(1, Math.round(tillMonthRaw));
    const memberSlotIdsRaw = Array.isArray(body.memberSlotIds)
      ? body.memberSlotIds
      : body.memberSlotId
        ? [body.memberSlotId]
        : [];
    const memberIdsRaw = Array.isArray(body.memberIds)
      ? body.memberIds
      : body.memberId
        ? [body.memberId]
        : [];

    if (!groupId || !tillMonth || tillMonth <= 0) {
      return NextResponse.json(
        { success: false, error: "groupId and valid tillMonth required" },
        { status: 400 }
      );
    }

    const group = (await Group.findById(groupId).lean()) as UnknownRecord | null;

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 }
      );
    }

    const slots = normalizeGroupMemberSlots(group.members);
    const slotIdFilter = new Set(
      memberSlotIdsRaw
        .map((x) => String(x ?? "").trim())
        .filter(Boolean),
    );
    const memberIdFilter = new Set(
      memberIdsRaw
        .map((x) => String(x ?? "").trim())
        .filter(Boolean),
    );
    const filteredSlots = slots.filter((s) => {
      if (slotIdFilter.size && slotIdFilter.has(String(s.slotId))) return true;
      if (slotIdFilter.size) return false;
      if (memberIdFilter.size) return memberIdFilter.has(String(s.memberId));
      return true;
    });

    if ((slotIdFilter.size || memberIdFilter.size) && !filteredSlots.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No matching slots found in this group for requested filter",
        },
        { status: 400 },
      );
    }

    const monthlyAmount = computePerMemberInstallment(group, slots.length);
    const totalMonths = Math.max(1, toNumber(group.totalMonths));
    const targetMonth = Math.min(tillMonth, totalMonths);

    if (!filteredSlots.length) {
      return NextResponse.json(
        { success: false, error: "No member slots in this group" },
        { status: 400 }
      );
    }

    if (monthlyAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid monthly installment for this group" },
        { status: 400 }
      );
    }

    const startDate = new Date(
      typeof group.startDate === "string" ? group.startDate : new Date(),
    );

    let createdCount = 0;
    let updatedLedger = 0;
    const memberTotals = new Map<string, number>();

    const reconcileLedgerMonth = async (args: {
      memberId: string;
      amount: number;
      month: number; // 1-based
      paymentId?: string;
    }) => {
      const { memberId, amount, month, paymentId } = args;
      const ledgerMonthIdx = Math.max(0, month - 1);

      const ledger = await MemberLedger.findOne({
        memberId,
        groupId,
        monthIndex: ledgerMonthIdx,
      });

      if (!ledger) return;

      const paidNow = Number(ledger.paidAmount || 0) + amount;
      ledger.paidAmount = paidNow;
      ledger.penaltyAmount = 0;
      ledger.status =
        paidNow >= Number(ledger.dueAmount || 0) ? "Paid" : "PartiallyPaid";
      await ledger.save();

      if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
        await MemberLedger.findByIdAndUpdate(ledger._id, {
          $addToSet: { payments: new mongoose.Types.ObjectId(paymentId) },
        }).catch(() => {});
      }

      updatedLedger++;
    };

    for (const slot of filteredSlots as SlotRef[]) {
      const memberId = String(slot.memberId);
      const memberSlotId = String(slot.slotId);
      for (let month = 1; month <= targetMonth; month++) {

        const existingQuery: Record<string, unknown> = {
          groupId,
          memberId,
          memberSlotId,
          status: "approved",
          $or: [
            { "allocated.monthIndex": month },
            { "allocated.monthIndex": Math.max(0, month - 1) },
            { "allocation.monthIndex": month },
            { "rawMeta.allocationDetails.monthIndex": month },
            { "rawMeta.allocationSummary.monthIndex": month },
            { "rawMeta.monthIndex": month },
          ],
        };

        const existingPayment = await Payment.findOne(existingQuery).select(
          "_id amount",
        ) as { _id?: unknown; amount?: unknown } | null;

        if (existingPayment) {
          await reconcileLedgerMonth({
            memberId,
            amount: Math.max(0, toNumber(existingPayment.amount) || monthlyAmount),
            month,
            paymentId: existingPayment._id ? String(existingPayment._id) : undefined,
          });
          continue;
        }

        const approvedDate = new Date(startDate);
        approvedDate.setMonth(startDate.getMonth() + (month - 1));

        const payment = await Payment.create({
          memberId: new mongoose.Types.ObjectId(memberId),
          groupId: new mongoose.Types.ObjectId(groupId),
          memberSlotId,
          amount: monthlyAmount,
          type: "CASH",
          status: "approved",
          approvedAt: approvedDate,
          allocated: [
            {
              monthIndex: Math.max(0, month - 1),
              amount: monthlyAmount,
              penaltyApplied: 0,
            },
          ],
          allocationDetails: [
            {
              monthIndex: month,
              principalPaid: monthlyAmount,
              penaltyPaid: 0,
            },
          ],
          rawMeta: {
            collectedVia: "bulk-fill",
            monthIndex: month,
            memberSlotId,
            allocationDetails: [
              {
                monthIndex: month,
                principalPaid: monthlyAmount,
                penaltyPaid: 0,
              },
            ],
            paymentKind: "auto-complete",
          },
        });

        await reconcileLedgerMonth({
          memberId,
          amount: monthlyAmount,
          month,
          paymentId: payment._id ? String(payment._id) : undefined,
        });

        memberTotals.set(memberId, (memberTotals.get(memberId) ?? 0) + monthlyAmount);
        createdCount++;
      }
    }

    for (const [memberId, total] of memberTotals.entries()) {
      await Member.findByIdAndUpdate(memberId, {
        $inc: {
          totalPaid: total,
          pendingAmount: -total,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `Member slots completed till M${targetMonth}`,
      totalCreated: createdCount,
      targetedSlots: filteredSlots.length,
      updatedLedger,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }
}
