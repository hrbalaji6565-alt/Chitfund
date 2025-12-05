// src/app/lib/auction.ts
import mongoose from "mongoose";
import Bid from "@/app/models/Bid";
import Auction from "@/app/models/Auction";
import ChitGroup from "@/app/models/ChitGroup";
import MemberLedger from "@/app/models/MemberLedger";

type UnknownRecord = Record<string, unknown>;

const ADMIN_COMMISSION_PERCENT = 4;

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const idStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

/**
 * Admin page ka same logic: monthly total + per-member installment.
 */
function computePotMeta(group: UnknownRecord): {
  expectedMonthlyTotal: number;
  perMemberInstallment: number;
  totalMembers: number;
} {
  const totalMembers = toNum(
    group.totalMembers ??
      (Array.isArray(group.members) ? group.members.length : 0)
  );
  const monthlyFromModel = toNum(group.monthlyInstallment);
  const chitValue = toNum(group.chitValue);
  const totalMonths = toNum(group.totalMonths);

  let expectedMonthlyTotal = 0;

  if (monthlyFromModel > 0 && totalMembers > 0) {
    expectedMonthlyTotal = monthlyFromModel * totalMembers;
  } else if (chitValue > 0 && totalMonths > 0) {
    expectedMonthlyTotal = Math.round(
      chitValue / Math.max(1, totalMonths || 1)
    );
  } else {
    expectedMonthlyTotal =
      monthlyFromModel * Math.max(1, totalMembers || 1) || chitValue || 0;
  }

  const perMemberInstallment =
    monthlyFromModel > 0
      ? Math.round(monthlyFromModel)
      : totalMembers > 0
      ? Math.round(expectedMonthlyTotal / totalMembers)
      : 0;

  return {
    expectedMonthlyTotal,
    perMemberInstallment,
    totalMembers: Math.max(1, totalMembers || 1),
  };
}

/**
 * Auction run karega, winner pick karega (max discount),
 * 4% admin commission, baaki payout + discount distribution.
 *
 * monthIndex = 1-based (Month #1, #2, ...)
 */
export async function runAuctionAndDistribute(
  chitId: string,
  monthIndex: number
) {
  if (!mongoose.Types.ObjectId.isValid(chitId)) {
    throw new Error("Invalid chit id");
  }

  const mIdx = Math.max(1, Math.round(monthIndex || 1));

  const groupDoc = await ChitGroup.findById(chitId).lean();
  if (!groupDoc) {
    throw new Error("Chit group not found");
  }

  const groupRec = groupDoc as unknown as UnknownRecord;
  const { expectedMonthlyTotal, perMemberInstallment, totalMembers } =
    computePotMeta(groupRec);

  // Current month bids (discountOffered = discount)
  const bids = await Bid.find({
    chitId,
    monthIndex: mIdx,
  })
    .sort({ discountOffered: -1, createdAt: 1 }) // max discount wins
    .lean();

  if (!bids.length) {
    throw new Error("No bids placed for this month");
  }

  const best = bids[0] as unknown as UnknownRecord;
  const winningMemberId = idStr(best.memberId);
  const winningDiscount = Math.max(0, toNum(best.discountOffered));

  // Discount 0 se pot tak hi
  const cappedDiscount = Math.min(winningDiscount, expectedMonthlyTotal);

  // 4% admin commission chitValue par
  const chitValue = toNum(groupRec.chitValue ?? expectedMonthlyTotal);
  const adminCommission = Math.round(
    (chitValue * ADMIN_COMMISSION_PERCENT) / 100
  );

  const winningPayout = Math.max(
    0,
    expectedMonthlyTotal - cappedDiscount - adminCommission
  );

  // Discount ko sab members mein equally baantna
  const perMemberDiscountRaw =
    totalMembers > 0 ? cappedDiscount / totalMembers : 0;
  const perMemberDiscount = Math.round(perMemberDiscountRaw);

  const distributedToMembers: Array<{ memberId: string; amount: number }> = [];

  if (Array.isArray(groupRec.members) && groupRec.members.length > 0) {
    const membersArr = groupRec.members as unknown[];

    for (const m of membersArr) {
      let mid = "";

      if (typeof m === "string") {
        mid = m;
      } else if (typeof m === "object" && m !== null) {
        const obj = m as UnknownRecord;
        mid = idStr(obj._id ?? obj.id);
      }

      if (!mid) continue;

      distributedToMembers.push({
        memberId: mid,
        amount: perMemberDiscount,
      });
    }
  }

  // Agar members array nahi mili, to count ke basis par dummy ids (safety only)
  if (!distributedToMembers.length) {
    for (let i = 0; i < totalMembers; i += 1) {
      distributedToMembers.push({
        memberId: `M${i + 1}`,
        amount: perMemberDiscount,
      });
    }
  }

  const totalPot = expectedMonthlyTotal;

  const existing = await Auction.findOne({
    chitId,
    monthIndex: mIdx,
  });

  if (existing) {
    existing.totalPot = totalPot;
    existing.winningMemberId = winningMemberId;
    existing.winningBidAmount = cappedDiscount;
    existing.winningPayout = winningPayout;
    existing.distributedToMembers = distributedToMembers;
    await existing.save();
  } else {
    await Auction.create({
      chitId,
      monthIndex: mIdx,
      totalPot,
      winningMemberId,
      winningBidAmount: cappedDiscount,
      winningPayout,
      distributedToMembers,
    });
  }

  // MemberLedger update:
  // New per-member due = monthlyInstallment - perMemberDiscount
  const newPerMemberDue = Math.max(
    0,
    perMemberInstallment - perMemberDiscount
  );

  // Ledger ka monthIndex 0-based hai
  const ledgerMonthIdx = mIdx - 1;

  await MemberLedger.updateMany(
    { groupId: chitId, monthIndex: ledgerMonthIdx },
    {
      $set: {
        dueAmount: newPerMemberDue,
      },
    }
  ).catch(() => {
    // ignore failures
  });

  return {
    chitId,
    monthIndex: mIdx,
    winningMemberId,
    winningDiscount: cappedDiscount,
    winningPayout,
    perMemberInstallment,
    perMemberDiscount,
    adminCommission,
    distributedToMembers,
  };
}
