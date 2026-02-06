import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getMemberIds = (g: UnknownRecord): string[] => {
  const membersRaw = g.members;
  const result: string[] = [];
  if (Array.isArray(membersRaw)) {
    for (const m of membersRaw) {
      if (typeof m === "string") {
        result.push(m);
      } else if (isRecord(m)) {
        const id = m._id ?? m.id;
        if (id !== undefined) result.push(String(id));
      }
    }
  }
  return result;
};

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

    const members = getMemberIds(group);
    const monthlyAmount = computePerMemberInstallment(group, members.length);
    const totalMonths = Math.max(1, toNumber(group.totalMonths));
    const targetMonth = Math.min(tillMonth, totalMonths);

    if (!members.length) {
      return NextResponse.json(
        { success: false, error: "No members in this group" },
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

    for (const memberId of members) {
      for (let month = 1; month <= targetMonth; month++) {

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

        if (!existingPayment) {

          const approvedDate = new Date(startDate);
          approvedDate.setMonth(startDate.getMonth() + (month - 1));

          const payment = new Payment({
            memberId,
            groupId,
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
      message: `All members completed till M${targetMonth}`,
      totalCreated: createdCount
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }
}
