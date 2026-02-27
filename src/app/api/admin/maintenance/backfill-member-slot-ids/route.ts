import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import Group from "@/app/models/ChitGroup";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";
import mongoose from "mongoose";

type UnknownRecord = Record<string, unknown>;

const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v).trim();

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type MissingSlotPayment = {
  _id: mongoose.Types.ObjectId | string;
  memberId?: mongoose.Types.ObjectId | string;
  groupId?: mongoose.Types.ObjectId | string;
  memberSlotId?: string;
  rawMeta?: unknown;
  allocated?: unknown;
  createdAt?: Date | string;
};

type ResolveOutcome =
  | {
      slotId: string;
      source:
        | "rawMeta"
        | "group-single-slot"
        | "month-gap"
        | "balanced-fallback";
    }
  | { slotId: ""; reason: string };

type GroupSlotCache = {
  loaded: boolean;
  memberToSlots: Map<string, string[]>;
  slotToMember: Map<string, string>;
};

type MemberGroupContext = {
  monthToUsedSlots: Map<number, Set<string>>;
  slotAssignmentCount: Map<string, number>;
};

const MAX_LIMIT = 50000;
const DEFAULT_LIMIT = 10000;
const UNRESOLVED_SAMPLE_LIMIT = 250;
const BULK_BATCH_SIZE = 500;

function getRawMetaSlotId(rawMeta: unknown): string {
  if (!isRecord(rawMeta)) return "";
  return toStr(rawMeta.memberSlotId ?? rawMeta.slotId);
}

function buildGroupSlotCache(groupDoc: UnknownRecord | null): GroupSlotCache {
  const cache: GroupSlotCache = {
    loaded: Boolean(groupDoc),
    memberToSlots: new Map<string, string[]>(),
    slotToMember: new Map<string, string>(),
  };
  if (!groupDoc) return cache;

  const slots = normalizeGroupMemberSlots(groupDoc.members);
  for (const slot of slots) {
    const memberId = toStr(slot.memberId);
    const slotId = toStr(slot.slotId);
    if (!memberId || !slotId) continue;
    cache.slotToMember.set(slotId, memberId);
    const arr = cache.memberToSlots.get(memberId) ?? [];
    arr.push(slotId);
    cache.memberToSlots.set(memberId, arr);
  }
  return cache;
}

function extractMonthOneBased(payment: {
  rawMeta?: unknown;
  allocated?: unknown;
}): number {
  if (isRecord(payment.rawMeta)) {
    const n = Number(payment.rawMeta.monthIndex);
    if (Number.isFinite(n) && n > 0) return Math.round(n);

    const detailsRaw = payment.rawMeta.allocationDetails;
    if (Array.isArray(detailsRaw)) {
      for (const row of detailsRaw) {
        if (!isRecord(row)) continue;
        const d = Number(row.monthIndex);
        if (Number.isFinite(d) && d > 0) return Math.round(d);
      }
    }
  }

  if (Array.isArray(payment.allocated)) {
    for (const row of payment.allocated) {
      if (!isRecord(row)) continue;
      const n = Number(row.monthIndex);
      if (!Number.isFinite(n)) continue;
      if (n >= 0) return Math.round(n) + 1;
    }
  }

  return 0;
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const groupId = toStr(body.groupId);
    const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.round(limitRaw)))
      : DEFAULT_LIMIT;

    if (groupId && !mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json(
        { success: false, message: "Invalid groupId" },
        { status: 400 },
      );
    }

    const query: Record<string, unknown> = {
      $or: [
        { memberSlotId: { $exists: false } },
        { memberSlotId: null },
        { memberSlotId: "" },
      ],
    };
    if (groupId) query.groupId = groupId;

    const docs = (await Payment.find(query)
      .select("_id memberId groupId memberSlotId rawMeta allocated createdAt")
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean()) as MissingSlotPayment[];

    const groupCache = new Map<string, GroupSlotCache>();
    const memberGroupCtxCache = new Map<string, MemberGroupContext>();
    const unresolved: Array<Record<string, string>> = [];
    const updates: Array<{ _id: string; slotId: string; source: string }> = [];

    const loadMemberGroupCtx = async (memberId: string, paymentGroupId: string) => {
      const key = `${paymentGroupId}::${memberId}`;
      const existing = memberGroupCtxCache.get(key);
      if (existing) return existing;

      const rows = (await Payment.find({
        groupId: paymentGroupId,
        memberId,
        memberSlotId: { $exists: true, $nin: [null, ""] },
      })
        .select("_id memberSlotId rawMeta allocated")
        .lean()) as Array<{
        memberSlotId?: unknown;
        rawMeta?: unknown;
        allocated?: unknown;
      }>;

      const ctx: MemberGroupContext = {
        monthToUsedSlots: new Map<number, Set<string>>(),
        slotAssignmentCount: new Map<string, number>(),
      };

      for (const row of rows) {
        const sid = toStr(row.memberSlotId);
        if (!sid) continue;
        ctx.slotAssignmentCount.set(sid, (ctx.slotAssignmentCount.get(sid) ?? 0) + 1);

        const month = extractMonthOneBased(row);
        if (!month) continue;
        const used = ctx.monthToUsedSlots.get(month) ?? new Set<string>();
        used.add(sid);
        ctx.monthToUsedSlots.set(month, used);
      }

      memberGroupCtxCache.set(key, ctx);
      return ctx;
    };

    const resolveForPayment = async (
      p: MissingSlotPayment,
    ): Promise<ResolveOutcome> => {
      const paymentId = toStr(p._id);
      const memberId = toStr(p.memberId);
      const paymentGroupId = toStr(p.groupId);

      if (!paymentId) return { slotId: "", reason: "invalid-payment-id" };
      if (!memberId) return { slotId: "", reason: "missing-member-id" };
      if (!paymentGroupId) return { slotId: "", reason: "missing-group-id" };

      const rawMetaSlotId = getRawMetaSlotId(p.rawMeta);
      if (rawMetaSlotId) {
        let cache = groupCache.get(paymentGroupId);
        if (!cache) {
          const g = (await Group.findById(paymentGroupId)
            .select("members")
            .lean()) as UnknownRecord | null;
          cache = buildGroupSlotCache(g);
          groupCache.set(paymentGroupId, cache);
        }

        const linkedMember = cache.slotToMember.get(rawMetaSlotId);
        if (!linkedMember || linkedMember === memberId) {
          return { slotId: rawMetaSlotId, source: "rawMeta" };
        }
        return { slotId: "", reason: "rawMeta-slot-mismatch" };
      }

      let cache = groupCache.get(paymentGroupId);
      if (!cache) {
        const g = (await Group.findById(paymentGroupId)
          .select("members")
          .lean()) as UnknownRecord | null;
        cache = buildGroupSlotCache(g);
        groupCache.set(paymentGroupId, cache);
      }

      if (!cache.loaded) return { slotId: "", reason: "group-not-found" };

      const candidateSlots = cache.memberToSlots.get(memberId) ?? [];
      if (candidateSlots.length === 1) {
        return { slotId: candidateSlots[0], source: "group-single-slot" };
      }
      if (candidateSlots.length <= 0) {
        return { slotId: "", reason: "member-not-in-group" };
      }

      const ctx = await loadMemberGroupCtx(memberId, paymentGroupId);
      const month = extractMonthOneBased(p);

      if (month > 0) {
        const used = ctx.monthToUsedSlots.get(month) ?? new Set<string>();
        const available = candidateSlots.filter((sid) => !used.has(sid));
        if (available.length === 1) {
          return { slotId: available[0], source: "month-gap" };
        }
      }

      const balanced = [...candidateSlots].sort((a, b) => {
        const ca = ctx.slotAssignmentCount.get(a) ?? 0;
        const cb = ctx.slotAssignmentCount.get(b) ?? 0;
        if (ca !== cb) return ca - cb;
        return a.localeCompare(b);
      });
      if (!balanced.length) return { slotId: "", reason: "no-candidate-slots" };

      return { slotId: balanced[0], source: "balanced-fallback" };
    };

    for (const p of docs) {
      const paymentId = toStr(p._id);
      const memberId = toStr(p.memberId);
      const paymentGroupId = toStr(p.groupId);

      const resolved = await resolveForPayment(p);
      if (!resolved.slotId) {
        if (unresolved.length < UNRESOLVED_SAMPLE_LIMIT) {
          unresolved.push({
            paymentId,
            groupId: paymentGroupId,
            memberId,
            reason: resolved.reason,
          });
        }
        continue;
      }

      updates.push({
        _id: paymentId,
        slotId: resolved.slotId,
        source: resolved.source,
      });

      const key = `${paymentGroupId}::${memberId}`;
      const ctx = memberGroupCtxCache.get(key);
      if (ctx) {
        ctx.slotAssignmentCount.set(
          resolved.slotId,
          (ctx.slotAssignmentCount.get(resolved.slotId) ?? 0) + 1,
        );
        const month = extractMonthOneBased(p);
        if (month > 0) {
          const used = ctx.monthToUsedSlots.get(month) ?? new Set<string>();
          used.add(resolved.slotId);
          ctx.monthToUsedSlots.set(month, used);
        }
      }
    }

    let modified = 0;
    if (!dryRun && updates.length) {
      for (let i = 0; i < updates.length; i += BULK_BATCH_SIZE) {
        const chunk = updates.slice(i, i + BULK_BATCH_SIZE);
        const operations = chunk.map((u) => ({
          updateOne: {
            filter: {
              _id: u._id,
              $or: [
                { memberSlotId: { $exists: false } },
                { memberSlotId: null },
                { memberSlotId: "" },
              ],
            },
            update: {
              $set: {
                memberSlotId: u.slotId,
                "rawMeta.memberSlotId": u.slotId,
              },
            },
          },
        }));

        const res = await Payment.bulkWrite(operations, { ordered: false });
        modified += Number(res.modifiedCount || 0);
      }
    }

    const bySource = updates.reduce<Record<string, number>>((acc, item) => {
      acc[item.source] = (acc[item.source] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      dryRun,
      scope: groupId || "all-groups",
      scannedMissingPayments: docs.length,
      resolvablePayments: updates.length,
      modifiedPayments: dryRun ? 0 : modified,
      unresolvedCount: Math.max(0, docs.length - updates.length),
      resolvedBySource: bySource,
      unresolvedSample: unresolved,
      note: dryRun
        ? "Dry run only. Send { dryRun: false } to apply updates."
        : "Backfill completed for missing memberSlotId payments.",
    });
  } catch (error) {
    console.error(
      "POST /api/admin/maintenance/backfill-member-slot-ids error:",
      error,
    );
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
