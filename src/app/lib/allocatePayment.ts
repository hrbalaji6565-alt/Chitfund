import MemberLedger from "@/app/models/MemberLedger";
import Payment from "@/app/models/Payment";
import Member from "@/app/models/Member";
import ChitGroup from "@/app/models/ChitGroup";
import mongoose from "mongoose";
import { runAuctionAndDistribute } from "@/app/lib/auction";
import Contribution from "@/app/models/Contribution";
import Auction from "@/app/models/Auction";

/**
 * allocatePayment: apply `amount` to oldest outstanding ledger entries for a member in the group.
 * Returns saved Payment doc.
 *
 * Behaviour:
 * - Applies payment to oldest unpaid/partially paid MemberLedger entries (0-based monthIndex).
 * - Creates Payment document that references ledger allocations.
 * - Creates Contribution records (1-based monthIndex) for use by auction runner.
 * - Updates Member.totalPaid and pendingAmount.
 * - If after this payment the collected pot for any affected month >= chit.chitValue,
 *   runs runAuctionAndDistribute for that month (if auction not already run).
 */

type AllocationEntry = {
  ledgerId: mongoose.Types.ObjectId | string;
  monthIndex: number;
  amount: number;
  penaltyApplied?: number;
};

export async function allocatePayment({
  memberId,
  groupId,
  amount,
  type = "CASH",
  collectorId,
  reference,
  rawMeta,
  markVerified = true,
}: {
  memberId: string;
  groupId: string;
  amount: number;
  type?: "UPI" | "CASH" | "BANK" | "OTHER";
  collectorId?: string;
  reference?: string;
  rawMeta?: Record<string, unknown>;
  markVerified?: boolean;
}) {
  if (amount <= 0) throw new Error("Invalid amount");

  const group = await ChitGroup.findById(groupId).lean();
  if (!group) throw new Error("Group not found");

  const penaltyPercent = Number(group.penaltyPercent || 0);

  // 1) fetch unpaid/partially entries ordered by monthIndex asc
  const entries = await MemberLedger.find({
    memberId,
    groupId,
    status: { $in: ["Pending", "PartiallyPaid", "Overdue"] },
  }).sort({ monthIndex: 1, dueDate: 1 });

  const allocations: AllocationEntry[] = [];
  let remaining = amount;

  for (const e of entries) {
    if (remaining <= 0) break;

    // compute current outstanding for this ledger = due - paid + penalty
    const outstanding =
      e.dueAmount + (e.penaltyAmount || 0) - (e.paidAmount || 0);
    if (outstanding <= 0) {
      continue;
    }

    // If ledger is past dueDate, compute penalty (simple immediate penalty on principal outstanding)
    const now = new Date();
    let penaltyThisLedger = 0;
    if (e.dueDate && e.dueDate < now && penaltyPercent > 0) {
      const principalOutstanding = e.dueAmount - (e.paidAmount || 0);
      if (principalOutstanding > 0) {
        penaltyThisLedger = Math.round(
          (principalOutstanding * penaltyPercent) / 100
        );
        // persist penalty to ledger object (we will save below)
        e.penaltyAmount = (e.penaltyAmount || 0) + penaltyThisLedger;
      }
    }

    const newOutstanding =
      e.dueAmount + (e.penaltyAmount || 0) - (e.paidAmount || 0);
    const toApply = Math.min(remaining, newOutstanding);

    // update ledger
    e.paidAmount = (e.paidAmount || 0) + toApply;
    if (e.paidAmount >= e.dueAmount + (e.penaltyAmount || 0)) {
      e.status = "Paid";
    } else {
      e.status = "PartiallyPaid";
    }
    await e.save();

    allocations.push({
      ledgerId: e._id as mongoose.Types.ObjectId, // <- cast fixes TS error
      monthIndex: e.monthIndex, // keep 0-based here (ledger)
      amount: toApply,
      penaltyApplied: penaltyThisLedger,
    });

    remaining -= toApply;
  }

  // If still remaining (pre-pay future months), optionally create allocations for future ledger entries
  if (remaining > 0) {
    const future = await MemberLedger.find({
      memberId,
      groupId,
      status: "Pending",
    })
      .sort({ monthIndex: 1 })
      .limit(200);

    for (const e of future) {
      if (remaining <= 0) break;
      const outstanding =
        e.dueAmount + (e.penaltyAmount || 0) - (e.paidAmount || 0);
      if (outstanding <= 0) continue;
      const toApply = Math.min(remaining, outstanding);
      e.paidAmount = (e.paidAmount || 0) + toApply;
      e.status =
        e.paidAmount >= e.dueAmount + (e.penaltyAmount || 0)
          ? "Paid"
          : "PartiallyPaid";
      await e.save();
      allocations.push({
        ledgerId: e._id as mongoose.Types.ObjectId, // <- cast fixes second TS error
        monthIndex: e.monthIndex,
        amount: toApply,
        penaltyApplied: 0,
      });
      remaining -= toApply;
    }
  }

  // create Payment doc and link allocations
  const payment = await Payment.create({
    memberId: new mongoose.Types.ObjectId(memberId),
    groupId: new mongoose.Types.ObjectId(groupId),
    amount,
    type,
    reference,
    collectorId: collectorId
      ? new mongoose.Types.ObjectId(collectorId)
      : undefined,
    allocated: allocations.map((a) => ({
      ledgerId: a.ledgerId,
      monthIndex: a.monthIndex,
      amount: a.amount,
      penaltyApplied: a.penaltyApplied || 0,
    })),
    rawMeta: rawMeta || {},
    verified: markVerified,
  });

  // attach payment id to ledger entries' payments array
  await Promise.all(
    allocations.map(async (a) => {
      await MemberLedger.findByIdAndUpdate(a.ledgerId, {
        $addToSet: { payments: payment._id },
      }).catch(() => {});
    })
  );

  // update member totalPaid/pendingAmount
  const paidSum = allocations.reduce((s, a) => s + (a.amount || 0), 0);
  await Member.findByIdAndUpdate(memberId, {
    $inc: { totalPaid: paidSum, pendingAmount: -paidSum },
  }).catch(() => {});

  // --- NEW: for each affected monthIndex, create Contribution record and check pot completion ---
  // record contribution entries so runAuction can use them (create one contribution per allocation)
  const createdContributions: unknown[] = [];
  for (const a of allocations) {
    try {
      const contrib = await Contribution.create({
        chitId: String(groupId),
        memberId: String(memberId),
        amount: a.amount,
        date: new Date(),
        // convert ledger 0-based monthIndex -> Contribution 1-based monthIndex
        monthIndex: (a.monthIndex ?? 0) + 1,
      });
      createdContributions.push(contrib);
    } catch (err) {
      console.error("Failed to create contribution record:", err);
    }
  }

  // now check each distinct monthIndex we modified (1-based)
  const distinctMonths: number[] = Array.from(
    new Set(allocations.map((a) => (a.monthIndex ?? 0) + 1))
  );
  for (const m of distinctMonths) {
    try {
      // compute total collected for chit+month
      const agg = await Contribution.aggregate([
        { $match: { chitId: String(groupId), monthIndex: m } },
        { $group: { _id: null, totalCollected: { $sum: "$amount" } } },
      ]);

      const totalCollected =
        (agg[0]?.totalCollected as number | undefined) ?? 0;
      const groupDoc = await ChitGroup.findById(groupId).lean();

      if (groupDoc && totalCollected >= Number(groupDoc.chitValue || 0)) {
        // only run auction if not already run for this month
        const already = await Auction.findOne({
          chitId: String(groupId),
          monthIndex: m,
        });
        if (!already) {
          // run auction and distribute immediately
          await runAuctionAndDistribute(String(groupId), m).catch((err) => {
            console.error("runAuctionAndDistribute error:", err);
          });
        }
      }
    } catch (err) {
      console.error(
        "Error while checking/running auction for month",
        m,
        err
      );
    }
  }

  return payment;
}
