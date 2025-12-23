// app/api/collections/pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";
import Auction from "@/app/models/Auction";

type UnknownRecord = Record<string, unknown>;

type PendingItem = {
  id: string;
  chitGroupId: string;
  chitGroupName: string;
  memberId: string;
  memberName?: string;
  monthIndex: number;
  expected: number;
  paid: number;
  pending: number;
};

type Stats = {
  todayTotal: number;
  monthTotal: number;
  yearTotal: number;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const monthsElapsedSinceStart = (startIso?: string): number => {
  if (!startIso) return 1;
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return 1;
  const n = new Date();
  let months =
    (n.getFullYear() - s.getFullYear()) * 12 +
    (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months + 1);
};

const getMembersFromGroup = (g: UnknownRecord): string[] => {
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
  auctionRec: UnknownRecord | null,
): number => {
  const chitValue = toNumber(g.chitValue);
  const totalMonths = Math.max(1, toNumber(g.totalMonths));
  const monthlyFromModel = toNumber(g.monthlyInstallment);

  const baseMonthlyTotal =
    monthlyFromModel > 0
      ? monthlyFromModel * totalMembers
      : chitValue > 0
      ? Math.round(chitValue / totalMonths)
      : 0;

  const basePerMember =
    monthlyFromModel > 0
      ? Math.round(monthlyFromModel)
      : totalMembers > 0
      ? Math.round(baseMonthlyTotal / totalMembers)
      : 0;

  if (!auctionRec || !totalMembers || basePerMember <= 0) {
    return basePerMember;
  }

  // 1) Agar auction me direct perMemberDiscount store ho
  const explicitPerMember = toNumber(
    (auctionRec as { perMemberDiscount?: unknown }).perMemberDiscount,
  );
  if (explicitPerMember > 0 && explicitPerMember < basePerMember) {
    return basePerMember - explicitPerMember;
  }

  // 2) distributedToMembers se total discount nikaalna
  let discountToMembers = 0;
  const distributedRaw = (auctionRec as { distributedToMembers?: unknown })
    .distributedToMembers;

  if (Array.isArray(distributedRaw)) {
    for (const d of distributedRaw) {
      if (!isRecord(d)) continue;
      discountToMembers += toNumber(d.amount);
    }
  }

  // 3) fallback – winningDiscount + adminCommission ka use
  if (!discountToMembers) {
    const winningDiscount = toNumber(
      auctionRec.winningDiscount ??
        (auctionRec as { winningBidAmount?: unknown }).winningBidAmount ??
        0,
    );
    const adminCommissionAmount = toNumber(
      (auctionRec as { adminCommissionAmount?: unknown })
        .adminCommissionAmount ?? 0,
    );

    // usually winningDiscount hi group ko milne wali total discount hai,
    // admin commission ko ek hi baar minus karna chahiye
    const raw = winningDiscount - Math.max(0, adminCommissionAmount);
    discountToMembers = Math.max(0, raw);
  }

  if (!discountToMembers) return basePerMember;

  // Discount kabhi bhi pure pot se zyada nahi hona chahiye
  const maxDiscount = basePerMember * totalMembers;
  const safeDiscount = Math.min(discountToMembers, maxDiscount);

  const perMemberDiscount = Math.round(safeDiscount / totalMembers);
  const final = basePerMember - perMemberDiscount;

  // Agar calculation se 0 ya negative aa gaya,
  // to kam se kam basePerMember rakho (installment 0 nahi honi chahiye)
  if (final <= 0) return basePerMember;

  return final;
};


/* allocation helpers (same idea as admin page) */
type AllocationDetail = {
  monthIndex: number;
  principalPaid: number;
  penaltyPaid: number;
};

const parseAllocationArray = (
  input: unknown,
): AllocationDetail[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const out: AllocationDetail[] = [];

  for (const item of input) {
    if (!isRecord(item)) continue;
    const rawMonth =
      item.monthIndex ?? item.idx ?? item.month ?? item.mindex;
    let monthIndex =
      typeof rawMonth === "number" ? rawMonth : toNumber(rawMonth);
    if (monthIndex >= 0 && monthIndex < 1) monthIndex += 1;

    const principalPaid = toNumber(
      item.principalPaid ??
        item.principal ??
        item.amount ??
        item.apply ??
        0,
    );
    const penaltyPaid = toNumber(
      item.penaltyPaid ??
        item.penalty ??
        item.penaltyApplied ??
        0,
    );

    out.push({
      monthIndex: Math.max(1, Math.round(monthIndex)),
      principalPaid,
      penaltyPaid,
    });
  }

  return out.length ? out : undefined;
};

const parseAllocationsFromPayment = (
  raw: UnknownRecord,
): AllocationDetail[] | undefined => {
  const candidates: unknown[] = [
    raw.allocation,
    raw.allocated,
    raw.allocationSummary,
    raw.allocationDetails,
  ];

  if (isRecord(raw.rawMeta)) {
    const rm = raw.rawMeta;
    candidates.push(
      rm.allocation,
      rm.allocated,
      rm.allocationSummary,
      rm.allocationDetails,
      rm.appliedAllocation,
    );
  }

  for (const c of candidates) {
    if (typeof c === "string") {
      try {
        const parsed = JSON.parse(c) as unknown;
        const arr = parseAllocationArray(parsed);
        if (arr && arr.length) return arr;
      } catch {
        // ignore
      }
    } else {
      const arr = parseAllocationArray(c);
      if (arr && arr.length) return arr;
    }
  }

  return undefined;
};

const getPaidForMemberMonth = (
  payments: UnknownRecord[],
  memberId: string,
  targetMonth: number,
): number => {
  let total = 0;

  for (const p of payments) {
    const mid =
      p.memberId ??
      (isRecord(p.member) ? p.member._id ?? p.member.id : undefined);
    if (mid === undefined) continue;
    if (String(mid) !== memberId) continue;

    const allocDetails = parseAllocationsFromPayment(p);
    if (allocDetails && allocDetails.length > 0) {
      for (const ad of allocDetails) {
        if (ad.monthIndex === targetMonth) {
          total += ad.principalPaid;
        }
      }
      continue;
    }

    // fallback: treat as full principal for current month
    const alloc = isRecord(p.allocation) ? p.allocation : undefined;
    const allocMonthRaw = alloc?.monthIndex ?? alloc?.month;
    const allocMonth =
      typeof allocMonthRaw === "number"
        ? allocMonthRaw
        : toNumber(allocMonthRaw);
    if (!alloc || allocMonth === targetMonth) {
      total += toNumber(p.amount ?? p.amt ?? 0);
    }
  }

  return total;
};

const computeStats = async (): Promise<Stats> => {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const makeTotal = async (from: Date): Promise<number> => {
    const result = (await Payment.aggregate([
      {
        $match: {
          status: "approved",
          createdAt: { $gte: from, $lte: now },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).exec()) as Array<{ _id: unknown; total: number }>;
    return result.length ? result[0].total : 0;
  };

  const [todayTotal, monthTotal, yearTotal] = await Promise.all([
    makeTotal(startOfDay),
    makeTotal(startOfMonth),
    makeTotal(startOfYear),
  ]);

  return { todayTotal, monthTotal, yearTotal };
};

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const url = new URL(req.url);
    const groupIdFilter = url.searchParams.get("groupId");

    const groupQuery: Record<string, unknown> = {};
    if (groupIdFilter) {
      groupQuery._id = groupIdFilter;
    }

    const groupsRaw = (await Group.find(groupQuery).lean()) as UnknownRecord[];

    const items: PendingItem[] = [];

    for (const g of groupsRaw) {
      const chitGroupId = String(g._id ?? "");
      if (!chitGroupId) continue;

      const chitGroupName =
        typeof g.name === "string"
          ? g.name
          : typeof g.groupName === "string"
          ? g.groupName
          : chitGroupId;

      const members = getMembersFromGroup(g);
      if (!members.length) continue;

      const monthIndex = monthsElapsedSinceStart(
        typeof g.startDate === "string" ? g.startDate : undefined,
      );

      const auctionRaw = (await Auction.findOne({
        chitId: chitGroupId,
        monthIndex,
      })
        .sort({ createdAt: -1 })
        .lean()) as UnknownRecord | null;

      const perMemberInstallment = computePerMemberInstallment(
        g,
        members.length,
        auctionRaw,
      );
      if (perMemberInstallment <= 0) continue;

      const payDocs = (await Payment.find({
        groupId: chitGroupId,
        status: "approved",
      }).lean()) as UnknownRecord[];

      for (const memberId of members) {
        const paid = getPaidForMemberMonth(
          payDocs,
          memberId,
          monthIndex,
        );
        const expected = perMemberInstallment;
        const pending = Math.max(0, expected - paid);

        if (pending <= 0) {
          // fully paid, skip
          continue;
        }

        items.push({
          id: `${chitGroupId}_${memberId}_${monthIndex}`,
          chitGroupId,
          chitGroupName,
          memberId,
          memberName: undefined, // frontend memberSlice se fill karega
          monthIndex,
          expected,
          paid,
          pending,
        });
      }
    }

    const stats = await computeStats();

    return NextResponse.json({
      success: true,
      items,
      stats,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("GET /api/collections/pending error:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to load pending collections",
      },
      { status: 500 },
    );
  }
}
