import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import ChitGroup from "@/app/models/ChitGroup";
import Bid from "@/app/models/Bid";
import Auction from "@/app/models/Auction";
import mongoose from "mongoose";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";

type UnknownRecord = Record<string, unknown>;

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const idStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

const isValidObjectId = (id: unknown): id is string =>
  typeof id === "string" && mongoose.Types.ObjectId.isValid(id);

const monthsElapsedSinceStart = (startIso?: string): number => {
  if (!startIso) return 1;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(1, months + 1);
};

type PotMeta = {
  expectedMonthlyTotal: number;
  totalMembers: number;
  adminCommissionPercent: number;
  adminCommissionAmount: number;
};

function computePotMeta(group: UnknownRecord): PotMeta {
  const totalMembersRaw =
    group.totalMembers ??
    (Array.isArray(group.members) ? group.members.length : 0);
  const totalMembers = Math.max(1, toNum(totalMembersRaw));

  const monthlyFromModel = toNum(group.monthlyInstallment);
  const chitValue = toNum(group.chitValue);
  const totalMonths = Math.max(1, toNum(group.totalMonths));

  let expectedMonthlyTotal = 0;

  if (monthlyFromModel > 0 && totalMembers > 0) {
    expectedMonthlyTotal = monthlyFromModel * totalMembers;
  } else if (chitValue > 0 && totalMonths > 0) {
    expectedMonthlyTotal = Math.round(chitValue / totalMonths);
  } else {
    expectedMonthlyTotal =
      monthlyFromModel * Math.max(1, totalMembers) || chitValue || 0;
  }

  const adminCommissionPercent = toNum(
    group.adminCommissionPercent ??
      group.adminCommission ??
      group.commissionPercent ??
      0,
  );

  const adminCommissionAmount = Math.round(
    (expectedMonthlyTotal * adminCommissionPercent) / 100,
  );

  return {
    expectedMonthlyTotal,
    totalMembers,
    adminCommissionPercent,
    adminCommissionAmount,
  };
}

async function resolveParams(context: unknown): Promise<{ id: string }> {
  if (!context || typeof context !== "object") {
    throw new Error("Missing route context");
  }
  const ctx = context as Record<string, unknown>;
  const raw = ctx.params as unknown;
  const params = raw instanceof Promise ? await raw : raw;

  if (
    !params ||
    typeof params !== "object" ||
    !("id" in (params as Record<string, unknown>))
  ) {
    throw new Error("Missing params.id");
  }

  const id = String((params as Record<string, unknown>).id);
  return { id };
}

export async function POST(req: NextRequest, context: unknown) {
  try {
    const { id: chitId } = await resolveParams(context);

    if (!isValidObjectId(chitId)) {
      return NextResponse.json(
        { success: false, error: "Invalid chit id" },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      monthIndex?: number;
    };

    await dbConnect();

    const chitDoc = await ChitGroup.findById(chitId).lean();
    if (!chitDoc) {
      return NextResponse.json(
        { success: false, error: "Chit not found" },
        { status: 404 },
      );
    }

    const group = chitDoc as unknown as UnknownRecord;
    const meta = computePotMeta(group);

    const rawStart = group.startDate;
    const currentMonthIndex = monthsElapsedSinceStart(
      typeof rawStart === "string" ? rawStart : undefined,
    );

    const monthIndex =
      typeof body.monthIndex === "number" && !Number.isNaN(body.monthIndex)
        ? Math.max(1, Math.round(body.monthIndex))
        : currentMonthIndex;

    const slots = normalizeGroupMemberSlots(group.members);
    const slotIds = slots.map((s) => s.slotId);

    const blockedWinners: string[] = Array.isArray(
      (group as { blockedWinners?: unknown }).blockedWinners,
    )
      ? ((group as { blockedWinners?: unknown }).blockedWinners as unknown[])
          .map(idStr)
          .filter((x) => x)
      : [];

    const bidDocs = await Bid.find({
      chitId,
      monthIndex,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!bidDocs.length) {
      return NextResponse.json(
        { success: false, error: "No bids for this month" },
        { status: 400 },
      );
    }

    const filteredBids = bidDocs.filter((d) => {
      const rec = d as unknown as UnknownRecord;
      const memberSlotId = idStr((rec as { memberSlotId?: unknown }).memberSlotId);
      const memberId = idStr(rec.memberId);
      const slotKey = memberSlotId || memberId;
      if (!slotKey) return false;
      if (slotIds.length && memberSlotId && !slotIds.includes(memberSlotId)) return false;
      if (blockedWinners.includes(slotKey)) return false;
      return true;
    });

    if (!filteredBids.length) {
      return NextResponse.json(
        { success: false, error: "Only blocked winners have bids" },
        { status: 400 },
      );
    }

    let winnerDoc = filteredBids[0];
    let maxDiscount = toNum(
      (winnerDoc as unknown as UnknownRecord).discountOffered,
    );

    for (const b of filteredBids) {
      const rec = b as unknown as UnknownRecord;
      const d = toNum(rec.discountOffered);
      if (d > maxDiscount) {
        maxDiscount = d;
        winnerDoc = b;
      }
    }

    const winnerRec = winnerDoc as unknown as UnknownRecord;
    const winningMemberId = idStr(winnerRec.memberId);
    const winningMemberSlotId = idStr(
      (winnerRec as { memberSlotId?: unknown }).memberSlotId,
    );

    const totalPot = meta.expectedMonthlyTotal;
    const winningDiscountTotal = Math.max(0, maxDiscount);
    const winningBidAmount = totalPot + winningDiscountTotal;

    const adminCommissionAmount = meta.adminCommissionAmount;
    const discountPoolForMembers = Math.max(
      0,
      winningDiscountTotal - adminCommissionAmount,
    );

    const totalSlots = Math.max(1, slots.length || meta.totalMembers);
    const perMemberDiscount = Math.floor(discountPoolForMembers / totalSlots);

    const distributedToMembers = (slots.length ? slots : [{ memberId: winningMemberId, slotId: winningMemberSlotId || winningMemberId }]).map((s) => ({
      memberId: s.memberId,
      memberSlotId: s.slotId,
      amount: perMemberDiscount,
    }));

    const usedDiscountForMembers = perMemberDiscount * distributedToMembers.length;
    const remainder = discountPoolForMembers - usedDiscountForMembers;
    if (remainder > 0 && distributedToMembers.length > 0) {
      distributedToMembers[0].amount += remainder;
    }

    const winningPayout = totalPot - winningDiscountTotal;
    const winnerKey = winningMemberSlotId || winningMemberId;
    const blockedNext = Array.from(new Set([...blockedWinners, winnerKey]));

    const updateDoc = {
      chitId,
      monthIndex,
      winningMemberId,
      winningMemberSlotId,
      winningDiscount: winningDiscountTotal,
      winningBidAmount,
      winningPayout,
      totalPot,
      adminCommissionAmount,
      perMemberDiscount,
      distributedToMembers,
    };

    const existingAuction = await Auction.findOne({
      chitId,
      monthIndex,
    });

    if (existingAuction) {
      existingAuction.winningMemberId = updateDoc.winningMemberId;
      (existingAuction as unknown as { winningMemberSlotId?: string }).winningMemberSlotId =
        updateDoc.winningMemberSlotId;
      existingAuction.winningDiscount = updateDoc.winningDiscount;
      existingAuction.winningBidAmount = updateDoc.winningBidAmount;
      existingAuction.winningPayout = updateDoc.winningPayout;
      existingAuction.totalPot = updateDoc.totalPot;
      existingAuction.adminCommissionAmount =
        updateDoc.adminCommissionAmount;
      existingAuction.perMemberDiscount = updateDoc.perMemberDiscount;
      existingAuction.distributedToMembers =
        updateDoc.distributedToMembers;
      await existingAuction.save();
    } else {
      await Auction.create(updateDoc);
    }

    await ChitGroup.findByIdAndUpdate(chitId, {
      $set: {
        biddingOpen: false,
        biddingMonthIndex: monthIndex,
        blockedWinners: blockedNext,
      },
    });

    return NextResponse.json({
      success: true,
      winningMemberId,
      winningMemberSlotId,
      winningDiscount: winningDiscountTotal,
      winningBidAmount,
      winningPayout,
      totalPot,
      adminCommissionAmount,
      perMemberDiscount,
      distributedToMembers,
    });
  } catch (error) {
    console.error(
      "POST /api/chitgroups/[id]/run-auction error:",
      error,
    );
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
