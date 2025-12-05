import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import ChitGroup from "@/app/models/ChitGroup";
import Auction from "@/app/models/Auction";

type UnknownRecord = Record<string, unknown>;

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const idStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

const monthsElapsedSinceStart = (startIso?: string): number => {
  if (!startIso) return 1;
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return 1;
  const n = new Date();
  let months =
    (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months + 1);
};

type PaymentsMeta = {
  expectedMonthlyTotal: number;
  perMemberInstallment: number;
  currentMonthIndex: number;
  totalMembers: number;
  monthIndex: number;
  perMemberDiscountThisMonth: number;
  effectiveInstallmentThisMonth: number;
};

async function resolveParams(context: unknown) {
  const ctx = context as Record<string, unknown>;
  const params =
    ctx.params instanceof Promise ? await ctx.params : ctx.params;
  return { id: String((params as Record<string, unknown>).id) };
}

function computeBaseMeta(group: UnknownRecord): {
  expectedMonthlyTotal: number;
  perMemberInstallment: number;
  totalMembers: number;
  currentMonthIndex: number;
} {
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

  const perMemberInstallment =
    totalMembers > 0
      ? Math.round(expectedMonthlyTotal / totalMembers)
      : 0;

  const startIso =
    typeof group.startDate === "string" ? group.startDate : undefined;
  const currentMonthIndex = monthsElapsedSinceStart(startIso);

  return {
    expectedMonthlyTotal,
    perMemberInstallment,
    totalMembers,
    currentMonthIndex,
  };
}

/**
 * core helper: payments + meta + discount from auction
 */
async function fetchPaymentsWithMeta(args: {
  groupId: string;
  all: boolean;
  monthIndex?: number;
  memberId?: string;
}) {
  const { groupId, all, monthIndex, memberId } = args;

  await dbConnect();

  const chitDoc = await ChitGroup.findById(groupId).lean();
  if (!chitDoc) {
    return {
      ok: false as const,
      status: 404,
      error: "Chit group not found",
    };
  }

  const group = chitDoc as unknown as UnknownRecord;
  const baseMeta = computeBaseMeta(group);

  const monthIdx =
    typeof monthIndex === "number" && !Number.isNaN(monthIndex)
      ? Math.max(1, Math.round(monthIndex))
      : baseMeta.currentMonthIndex;

  const query: Record<string, unknown> = { groupId };

  if (!all) {
    query["allocation.monthIndex"] = monthIdx;
  }

  if (memberId) {
    query.memberId = memberId;
  }

  const payments = await Payment.find(query).lean();

  // --- auction discount calculation for this month ---
  let perMemberDiscountThisMonth = 0;

  const auctionDoc = await Auction.findOne({
    chitId: groupId,
    monthIndex: monthIdx,
  }).lean();

  if (auctionDoc) {
    const auc = auctionDoc as unknown as UnknownRecord;

    // total discount that members share (winningDiscount)
    const totalDiscount = toNum(
      auc.winningDiscount ??
        (auc as { winningBidAmount?: unknown }).winningBidAmount ??
        0,
    );

    const totalMembers = baseMeta.totalMembers;

    if (
      Array.isArray(auc.distributedToMembers) &&
      auc.distributedToMembers.length > 0
    ) {
      // agar per-member distribution stored hai to usko use karo
      if (memberId) {
        const entry = (auc.distributedToMembers as unknown[]).find((d) => {
          if (!d || typeof d !== "object") return false;
          const rec = d as UnknownRecord;
          const mid = idStr(rec.memberId ?? rec.id);
          return mid === memberId;
        });
        if (entry && typeof entry === "object") {
          perMemberDiscountThisMonth = toNum(
            (entry as UnknownRecord).amount,
          );
        }
      } else {
        // all members ke liye generic share
        perMemberDiscountThisMonth = totalMembers
          ? Math.floor(totalDiscount / totalMembers)
          : 0;
      }
    } else if (totalDiscount > 0 && totalMembers > 0) {
      // simple equal split fallback
      perMemberDiscountThisMonth = Math.floor(
        totalDiscount / totalMembers,
      );
    }
  }

  const effectiveInstallmentThisMonth = Math.max(
    0,
    baseMeta.perMemberInstallment - perMemberDiscountThisMonth,
  );

  const meta: PaymentsMeta = {
    expectedMonthlyTotal: baseMeta.expectedMonthlyTotal,
    perMemberInstallment: baseMeta.perMemberInstallment,
    currentMonthIndex: baseMeta.currentMonthIndex,
    totalMembers: baseMeta.totalMembers,
    monthIndex: monthIdx,
    perMemberDiscountThisMonth,
    effectiveInstallmentThisMonth,
  };

  return {
    ok: true as const,
    status: 200,
    payments,
    meta,
  };
}

export async function GET(req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);

    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "true";
    const monthIndexParam = url.searchParams.get("monthIndex");
    const memberIdParam = url.searchParams.get("memberId") ?? undefined;

    const monthIndex = monthIndexParam
      ? Number(monthIndexParam)
      : undefined;

    const result = await fetchPaymentsWithMeta({
      groupId: id,
      all,
      monthIndex,
      memberId: memberIdParam,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      payments: result.payments,
      meta: result.meta,
    });
  } catch (err) {
    console.error("GET /payments error:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    const body = (await req.json().catch(() => ({}))) as {
      all?: boolean;
      monthIndex?: number;
      memberId?: string;
    };

    const all = body.all === true;
    const monthIndex =
      typeof body.monthIndex === "number" ? body.monthIndex : undefined;
    const memberId = body.memberId;

    const result = await fetchPaymentsWithMeta({
      groupId: id,
      all,
      monthIndex,
      memberId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      payments: result.payments,
      meta: result.meta,
    });
  } catch (err) {
    console.error("POST /payments error:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
