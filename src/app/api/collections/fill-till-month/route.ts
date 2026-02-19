import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";

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

        const existingPayment = await Payment.findOne(existingQuery).select("_id");

        if (!existingPayment) {

          const approvedDate = new Date(startDate);
          approvedDate.setMonth(startDate.getMonth() + (month - 1));

          const payment = new Payment({
            memberId,
            groupId,
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
              paymentKind: "auto-complete"
            }
          });

          await payment.save();
          createdCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Member slots completed till M${targetMonth}`,
      totalCreated: createdCount,
      targetedSlots: filteredSlots.length,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }
}
