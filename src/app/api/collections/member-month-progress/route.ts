import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";
import MemberLedger from "@/app/models/MemberLedger";
import { verifyToken } from "@/app/lib/jwt";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";

type UnknownRecord = Record<string, unknown>;

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    const raw = (v || []).join("=").trim();
    try {
      map[k.trim()] = decodeURIComponent(raw);
    } catch {
      map[k.trim()] = raw;
    }
  });
  return map;
}

function isAdminReq(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies.adminToken;
  if (!token) return false;
  try {
    const decoded = verifyToken(token) as { role?: string } | null;
    return Boolean(decoded && decoded.role === "admin");
  } catch {
    return false;
  }
}

function monthFromPayment(payment: UnknownRecord): number {
  const rawMeta = isRecord(payment.rawMeta) ? payment.rawMeta : {};
  const candidateFromRawMeta = toNum(rawMeta.monthIndex);
  if (candidateFromRawMeta > 0) return Math.round(candidateFromRawMeta);

  const allocation = payment.allocation;
  if (isRecord(allocation)) {
    const allocationMonth = toNum(allocation.monthIndex);
    if (allocationMonth > 0) return Math.round(allocationMonth);
  }

  const allocated = Array.isArray(payment.allocated) ? payment.allocated : [];
  let maxAllocated = 0;
  for (const row of allocated) {
    if (!isRecord(row)) continue;
    const m = toNum(row.monthIndex);
    if (!Number.isFinite(m)) continue;
    if (m >= 0) {
      maxAllocated = Math.max(maxAllocated, Math.round(m + 1));
    }
  }
  if (maxAllocated > 0) return maxAllocated;

  return 0;
}

function extractMonthAllocations(payment: UnknownRecord): Array<{ monthIndex: number; amount: number }> {
  const out: Array<{ monthIndex: number; amount: number }> = [];

  const push = (month: unknown, amount: unknown, zeroBased = false) => {
    const mRaw = toNum(month);
    const a = toNum(amount);
    if (!Number.isFinite(mRaw) || !Number.isFinite(a) || a <= 0) return;
    const monthIndex = zeroBased ? Math.round(mRaw + 1) : Math.round(mRaw);
    if (monthIndex <= 0) return;
    out.push({ monthIndex, amount: a });
  };

  const allocated = Array.isArray(payment.allocated) ? payment.allocated : [];
  for (const row of allocated) {
    if (!isRecord(row)) continue;
    push(row.monthIndex, row.amount, true);
  }

  const allocationDetailsRaw = isRecord(payment.rawMeta) ? payment.rawMeta.allocationDetails : undefined;
  const allocationDetails = Array.isArray(allocationDetailsRaw) ? allocationDetailsRaw : [];
  for (const row of allocationDetails) {
    if (!isRecord(row)) continue;
    const amount = toNum(row.principalPaid) + toNum(row.penaltyPaid);
    push(row.monthIndex, amount, false);
  }

  if (!out.length) {
    const month = monthFromPayment(payment);
    const amount = toNum(payment.amount);
    if (month > 0 && amount > 0) {
      out.push({ monthIndex: month, amount });
    }
  }

  return out;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdminReq(req)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const groupId = toStr(searchParams.get("groupId"));
    const slotIdsParam = toStr(searchParams.get("slotIds"));
    const slotIds = slotIdsParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!groupId) {
      return NextResponse.json({ success: false, message: "groupId is required" }, { status: 400 });
    }
    if (!slotIds.length) {
      return NextResponse.json({ success: true, rows: [] });
    }

    const groupRaw = (await Group.findById(groupId).lean()) as UnknownRecord | null;
    if (!groupRaw) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const totalMonths = Math.max(1, Math.round(toNum(groupRaw.totalMonths) || 1));

    const slots = normalizeGroupMemberSlots(groupRaw.members);
    const slotMap = new Map(
      slots.map((s) => [toStr(s.slotId), { memberId: toStr(s.memberId), memberName: toStr(s.name) }]),
    );

    const memberIds = Array.from(
      new Set(
        slotIds
          .map((sid) => slotMap.get(sid)?.memberId || "")
          .filter(Boolean),
      ),
    );

    const paymentDocs = (await Payment.find({
      groupId,
      status: "approved",
      $or: [
        { memberSlotId: { $in: slotIds } },
        { memberId: { $in: memberIds } },
      ],
    })
      .select("memberSlotId memberId amount rawMeta allocation allocated")
      .lean()) as UnknownRecord[];

    const maxPaidBySlot = new Map<string, number>();
    const maxPaidByMember = new Map<string, number>();
    const amountBySlot = new Map<string, Map<number, number>>();
    const amountByMember = new Map<string, Map<number, number>>();
    for (const p of paymentDocs) {
      const slotId = toStr(p.memberSlotId);
      const memberId = toStr(p.memberId);
      const allocations = extractMonthAllocations(p);

      for (const alloc of allocations) {
        if (memberId) {
          const mm = amountByMember.get(memberId) ?? new Map<number, number>();
          mm.set(alloc.monthIndex, (mm.get(alloc.monthIndex) ?? 0) + alloc.amount);
          amountByMember.set(memberId, mm);
          maxPaidByMember.set(memberId, Math.max(maxPaidByMember.get(memberId) ?? 0, alloc.monthIndex));
        }

        if (slotId) {
          const sm = amountBySlot.get(slotId) ?? new Map<number, number>();
          sm.set(alloc.monthIndex, (sm.get(alloc.monthIndex) ?? 0) + alloc.amount);
          amountBySlot.set(slotId, sm);
          maxPaidBySlot.set(slotId, Math.max(maxPaidBySlot.get(slotId) ?? 0, alloc.monthIndex));
        }
      }

      const usedMonth = monthFromPayment(p);
      if (memberId && usedMonth > 0) {
        maxPaidByMember.set(memberId, Math.max(maxPaidByMember.get(memberId) ?? 0, usedMonth));
      }
      if (!slotId) continue;
      if (usedMonth <= 0) continue;
      maxPaidBySlot.set(slotId, Math.max(maxPaidBySlot.get(slotId) ?? 0, usedMonth));
    }

    const ledgerRows = (await MemberLedger.find({
      groupId,
      memberId: { $in: memberIds },
      penaltyAmount: { $gt: 0 },
    })
      .select("memberId monthIndex penaltyAmount status")
      .lean()) as UnknownRecord[];

    const penaltyByMember = new Map<string, Map<number, number>>();
    for (const row of ledgerRows) {
      const memberId = toStr(row.memberId);
      if (!memberId) continue;
      const status = toStr(row.status).toLowerCase();
      if (status === "paid") continue;

      const monthIndex = Math.max(1, Math.round(toNum(row.monthIndex) + 1));
      const penaltyAmount = Math.max(0, Math.round(toNum(row.penaltyAmount)));
      if (penaltyAmount <= 0) continue;

      const map = penaltyByMember.get(memberId) ?? new Map<number, number>();
      map.set(monthIndex, (map.get(monthIndex) ?? 0) + penaltyAmount);
      penaltyByMember.set(memberId, map);
    }

    const rows = slotIds.map((slotId) => {
      const slotMeta = slotMap.get(slotId);
      const memberId = slotMeta?.memberId ?? "";
      const slotPaid = maxPaidBySlot.get(slotId) ?? 0;
      const memberPaid = memberId ? maxPaidByMember.get(memberId) ?? 0 : 0;
      const paidTillMonth = slotPaid > 0 ? slotPaid : memberPaid;
      const nextMonth = Math.min(totalMonths, Math.max(1, paidTillMonth + 1));
      const slotMonthMap = amountBySlot.get(slotId);
      const memberMonthMap = memberId ? amountByMember.get(memberId) : undefined;
      const sourceMap = slotMonthMap && slotMonthMap.size > 0 ? slotMonthMap : memberMonthMap;
      const monthAmounts = sourceMap
        ? Array.from(sourceMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([monthIndex, amount]) => ({
              monthIndex,
              amount: Math.round(amount),
            }))
        : [];
      const memberPenaltyMap = memberId ? penaltyByMember.get(memberId) : undefined;
      const monthPenalties = memberPenaltyMap
        ? Array.from(memberPenaltyMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([monthIndex, penaltyAmount]) => ({
              monthIndex,
              penaltyAmount: Math.round(penaltyAmount),
            }))
        : [];

      return {
        slotId,
        memberId,
        memberName: slotMeta?.memberName ?? "",
        paidTillMonth,
        nextMonth,
        monthAmounts,
        monthPenalties,
      };
    });

    return NextResponse.json({ success: true, rows, totalMonths });
  } catch (error) {
    console.error("GET /api/collections/member-month-progress error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
