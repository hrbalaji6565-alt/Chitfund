import MemberLedger from "@/app/models/MemberLedger";
import mongoose from "mongoose";
import ChitGroup from "@/app/models/ChitGroup";

export async function initLedgerForMember(groupId: string, memberId: string) {
  const group = await ChitGroup.findById(groupId).lean();
  if (!group) throw new Error("Group not found");
  const months = Number(group.totalMonths) || 0;
  const installment = Number(group.monthlyInstallment) || 0;
  const start = group.startDate ? new Date(group.startDate) : new Date();

  const bulk: unknown[] = [];
  for (let i = 0; i < months; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);
    bulk.push({
      memberId: new mongoose.Types.ObjectId(memberId),
      groupId: new mongoose.Types.ObjectId(groupId),
      monthIndex: i,
      dueAmount: installment,
      paidAmount: 0,
      penaltyAmount: 0,
      status: "Pending",
      dueDate,
    });
  }
  if (bulk.length) {
    await MemberLedger.insertMany(bulk);
  }
}
