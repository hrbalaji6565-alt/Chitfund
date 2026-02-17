// src/app/api/chitgroups/[id]/bids/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Bid from "@/app/models/Bid";
import ChitGroup from "@/app/models/ChitGroup";
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

  if (now.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(1, months + 1);
};

function computePotMeta(group: UnknownRecord): {
  expectedMonthlyTotal: number;
  perMemberInstallment: number;
  totalMembers: number;
} {
  const totalMembers = toNum(
    group.totalMembers ??
      (Array.isArray(group.members) ? group.members.length : 0),
  );
  const monthlyFromModel = toNum(group.monthlyInstallment);
  const chitValue = toNum(group.chitValue);
  const totalMonths = toNum(group.totalMonths);

  let expectedMonthlyTotal = 0;

  if (monthlyFromModel > 0 && totalMembers > 0) {
    expectedMonthlyTotal = monthlyFromModel * totalMembers;
  } else if (chitValue > 0 && totalMonths > 0) {
    expectedMonthlyTotal = Math.round(
      chitValue / Math.max(1, totalMonths || 1),
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

const ADMIN_COMMISSION_RATE = 0.04;

export async function GET(req: NextRequest, context: unknown) {
  try {
    const { id: chitId } = await resolveParams(context);

    if (!isValidObjectId(chitId)) {
      return NextResponse.json(
        { success: false, error: "Invalid chit id" },
        { status: 400 },
      );
    }

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

    const basePot = meta.expectedMonthlyTotal;
    const adminCommissionAmount = Math.round(basePot * ADMIN_COMMISSION_RATE);

    const url = new URL(req.url);
    const qMonth = url.searchParams.get("monthIndex");

    const rawStart = group.startDate;
    const currentMonthIndex = monthsElapsedSinceStart(
      typeof rawStart === "string" ? rawStart : undefined,
    );

    const monthIndex = qMonth
      ? Math.max(1, Number(qMonth) || currentMonthIndex)
      : currentMonthIndex;

    const docs = await Bid.find({
      chitId,
      monthIndex,
    })
      .sort({ createdAt: -1 })
      .populate("memberId", "name")
      .lean();

    const bids = docs.map((doc) => {
      const rec = doc as unknown as UnknownRecord;

      const memberField = rec.memberId;
      let memberId = "";
      let memberName: string | undefined;

      if (typeof memberField === "string") {
        memberId = memberField;
      } else if (memberField && typeof memberField === "object") {
        const mObj = memberField as UnknownRecord;
        memberId = idStr(mObj._id ?? mObj.id);
        if (
          typeof mObj.name === "string" &&
          mObj.name.trim().length > 0
        ) {
          memberName = mObj.name.trim();
        }
      }

      const memberDiscountTotal = toNum(rec.discountOffered);
      const bidAmount = Math.max(
        0,
        basePot + adminCommissionAmount + memberDiscountTotal,
      );

      return {
        _id: idStr(rec._id),
        chitId,
        memberId,
        memberSlotId: idStr((rec as { memberSlotId?: unknown }).memberSlotId),
        memberName,
        monthIndex,
        discount: memberDiscountTotal,
        bidAmount,
        createdAt:
          typeof rec.createdAt === "string"
            ? rec.createdAt
            : rec.createdAt instanceof Date
            ? rec.createdAt.toISOString()
            : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      bids,
      meta: {
        ...meta,
        adminCommissionRate: ADMIN_COMMISSION_RATE,
        adminCommissionAmount,
      },
      biddingOpen: (chitDoc as UnknownRecord).biddingOpen === true,
      biddingMonthIndex:
        (chitDoc as UnknownRecord).biddingMonthIndex ?? null,
      blockedWinners: Array.isArray((chitDoc as UnknownRecord).blockedWinners)
        ? ((chitDoc as UnknownRecord).blockedWinners as unknown[]).map(idStr)
        : [],
    });
  } catch (error) {
    console.error("GET /api/chitgroups/[id]/bids error:", error);
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
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
      memberId?: string;
      memberSlotId?: string;
      bidAmount?: number;
      discountOffered?: number;
      monthIndex?: number;
    };

    const memberId = body.memberId;
    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "memberId required" },
        { status: 400 },
      );
    }

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

    const basePot = meta.expectedMonthlyTotal;
    const adminCommissionAmount = Math.round(
      basePot * ADMIN_COMMISSION_RATE,
    );

    const rawStart = group.startDate;
    const currentMonthIndex = monthsElapsedSinceStart(
      typeof rawStart === "string" ? rawStart : undefined,
    );

    const monthIndex =
      typeof body.monthIndex === "number" && !Number.isNaN(body.monthIndex)
        ? Math.max(1, Math.round(body.monthIndex))
        : currentMonthIndex;

    const rawBiddingOpen = (group as { biddingOpen?: unknown }).biddingOpen;
    const rawBiddingMonth = (group as {
      biddingMonthIndex?: unknown;
    }).biddingMonthIndex;

    const biddingOpenFlag = rawBiddingOpen === true;
    const biddingMonthIndex =
      typeof rawBiddingMonth === "number" && !Number.isNaN(rawBiddingMonth)
        ? Math.max(1, Math.round(rawBiddingMonth))
        : currentMonthIndex;

    if (!biddingOpenFlag || biddingMonthIndex !== monthIndex) {
      return NextResponse.json(
        {
          success: false,
          error: "Bidding is not open for this month",
        },
        { status: 403 },
      );
    }

    const slots = normalizeGroupMemberSlots(group.members);
    const memberSlots = slots.filter((s) => s.memberId === memberId);
    if (!memberSlots.length) {
      return NextResponse.json(
        { success: false, error: "Member not in this chit" },
        { status: 403 },
      );
    }

    const requestedSlotId = idStr(body.memberSlotId);
    const memberSlotId =
      requestedSlotId && memberSlots.some((s) => s.slotId === requestedSlotId)
        ? requestedSlotId
        : memberSlots[0].slotId;

    const blockedWinners: string[] = Array.isArray(
      (group as { blockedWinners?: unknown }).blockedWinners,
    )
      ? ((group as { blockedWinners?: unknown }).blockedWinners as unknown[])
          .map(idStr)
          .filter((x) => x)
      : [];

    if (blockedWinners.includes(memberSlotId) || blockedWinners.includes(memberId)) {
      return NextResponse.json(
        { success: false, error: "This member slot is blocked for bidding" },
        { status: 403 },
      );
    }

    const bidAmount = typeof body.bidAmount === "number"
      ? body.bidAmount
      : NaN;

    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid bidAmount required" },
        { status: 400 },
      );
    }

    const minAllowed = basePot + adminCommissionAmount;
    if (bidAmount < minAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Bid must be at least base pot + admin commission (min Rs ${minAllowed})`,
        },
        { status: 400 },
      );
    }

    const totalExtra = bidAmount - basePot;
    const memberDiscountTotal = totalExtra - adminCommissionAmount;

    let discountOffered = memberDiscountTotal;
    if (!Number.isFinite(discountOffered)) {
      return NextResponse.json(
        { success: false, error: "Invalid discount/bid value" },
        { status: 400 },
      );
    }
    if (discountOffered < 0) {
      discountOffered = 0;
    }

    const existing = await Bid.findOne({
      chitId,
      memberId,
      memberSlotId,
      monthIndex,
    });

    if (existing) {
      existing.discountOffered = discountOffered;
      await existing.save();
    } else {
      await Bid.create({
        chitId,
        memberId,
        memberSlotId,
        monthIndex,
        discountOffered,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/chitgroups/[id]/bids error:", error);
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
