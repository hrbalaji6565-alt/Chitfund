"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Search as SearchIcon, Calendar, Filter } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import type { ChitGroup } from "@/app/lib/types";
import { fetchGroups } from "@/store/chitGroupSlice";
import { fetchMembers } from "@/store/memberSlice";
import type { RootState, AppDispatch } from "@/store/store";

type UnknownRecord = Record<string, unknown>;

type Member = { _id: string; id: string; name?: string; email?: string };

type AllocationDetail = {
  monthIndex: number;
  principalPaid: number;
  penaltyPaid: number;
};

type PaymentRow = {
  id: string;
  memberId?: string;
  memberSlotId?: string;
  memberKey?: string;
  memberName?: string;
  amount: number;
  date?: string;
  type?: string;
  reference?: string;
  allocation?: { monthIndex?: number } | null;
  allocationDetails?: AllocationDetail[];
  source?: "payment" | "contribution";
};

type BidRow = {
  id: string;
  memberId: string;
  memberName?: string;
  discountOffered: number;
  createdAt?: string;
};

type AuctionDisplay = {
  winningMemberId: string;
  winningDiscount: number;
  winningPayout: number;
  distributedToMembers: Array<{ memberId: string; amount: number }>;
  perMemberDiscount?: number;
  adminCommissionAmount?: number;
  totalPot?: number;
  winningBidAmount?: number;
};

type PaymentsMeta = {
  expectedMonthlyTotal: number;
  perMemberInstallment: number;
  currentMonthIndex: number;
  totalMembers: number;
  monthlyCollected: number;
};

type GroupSlot = {
  memberId: string;
  slotId: string;
  slotIndex: number;
  name?: string;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toStr = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v);

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n: number): string => n.toLocaleString("en-IN");

/** months since startDate (1-based) */
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

const extractArray = (
  obj: unknown,
  keys: string[] = [
    "payments",
    "payment",
    "data",
    "contributions",
    "contribution",
    "bids",
  ],
): unknown[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (isRecord(obj)) {
    for (const k of keys) {
      const value = obj[k];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
};

const normalizeMemberId = (raw: unknown): string => {
  if (!raw) return "UNKNOWN";
  if (typeof raw === "string") return raw;
  if (isRecord(raw) && (raw._id || raw.id)) {
    return String(raw._id ?? raw.id);
  }
  return String(raw);
};

const buildMonthColumns = (group?: ChitGroup) => {
  if (!group) return [] as { idx: number; label: string }[];
  const totalMonths = safeNum(group.totalMonths || 0);
  const months: { idx: number; label: string }[] = [];
  for (let i = 1; i <= (totalMonths || 1); i += 1) {
    months.push({ idx: i, label: `M${i}` });
  }
  return months;
};

const computeMetaFromGroup = (
  group: ChitGroup,
  monthlyCollected: number,
): PaymentsMeta => {
  const totalMembers = Math.max(
    1,
    safeNum(
      group.totalMembers ??
      (Array.isArray(group.members)
        ? (group.members as unknown[]).length
        : 0),
    ),
  );
  const monthlyFromModel = safeNum(group.monthlyInstallment);
  const chitValue = safeNum(group.chitValue);
  const totalMonths = Math.max(1, safeNum(group.totalMonths));
  const expectedMonthlyTotal =
    monthlyFromModel > 0
      ? monthlyFromModel * totalMembers
      : chitValue > 0
        ? Math.round(chitValue / totalMonths)
        : 0;
  const perMemberInstallment =
    monthlyFromModel > 0
      ? Math.round(monthlyFromModel)
      : Math.round(expectedMonthlyTotal / totalMembers);
  const currentMonthIndex = monthsElapsedSinceStart(group.startDate ?? "");

  return {
    expectedMonthlyTotal,
    perMemberInstallment,
    currentMonthIndex,
    totalMembers,
    monthlyCollected,
  };
};

const normalizeGroupSlots = (group?: ChitGroup): GroupSlot[] => {
  if (!group || !Array.isArray(group.members)) return [];
  const out: GroupSlot[] = [];
  for (let i = 0; i < group.members.length; i += 1) {
    const raw = group.members[i];
    if (typeof raw === "string" || typeof raw === "number") {
      const memberId = String(raw);
      out.push({
        memberId,
        slotId: `${memberId}:legacy:${i + 1}`,
        slotIndex: i + 1,
      });
      continue;
    }
    if (isRecord(raw)) {
      const memberId = String(raw.memberId ?? raw._id ?? raw.id ?? "");
      if (!memberId) continue;
      const slotId = String(
        raw.slotId ?? raw.memberSlotId ?? `${memberId}:legacy:${i + 1}`,
      );
      out.push({
        memberId,
        slotId,
        slotIndex: i + 1,
        name: typeof raw.name === "string" ? raw.name : undefined,
      });
    }
  }
  return out;
};

const parseAllocationArray = (input: unknown): AllocationDetail[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const out: AllocationDetail[] = [];

  for (const item of input) {
    if (!isRecord(item)) continue;
    const rawMonth = item.monthIndex ?? item.idx ?? item.month ?? item.mindex;
    let monthIndex =
      typeof rawMonth === "number" ? rawMonth : toNumber(rawMonth);
    if (monthIndex >= 0 && monthIndex < 1) monthIndex += 1;

    const principalPaid = toNumber(
      item.principalPaid ?? item.principal ?? item.amount ?? item.apply ?? 0,
    );
    const penaltyPaid = toNumber(
      item.penaltyPaid ?? item.penalty ?? item.penaltyApplied ?? 0,
    );

    out.push({
      monthIndex: Math.max(1, Math.round(monthIndex)),
      principalPaid,
      penaltyPaid,
    });
  }

  return out.length ? out : undefined;
};

const shouldShiftAllocated = (
  raw: unknown,
  totalMonths?: number,
): boolean => {
  if (!Array.isArray(raw)) return false;
  let maxIdx = -1;
  let minIdx = Number.POSITIVE_INFINITY;
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const m = item.monthIndex;
    if (typeof m === "number" && m === 0) return true;
    if (typeof m === "string" && Number(m) === 0) return true;
    const n = typeof m === "number" ? m : Number(m);
    if (Number.isFinite(n)) {
      maxIdx = Math.max(maxIdx, n);
      minIdx = Math.min(minIdx, n);
    }
  }
  if (minIdx !== Number.POSITIVE_INFINITY && minIdx >= 1) {
    // Looks 1-based (even if M1 missing), so don't shift.
    return false;
  }
  if (typeof totalMonths === "number" && totalMonths > 0) {
    // Ledger allocations are 0-based; if max fits 0..totalMonths-1, assume 0-based.
    if (maxIdx >= 0 && maxIdx <= totalMonths - 1) return true;
    if (maxIdx === totalMonths) return false;
  }
  // Default: assume 1-based to avoid shifting into next month.
  return false;
};

const normalizeAllocationMonths = (
  arr: AllocationDetail[],
  shiftOneBased: boolean,
): AllocationDetail[] => {
  if (!shiftOneBased) return arr;
  return arr.map((a) => ({
    ...a,
    monthIndex: Math.max(1, Math.round((a.monthIndex ?? 0) + 1)),
  }));
};

const parseAllocationsFromPayment = (
  raw: UnknownRecord,
  totalMonths?: number,
): AllocationDetail[] | undefined => {
  const shiftAllocatedTop = shouldShiftAllocated(raw.allocated, totalMonths);
  const shiftAllocatedRawMeta = isRecord(raw.rawMeta)
    ? shouldShiftAllocated(raw.rawMeta.allocated, totalMonths)
    : false;

  const candidates: Array<{ value: unknown; shiftOneBased: boolean }> = [
    { value: raw.allocationDetails, shiftOneBased: false },
    { value: raw.allocationSummary, shiftOneBased: false },
    { value: raw.allocation, shiftOneBased: false },
  ];

  if (isRecord(raw.rawMeta)) {
    const rm = raw.rawMeta;
    candidates.push(
      { value: rm.allocationDetails, shiftOneBased: false },
      { value: rm.allocationSummary, shiftOneBased: false },
      { value: rm.allocation, shiftOneBased: false },
      { value: rm.appliedAllocation, shiftOneBased: false },
      {
        value: rm.allocated,
        shiftOneBased: shiftAllocatedRawMeta,
      },
    );
  }

  candidates.push({
    value: raw.allocated,
    shiftOneBased: shiftAllocatedTop,
  });

  for (const c of candidates) {
    if (typeof c.value === "string") {
      try {
        const parsed = JSON.parse(c.value) as unknown;
        const arr = parseAllocationArray(parsed);
        if (arr && arr.length) {
          return normalizeAllocationMonths(arr, c.shiftOneBased);
        }
      } catch {
        // ignore
      }
    } else {
      const arr = parseAllocationArray(c.value);
      if (arr && arr.length) {
        return normalizeAllocationMonths(arr, c.shiftOneBased);
      }
    }
  }

  return undefined;
};

function AdminChitsPage() {
  const dispatch = useDispatch<AppDispatch>();

  const chitGroups = useSelector(
    (s: RootState) =>
      (s as unknown as Record<string, unknown>)["chitGroups"] as
      | Record<string, unknown>
      | undefined,
  );

  const groups: ChitGroup[] = useMemo(() => {
    if (!chitGroups) return [];
    const arr =
      (Array.isArray(chitGroups.list)
        ? chitGroups.list
        : Array.isArray(chitGroups.items)
          ? chitGroups.items
          : Array.isArray(chitGroups.groups)
            ? chitGroups.groups
            : []) ?? [];
    return (arr as unknown[]).filter(isRecord) as unknown as ChitGroup[];
  }, [chitGroups]);

  const fetchStatus = (chitGroups?.status as string | undefined) ?? "idle";

  const membersFromStore = useSelector((s: RootState) => {
    const ms = (s as unknown as Record<string, unknown>)["members"] as
      | Record<string, unknown>
      | undefined;
    const arr = Array.isArray(ms?.list)
      ? ms.list
      : Array.isArray(ms?.items)
        ? ms.items
        : Array.isArray(ms?.members)
          ? ms.members
          : [];
    return (arr as unknown[]).map((it) => {
      if (isRecord(it)) {
        const baseId = String(it._id ?? it.id ?? "");
        const id = String(it.id ?? it._id ?? baseId);
        return {
          _id: baseId,
          id,
          name: typeof it.name === "string" ? it.name : undefined,
          email: typeof it.email === "string" ? it.email : undefined,
        } as Member;
      }
      const val = String(it ?? "");
      return { _id: val, id: val } as Member;
    });
  });

  useEffect(() => {
    if (fetchStatus === "idle") {
      dispatch(fetchGroups());
    }
    if (!membersFromStore.length) {
      dispatch(fetchMembers());
    }
  }, [dispatch, fetchStatus, membersFromStore.length]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [meta, setMeta] = useState<PaymentsMeta | null>(null);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [auction, setAuction] = useState<AuctionDisplay | null>(null);
  const [paymentsMatrix, setPaymentsMatrix] = useState<
    Map<string, Map<number, number>>
  >(new Map());
  const [memberNamesMap, setMemberNamesMap] = useState<
    Record<string, string | undefined>
  >({});
  const [pendingRequests, setPendingRequests] = useState<PaymentRow[]>([]);

  const [biddingOpen, setBiddingOpen] = useState(false);
  const [auctionRunning, setAuctionRunning] = useState(false);
  const [biddingStatusMsg, setBiddingStatusMsg] = useState<string | null>(
    null,
  );

  // NEW: manual bid state for admin
  const [manualBidMemberId, setManualBidMemberId] = useState<string>("");
  const [manualBidAmount, setManualBidAmount] = useState<number | "">("");
  const [manualBidSubmitting, setManualBidSubmitting] = useState(false);

  const membersSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    const pairs = membersFromStore
      .map((m: Member) => `${m._id}|${m.name ?? ""}`)
      .sort();
    const snap = pairs.join(";;");
    if (membersSnapshotRef.current === snap) return;
    membersSnapshotRef.current = snap;
    const map: Record<string, string | undefined> = {};
    for (const p of pairs) {
      const [id, ...rest] = p.split("|");
      map[id] = rest.join("|") || undefined;
    }
    setMemberNamesMap((prev) => ({ ...prev, ...map }));
  }, [membersFromStore]);

  const funds = useMemo(
    () =>
      (groups ?? []).map((g) => {
        const totalAmount = safeNum(g.chitValue);
        const monthly = safeNum(g.monthlyInstallment);
        const totalMonths = safeNum(g.totalMonths);
        const monthsPassed = Math.min(
          totalMonths || Infinity,
          monthsElapsedSinceStart(g.startDate ?? ""),
        );
        const collectedAmount = Math.min(totalAmount, monthly * monthsPassed);
        const id = String(g._id ?? g.id ?? Math.random());
        return {
          id,
          fundName: g.name ?? "Untitled",
          groupName: g.name ?? "Untitled",
          totalAmount,
          collectedAmount,
          pendingAmount: Math.max(0, totalAmount - collectedAmount),
          startDate: g.startDate ?? "",
          maturityDate: g.endDate ?? "",
          status: String(g.status ?? "Active"),
          interestRate: safeNum((g as UnknownRecord).interestRate),
          numberOfInstallments: safeNum(g.totalMonths),
          completedInstallments: monthsPassed,
          rawGroup: g,
        } as const;
      }),
    [groups],
  );

  const filteredFunds = useMemo(
    () =>
      funds.filter((f) => {
        const s = searchTerm.trim().toLowerCase();
        if (!s) {
          return statusFilter === "all" ? true : f.status === statusFilter;
        }
        return (
          (f.fundName + " " + f.groupName).toLowerCase().includes(s) &&
          (statusFilter === "all" || f.status === statusFilter)
        );
      }),
    [funds, searchTerm, statusFilter],
  );

  const fetchPaymentsForGroup = async (groupId: string) => {
    setErrorText(null);
    setRows([]);
    setMeta(null);
    setBids([]);
    setAuction(null);
    setPaymentsMatrix(new Map());
    setPendingRequests([]);
    setOpenGroupId(groupId);
    setLoading(true);
    setBiddingOpen(false);
    setBiddingStatusMsg(null);
    setManualBidMemberId("");
    setManualBidAmount("");

    const group = (groups ?? []).find(
      (g) => String(g._id ?? g.id) === groupId,
    ) as ChitGroup | undefined;
    const groupSlots = normalizeGroupSlots(group);

    const fetchWithFallback = async (
      url: string,
      postBody?: UnknownRecord,
    ): Promise<Response> => {
      const first = await fetch(url, { method: "GET" });
      if (first.ok || !postBody) return first;
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });
    };

    try {
      const [pRes, bRes, aRes] = await Promise.all([
        fetchWithFallback(
          `/api/chitgroups/${encodeURIComponent(groupId)}/payments?all=true`,
          { all: true },
        ),
        fetchWithFallback(
          `/api/chitgroups/${encodeURIComponent(groupId)}/bids?all=true`,
          { all: true },
        ),
        fetchWithFallback(
          `/api/chitgroups/${encodeURIComponent(groupId)}/auction?all=true`,
          { all: true },
        ),
      ]);

      if (!pRes.ok) {
        const pj: unknown = await pRes.json().catch(() => ({}));
        setErrorText(
          isRecord(pj)
            ? String(
              pj.error ?? (pj as UnknownRecord).message ?? pRes.statusText,
            )
            : pRes.statusText,
        );
        setLoading(false);
        return;
      }

      const pJson: unknown = await pRes.json().catch(() => ({}));
      const bJson: unknown = await bRes.json().catch(() => []);
      const aJson: unknown = await aRes.json().catch(() => ({}));

      const nameMap: Record<string, string | undefined> = { ...memberNamesMap };
      const slotsByMember = new Map<string, GroupSlot[]>();
      const slotById = new Map<string, GroupSlot>();
      for (const s of groupSlots) {
        if (!slotsByMember.has(s.memberId)) slotsByMember.set(s.memberId, []);
        slotsByMember.get(s.memberId)!.push(s);
        slotById.set(s.slotId, s);
      }
      for (const s of groupSlots) {
        const baseName = nameMap[s.memberId] ?? s.name ?? s.memberId;
        nameMap[s.memberId] = baseName;
        nameMap[s.slotId] = `${baseName} (Slot ${s.slotIndex})`;
      }

      const paymentsArr = extractArray(pJson);

      const byMember = new Map<
        string,
        { paid: number; rows: PaymentRow[] }
      >();
      const matrix = new Map<string, Map<number, number>>();
      const pending: PaymentRow[] = [];

      const addRow = (memberKey: string, row: PaymentRow) => {
        if (!byMember.has(memberKey)) {
          byMember.set(memberKey, { paid: 0, rows: [] });
        }
        const rec = byMember.get(memberKey)!;
        rec.rows.push(row);
        rec.paid += row.amount;
      };

      const currentMonthIndex = group
        ? monthsElapsedSinceStart(group.startDate ?? "")
        : 1;

      if (group) {
        const rawBiddingOpen =
          (group as UnknownRecord | undefined)?.biddingOpen;
        const rawBiddingMonth =
          (group as UnknownRecord | undefined)?.biddingMonthIndex;

        const persistedBiddingMonth =
          safeNum(rawBiddingMonth) || currentMonthIndex;
        const isOpenNow =
          rawBiddingOpen === true &&
          persistedBiddingMonth === currentMonthIndex;

        setBiddingOpen(isOpenNow);
        setBiddingStatusMsg(
          isOpenNow ? "Bidding started for this month." : null,
        );
      } else {
        setBiddingOpen(false);
        setBiddingStatusMsg("Bidding is currently closed for this month.");
      }

      for (const p of paymentsArr) {
        if (!isRecord(p)) continue;
        const pr = p as UnknownRecord;
        const id =
          toStr(pr._id ?? pr.id ?? Math.random().toString(36).slice(2)) ?? "";
        const amount = safeNum(pr.amount ?? pr.amt ?? pr.payAmount ?? 0);
        const date =
          typeof pr.date === "string"
            ? pr.date
            : typeof pr.createdAt === "string"
              ? pr.createdAt
              : undefined;

        const memberIdRaw: unknown = (() => {
          if (pr.memberId) return pr.memberId;
          const member = pr.member;
          if (isRecord(member)) {
            if (member._id) return member._id;
            if (member.id) return member.id;
            return member;
          }
          if (pr.user) return pr.user;
          if (pr.payer) return pr.payer;
          return "UNKNOWN";
        })();

        const memberId = normalizeMemberId(memberIdRaw);
        const memberSlotId = toStr(pr.memberSlotId ?? pr.slotId);
        const fallbackSlots = slotsByMember.get(memberId) ?? [];
        const derivedKey =
          memberSlotId && slotById.has(memberSlotId)
            ? memberSlotId
            : fallbackSlots.length === 1
              ? fallbackSlots[0].slotId
              : memberId;
        const memberKey = derivedKey;
        let memberName: string | undefined = nameMap[memberId];

        if (
          !memberName &&
          isRecord(pr.member) &&
          typeof pr.member.name === "string"
        ) {
          memberName = pr.member.name;
        }
        if (!nameMap[memberKey]) {
          nameMap[memberKey] = memberName ?? nameMap[memberId] ?? memberId;
        }

        const type =
          typeof pr.type === "string"
            ? pr.type
            : typeof pr.mode === "string"
              ? pr.mode
              : undefined;
        const reference =
          typeof pr.reference === "string"
            ? pr.reference
            : typeof pr.utr === "string"
              ? pr.utr
              : undefined;

        const allocationDetails = parseAllocationsFromPayment(
          pr,
          safeNum(group?.totalMonths ?? 0),
        );

        const allocation = isRecord(pr.allocation)
          ? { monthIndex: safeNum(pr.allocation.monthIndex) || undefined }
          : allocationDetails && allocationDetails.length
            ? { monthIndex: safeNum(allocationDetails[0]?.monthIndex) || undefined }
            : undefined;

        const isApproved =
          pr.status === "approved" ||
          pr.status === "APPROVED" ||
          pr.approved === true;

        const allocMonth =
          typeof allocation?.monthIndex === "number"
            ? allocation.monthIndex
            : allocationDetails && allocationDetails.length
              ? allocationDetails[0]?.monthIndex
              : undefined;

        const row: PaymentRow = {
          id,
          memberId,
          memberSlotId,
          memberKey,
          memberName,
          amount,
          date,
          type,
          reference,
          allocation,
          allocationDetails,
          source: "payment",
        };

        addRow(memberKey, row);

        if (isApproved) {
          if (allocationDetails && allocationDetails.length) {
            for (const ad of allocationDetails) {
              const usedMonth = ad.monthIndex > 0 ? ad.monthIndex : 1;
              if (!matrix.has(memberKey)) matrix.set(memberKey, new Map());
              const mm = matrix.get(memberKey)!;
              mm.set(
                usedMonth,
                (mm.get(usedMonth) ?? 0) + ad.principalPaid,
              );
            }
          } else {
            const usedMonth =
              typeof allocMonth === "number" && allocMonth > 0
                ? allocMonth
                : currentMonthIndex;
            if (!matrix.has(memberKey)) matrix.set(memberKey, new Map());
            const mm = matrix.get(memberKey)!;
            mm.set(usedMonth, (mm.get(usedMonth) ?? 0) + amount);
          }
        } else {
          pending.push(row);
        }
      }

      for (const s of groupSlots) {
        if (!matrix.has(s.slotId)) matrix.set(s.slotId, new Map());
      }

      const modalRows: PaymentRow[] = [];
      let monthlyCollected = 0;
      for (const [mid, mm] of matrix.entries()) {
        const paidThisMonth = Number(mm.get(currentMonthIndex) ?? 0);
        monthlyCollected += paidThisMonth;
        modalRows.push({
          id: `summary_${mid}_${Math.random().toString(36).slice(2)}`,
          memberId: mid,
          memberName: nameMap[mid],
          amount: paidThisMonth,
          type: "PAID_THIS_MONTH",
          allocation: { monthIndex: currentMonthIndex },
          source: "payment",
        });
      }

      for (const rec of Array.from(byMember.values())) {
        for (const r of rec.rows) modalRows.push(r);
      }

      const bidsArr = extractArray(bJson, ["bids", "data"]);
      const normalizedBids: BidRow[] = bidsArr
        .filter(isRecord)
        .map((bRec) => {
          const b = bRec as UnknownRecord;
          const id =
            toStr(b._id ?? b.id ?? Math.random().toString(36).slice(2)) ?? "";
          const memberId = toStr(
            b.memberId ??
            (isRecord(b.member) ? b.member._id : undefined) ??
            "UNKNOWN",
          )!;
          const memberNameFromMember =
            isRecord(b.member) && typeof b.member.name === "string"
              ? b.member.name
              : undefined;
          const memberNameField =
            typeof b.memberName === "string" ? b.memberName : undefined;
          const memberName =
            nameMap[memberId] ??
            memberNameFromMember ??
            memberNameField ??
            memberId;
          nameMap[memberId] = memberName;

          const discountOffered = safeNum(
            (b as { discount?: unknown }).discount ??
            b.discountOffered ??
            b.amount,
          );
          const createdAt =
            typeof b.createdAt === "string"
              ? b.createdAt
              : typeof b.date === "string"
                ? b.date
                : undefined;

          return { id, memberId, memberName, discountOffered, createdAt };
        })
        .sort((a, b) => b.discountOffered - a.discountOffered);

      setBids(normalizedBids);

      let auctionDisplay: AuctionDisplay | null = null;
      let auctionRaw: UnknownRecord | null = null;

      if (isRecord(aJson)) {
        const aRec = aJson as UnknownRecord;
        if (isRecord(aRec.auction)) {
          auctionRaw = aRec.auction as UnknownRecord;
        } else if (isRecord(aRec.data)) {
          auctionRaw = aRec.data as UnknownRecord;
        }
      }

      const baseExpectedMonthlyTotal = group
        ? computeMetaFromGroup(group, monthlyCollected).expectedMonthlyTotal
        : 0;

      // total members for per-member discount calculation
      const totalMembersCount =
        group != null
          ? Math.max(
            1,
            safeNum(
              group.totalMembers ??
              (Array.isArray(group.members)
                ? (group.members as unknown[]).length
                : 0),
            ),
          )
          : 0;

      if (auctionRaw) {
        const arc = auctionRaw;

        const winningMemberId = String(
          arc.winningMemberId ??
          arc.winningMember ??
          arc.winner ??
          "NO_WINNER",
        );

        const winningBidAmount = safeNum(
          (arc as { winningBidAmount?: unknown }).winningBidAmount ??
          (arc as { totalBidAmount?: unknown }).totalBidAmount ??
          (arc as { bidAmount?: unknown }).bidAmount ??
          0,
        );

        // ACTUAL CHIT VALUE (AC)
        const totalPot =
          safeNum(
            (arc as { totalPot?: unknown }).totalPot ??
            baseExpectedMonthlyTotal,
          ) || baseExpectedMonthlyTotal;

        // ADMIN COMMISSION (4%)
        const adminCommissionAmount = Math.round(totalPot * 0.04);

        // EXTRA PAID BY BIDDER (BA - AC)
        const extraPaid = Math.max(0, winningBidAmount - totalPot);

        // CUSTOMER PROFIT (EXTRA - ADMIN)
        const winningDiscount = Math.max(
          0,
          extraPaid ,
        );

        // PAYOUT TO AUCTION WINNER (AC - EXTRA)
        const winningPayout = Math.max(
          0,
          totalPot - extraPaid - adminCommissionAmount,
        );

        // PER MEMBER DISCOUNT
        const perMemberDiscount =
          totalMembersCount > 0
            ? Math.round(winningDiscount / totalMembersCount)
            : 0;

        auctionDisplay = {
          winningMemberId,
          winningBidAmount,
          winningDiscount,       // total customer profit
          winningPayout,         // correct payout
          adminCommissionAmount, // always 4%
          totalPot,              // chit value
          perMemberDiscount,     // used for installment reduction
          distributedToMembers: [],
        };
      }


      const baseMeta: PaymentsMeta =
        group != null
          ? computeMetaFromGroup(group, monthlyCollected)
          : {
            expectedMonthlyTotal: baseExpectedMonthlyTotal,
            perMemberInstallment: 0,
            currentMonthIndex,
            totalMembers: 0,
            monthlyCollected,
          };

      let effectiveMeta = baseMeta;

      if (auctionDisplay && auctionDisplay.perMemberDiscount) {
        effectiveMeta = {
          ...baseMeta,
          perMemberInstallment: Math.max(
            0,
            baseMeta.perMemberInstallment -
            auctionDisplay.perMemberDiscount,
          ),
        };
      }

      setRows(modalRows);
      setMeta(effectiveMeta);
      setAuction(auctionDisplay);
      setPaymentsMatrix(matrix);
      setMemberNamesMap({ ...nameMap });
      setPendingRequests(pending);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getGroupById = (id: string | null) =>
    (groups ?? []).find((g) => String(g._id ?? g.id) === id) as
    | ChitGroup
    | undefined;

  const memberDisplay = (id?: string) =>
    id ? memberNamesMap[id] ?? id : "Unknown";

  const resetModal = () => {
    setOpenGroupId(null);
    setRows([]);
    setMeta(null);
    setBids([]);
    setAuction(null);
    setPaymentsMatrix(new Map());
    setPendingRequests([]);
    setBiddingOpen(false);
    setBiddingStatusMsg(null);
    setAuctionRunning(false);
    setManualBidMemberId("");
    setManualBidAmount("");
    setManualBidSubmitting(false);
  };

  const handleStartBidding = async () => {
    if (!openGroupId || !meta) return;
    setErrorText(null);
    try {
      const res = await fetch(
        `/api/chitgroups/${encodeURIComponent(openGroupId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            biddingOpen: true,
            biddingMonthIndex: meta.currentMonthIndex,
          }),
        },
      );

      const json: unknown = await res.json().catch(() => ({}));
      const success =
        isRecord(json) &&
        (json as { success?: unknown }).success === true;

      if (!res.ok || !success) {
        const msg = isRecord(json)
          ? String(
            (json as { error?: unknown }).error ??
            (json as { message?: unknown }).message ??
            res.statusText,
          )
          : res.statusText;
        throw new Error(msg);
      }

      setBiddingOpen(true);
      setBiddingStatusMsg("Bidding started for this month.");
      dispatch(fetchGroups());
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEndBidding = async () => {
    if (!openGroupId || !meta) return;
    setErrorText(null);
    try {
      const res = await fetch(
        `/api/chitgroups/${encodeURIComponent(openGroupId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            biddingOpen: false,
          }),
        },
      );

      const json: unknown = await res.json().catch(() => ({}));
      const success =
        isRecord(json) &&
        (json as { success?: unknown }).success === true;

      if (!res.ok || !success) {
        const msg = isRecord(json)
          ? String(
            (json as { error?: unknown }).error ??
            (json as { message?: unknown }).message ??
            res.statusText,
          )
          : res.statusText;
        throw new Error(msg);
      }

      setBiddingOpen(false);
      setBiddingStatusMsg("Bidding closed for this month.");
      dispatch(fetchGroups());
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRunAuction = async () => {
    if (!openGroupId || !meta) return;
    setAuctionRunning(true);
    setErrorText(null);
    try {
      const res = await fetch(
        `/api/chitgroups/${encodeURIComponent(openGroupId)}/run-auction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthIndex: meta.currentMonthIndex }),
        },
      );
      const json: unknown = await res.json().catch(() => ({}));

      const success =
        isRecord(json) &&
        (json as { success?: unknown }).success === true;

      if (!res.ok || !success) {
        const msg = isRecord(json)
          ? String(
            (json as { error?: unknown }).error ??
            (json as { message?: unknown }).message ??
            res.statusText,
          )
          : res.statusText;
        setErrorText(msg);
        setAuctionRunning(false);
        return;
      }

      await fetchPaymentsForGroup(openGroupId);
      setBiddingOpen(false);
      setBiddingStatusMsg("Auction completed for this month.");
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setAuctionRunning(false);
    }
  };

  // NEW: admin manual bid on behalf of a user
  const handleSubmitManualBid = async () => {
    if (!openGroupId || !meta) return;

    if (!biddingOpen) {
      setErrorText("Bidding must be open to place a manual bid.");
      return;
    }

    if (!manualBidMemberId) {
      setErrorText("Select a member for manual bid.");
      return;
    }

    if (typeof manualBidAmount !== "number" || manualBidAmount <= 0) {
      setErrorText("Enter a valid manual bid amount.");
      return;
    }

    const basePot = meta.expectedMonthlyTotal;
    const adminCommission = Math.round(basePot * 0.04);

    // minimum allowed bid = chit + admin
    const minBid = basePot + adminCommission;

    if (manualBidAmount < minBid) {
      setErrorText(
        `Final bid must be at least ₹${fmt(
          minBid,
        )} (₹${fmt(basePot)} chit + ₹${fmt(adminCommission)} admin).`,
      );
      return;
    }


    const currentTopDiscount = bids.length
      ? bids.reduce(
        (max, b) =>
          b.discountOffered > max ? b.discountOffered : max,
        0,
      )
      : 0;

    const manualDiscount = manualBidAmount - minBid;

    if (manualDiscount <= 0) {
      setErrorText(
        "Manual bid must include some discount for members above (pot + admin commission).",
      );
      return;
    }

    if (manualDiscount <= currentTopDiscount) {
      setErrorText(
        `Manual bid discount (₹${fmt(
          manualDiscount,
        )}) must be higher than current highest discount ₹${fmt(
          currentTopDiscount,
        )}.`,
      );
      return;
    }

    setManualBidSubmitting(true);
    setErrorText(null);

    try {
      const res = await fetch(
        `/api/chitgroups/${encodeURIComponent(openGroupId)}/bids`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            memberId: manualBidMemberId,
            bidAmount: manualBidAmount,
            monthIndex: meta.currentMonthIndex,
            placedByAdmin: true,
          }),
        },
      );

      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = isRecord(json)
          ? String(
            (json as { error?: unknown }).error ??
            (json as { message?: unknown }).message ??
            res.statusText,
          )
          : res.statusText;
        throw new Error(msg);
      }

      // refresh data so bids and breakdown update
      await fetchPaymentsForGroup(openGroupId);
      setManualBidAmount("");
      setManualBidMemberId("");
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setManualBidSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Chit Funds</h1>
          <p className="text-sm text-gray-500">
            Manage groups, payments, bidding and auctions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search groups..."
              className="pl-8 w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              className="border rounded px-2 py-1 text-sm bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Group cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {filteredFunds.map((fund) => (
            <motion.div
              key={fund.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Card className="border border-gray-200 rounded-xl shadow-sm h-full flex flex-col">
                <CardContent className="p-4 flex flex-col gap-3 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-semibold text-base">
                          {fund.fundName}
                        </h2>
                        <Badge
                          variant={
                            fund.status === "Active" ? "default" : "outline"
                          }
                        >
                          {fund.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        Total Chit: ₹{fmt(fund.totalAmount)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div className="flex items-center justify-end gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {fund.startDate} → {fund.maturityDate}
                        </span>
                      </div>
                      <div>
                        {fund.completedInstallments}/
                        {fund.numberOfInstallments} installments
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Collection Progress</span>
                      <span className="font-semibold">
                        {(
                          (fund.collectedAmount /
                            (fund.totalAmount || 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(fund.collectedAmount /
                              (fund.totalAmount || 1)) *
                            100
                            }%`,
                        }}
                        style={{
                          height: "100%",
                          background:
                            "linear-gradient(90deg, #4f46e5, #0ea5e9)",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Collected: ₹{fmt(fund.collectedAmount)}</span>
                      <span>Pending: ₹{fmt(fund.pendingAmount)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-2">
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>
                        Per-member installment:{" "}
                        <span className="font-semibold">
                          {(() => {
                            const raw = fund.rawGroup as
                              | UnknownRecord
                              | undefined;
                            const monthlyFromModel = safeNum(
                              raw?.monthlyInstallment,
                            );
                            const totalMembers = Math.max(
                              1,
                              safeNum(
                                raw?.totalMembers ??
                                (Array.isArray(raw?.members)
                                  ? (raw?.members as unknown[]).length
                                  : 0),
                              ),
                            );
                            const totalMonths = Math.max(
                              1,
                              safeNum(
                                raw?.totalMonths ??
                                fund.numberOfInstallments,
                              ),
                            );
                            if (monthlyFromModel > 0) {
                              return `₹${fmt(Math.round(monthlyFromModel))}`;
                            }
                            const perMember = Math.round(
                              (Number(fund.totalAmount ?? 0) /
                                totalMonths) /
                              totalMembers,
                            );
                            return `₹${fmt(perMember)}`;
                          })()}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="h-9 rounded-xl px-3"
                      onClick={() => fetchPaymentsForGroup(fund.id)}
                    >
                      View Payments
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Payments + Bids + Auction Modal */}
      {openGroupId && meta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={resetModal} />
          <div className="relative max-w-6xl w-full bg-[var(--bg-card)] rounded-xl shadow-lg overflow-auto max-h-[90vh] p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">
                  Group {getGroupById(openGroupId)?.name ?? openGroupId} — Month #
                  {meta.currentMonthIndex}
                </h3>
                <p className="text-xs text-gray-500">
                  Expected pot this month: ₹{fmt(meta.expectedMonthlyTotal)} •
                  Collected: ₹{fmt(meta.monthlyCollected)} • Members:{" "}
                  {meta.totalMembers}
                  {auction?.perMemberDiscount
                    ? ` • Per-member discount this month: ₹${fmt(
                      auction.perMemberDiscount,
                    )}`
                    : ""}
                </p>
                {biddingStatusMsg && (
                  <p className="text-xs text-blue-600 mt-1">
                    {biddingStatusMsg}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {errorText && (
                  <div className="text-xs text-red-600 max-w-xs text-right">
                    {errorText}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={handleStartBidding}
                    disabled={biddingOpen}
                  >
                    Start bidding
                  </Button>
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={handleEndBidding}
                    disabled={!biddingOpen}
                  >
                    End bidding
                  </Button>
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={handleRunAuction}
                    disabled={auctionRunning || bids.length === 0}
                  >
                    {auctionRunning ? "Running..." : "Run auction"}
                  </Button>
                  <Button
                    className="h-8 px-3 text-xs"
                    variant="outline"
                    onClick={resetModal}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>

            {/* Per-member status current month */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">
                Per-member status (this month)
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="p-2">Member</th>
                      <th className="p-2">Expected</th>
                      <th className="p-2">Paid</th>
                      <th className="p-2">Remaining</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const groupObj = getGroupById(openGroupId);
                      const slotList = normalizeGroupSlots(groupObj);
                      const membersList = slotList.map((s) => s.slotId);
                      for (const k of paymentsMatrix.keys()) {
                        if (!membersList.includes(k)) membersList.push(k);
                      }
                      if (!membersList.length) {
                        return (
                          <tr>
                            <td className="p-2" colSpan={5}>
                              No members/payments found for this group.
                            </td>
                          </tr>
                        );
                      }

                      return membersList.map((memberKey) => {
                        const name = memberNamesMap[memberKey] ?? memberKey;
                        const mm = paymentsMatrix.get(memberKey) ?? new Map();
                        const paid = Number(
                          mm.get(meta.currentMonthIndex) ?? 0,
                        );
                        const expected = meta.perMemberInstallment;
                        const remaining = Math.max(0, expected - paid);
                        const statusText =
                          paid >= expected
                            ? "Paid in full"
                            : paid === 0
                              ? "Unpaid"
                              : "Partial";
                        return (
                          <tr key={memberKey} className="border-t">
                            <td className="p-2">{name}</td>
                            <td className="p-2">₹{fmt(expected)}</td>
                            <td className="p-2">₹{fmt(paid)}</td>
                            <td className="p-2">₹{fmt(remaining)}</td>
                            <td className="p-2">
                              <span
                                className={
                                  statusText === "Paid in full"
                                    ? "font-semibold text-green-600"
                                    : statusText === "Partial"
                                      ? "font-semibold text-yellow-600"
                                      : "font-semibold text-red-600"
                                }
                              >
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments by month */}
            <div className="mb-6">
              <div className="text-sm font-medium mb-2">
                Payments by month (member × month)
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs text-gray-500">
                      <th className="p-2 sticky left-0 bg-[var(--bg-card)] z-10">
                        Member
                      </th>
                      {buildMonthColumns(
                        getGroupById(openGroupId),
                      ).map((m) => (
                        <th key={m.idx} className="p-2">
                          {m.label}
                        </th>
                      ))}
                      <th className="p-2">Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const rowsArr: {
                        memberId: string;
                        name?: string;
                        months: Map<number, number>;
                      }[] = [];
                      for (const [mid, map] of paymentsMatrix.entries()) {
                        rowsArr.push({
                          memberId: mid,
                          name: memberNamesMap[mid] ?? undefined,
                          months: map,
                        });
                      }
                      rowsArr.sort((a, b) =>
                        (a.name ?? a.memberId)
                          .toLowerCase()
                          .localeCompare(
                            (b.name ?? b.memberId).toLowerCase(),
                          ),
                      );
                      if (!rowsArr.length) {
                        return (
                          <tr>
                            <td className="p-2" colSpan={20}>
                              No payments data available.
                            </td>
                          </tr>
                        );
                      }

                      const months = buildMonthColumns(
                        getGroupById(openGroupId),
                      );

                      return rowsArr.map((r) => {
                        const totalPaid = Array.from(
                          r.months.values(),
                        ).reduce((s, v) => s + v, 0);
                        return (
                          <tr key={r.memberId} className="border-t">
                            <td className="p-2">
                              {r.name ?? r.memberId}
                            </td>
                            {months.map((m) => (
                              <td key={m.idx} className="p-2 text-sm">
                                {r.months.get(m.idx)
                                  ? `₹${fmt(
                                    Number(r.months.get(m.idx) ?? 0),
                                  )}`
                                  : "-"}
                              </td>
                            ))}
                            <td className="p-2">₹{fmt(totalPaid)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending payment requests */}
            {pendingRequests.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">
                  Pending payment approvals
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-gray-500">
                        <th className="p-2">Member</th>
                        <th className="p-2">Amount</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Reference</th>
                        <th className="p-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">
                            {r.memberName ?? r.memberId ?? "-"}
                          </td>
                          <td className="p-2">₹{fmt(r.amount)}</td>
                          <td className="p-2">{r.type ?? "-"}</td>
                          <td className="p-2 text-xs">
                            {r.reference ?? "-"}
                          </td>
                          <td className="p-2 text-xs">
                            {r.date
                              ? new Date(r.date).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bids & auction */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">
                  Bids for this month
                </div>
                <div className="text-xs text-gray-500">
                  {biddingOpen
                    ? "Bidding is OPEN"
                    : "Bidding is CLOSED (members cannot bid if you block it on member UI)"}
                </div>
              </div>

              {/* NEW: manual bid form for admin */}
              <div className="mb-3 border rounded-md p-2 bg-[var(--bg-main)]/40">
                <div className="text-xs font-semibold mb-1">
                  Place manual bid on behalf of a member
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Member
                    </label>
                    <select
                      value={manualBidMemberId}
                      onChange={(e) =>
                        setManualBidMemberId(e.target.value)
                      }
                      className="w-full border rounded px-2 py-1 text-xs"
                    >
                      <option value="">Select member</option>
                      {(() => {
                        const groupObj = getGroupById(openGroupId);
                        const memberIdsSet = new Set<string>();
                        for (const s of normalizeGroupSlots(groupObj)) {
                          memberIdsSet.add(s.memberId);
                        }

                        return Array.from(memberIdsSet)
                          .map((mid) => ({
                            id: mid,
                            name: memberNamesMap[mid] ?? mid,
                          }))
                          .sort((a, b) =>
                            a.name.toLowerCase().localeCompare(
                              b.name.toLowerCase(),
                            ),
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ));
                      })()}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Total bid amount (pot + admin + discount)
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-2 py-1 text-xs"
                      value={
                        typeof manualBidAmount === "number"
                          ? manualBidAmount
                          : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value.trim();
                        if (!value) {
                          setManualBidAmount("");
                          return;
                        }
                        const n = Number(value);
                        if (Number.isNaN(n)) return;
                        setManualBidAmount(n);
                      }}
                      disabled={!biddingOpen || manualBidSubmitting}
                      placeholder="Enter final bid amount e.g. 110000"
                    />
                    {meta && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Pot: ₹{fmt(meta.expectedMonthlyTotal)} • Admin
                        (≈4%): ₹
                        {fmt(
                          auction?.adminCommissionAmount ??
                          Math.round(
                            meta.expectedMonthlyTotal * 0.04,
                          ),
                        )}
                      </p>
                    )}
                  </div>
                  <div className="md:w-auto">
                    <Button
                      className="mt-1 md:mt-0 h-8 px-3 text-xs"
                      onClick={handleSubmitManualBid}
                      disabled={
                        !biddingOpen || manualBidSubmitting || loading
                      }
                    >
                      {manualBidSubmitting ? "Saving..." : "Place manual bid"}
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  Use this when member is not online and informs you on call
                  what bid to place.
                </p>
              </div>

              {bids.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No bids placed yet.
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-gray-500">
                        <th className="p-2">Member</th>
                        <th className="p-2">Discount offered</th>
                        <th className="p-2">Placed at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((b) => (
                        <tr key={b.id} className="border-t">
                          <td className="p-2">
                            {b.memberName ??
                              memberNamesMap[b.memberId] ??
                              b.memberId}
                          </td>
                          <td className="p-2">
                            ₹{fmt(b.discountOffered)}
                          </td>
                          <td className="p-2">
                            {b.createdAt
                              ? new Date(
                                b.createdAt,
                              ).toLocaleString()
                              : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium mb-2">
                Auction outcome
              </div>
              {!auction ? (
                <div className="text-sm text-gray-500">
                  No auction run yet.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-[var(--bg-main)] rounded flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-gray-500">
                        Winner
                      </div>
                      <div className="font-semibold">
                        {memberDisplay(auction.winningMemberId)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Winning discount (for members)
                      </div>
                      <div className="font-semibold">
                        ₹{fmt(auction.winningDiscount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Winning bid amount
                      </div>
                      <div className="font-semibold">
                        ₹{fmt(
                          (auction?.winningBidAmount ?? 0) +
                          (auction?.adminCommissionAmount ?? 0)
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Payout to winner
                      </div>
                      <div className="font-semibold">
                        ₹{fmt(auction.winningPayout)}
                      </div>
                    </div>
                    {typeof auction.adminCommissionAmount ===
                      "number" && (
                        <div>
                          <div className="text-xs text-gray-500">
                            Admin commission
                          </div>
                          <div className="font-semibold">
                            ₹{fmt(auction.adminCommissionAmount)}
                          </div>
                        </div>
                      )}
                  </div>

                  {/* NEW: breakdown like your 1,00,000 / 1,10,000 example */}
                  <div className="p-3 border rounded-md bg-[var(--bg-main)]/40 text-xs space-y-1.5">
                    <div className="font-semibold">
                      Monthly breakdown
                    </div>
                    <div>
                      Fund pot this month:{" "}
                      <span className="font-semibold">
                        ₹{fmt(
                          auction.totalPot ??
                          meta.expectedMonthlyTotal,
                        )}
                      </span>
                    </div>
                    <div>
                      Total members:{" "}
                      <span className="font-semibold">
                        {meta.totalMembers}
                      </span>
                    </div>
                    <div>
                      Final bid amount:{" "}
                      <span className="font-semibold">
                        ₹{fmt(auction.winningBidAmount ?? 0)}
                      </span>
                    </div>
                    <div>
                      Admin commission (~4% of pot):{" "}
                      <span className="font-semibold">
                        ₹{fmt(
                          auction.adminCommissionAmount ??
                          Math.round(
                            (auction.totalPot ??
                              meta.expectedMonthlyTotal) * 0.04,
                          ),
                        )}
                      </span>
                    </div>
                    <div>
                      Total discount for members:{" "}
                      <span className="font-semibold">
                        ₹{fmt(auction.winningDiscount)}
                      </span>
                    </div>
                    <div>
                      Per-member discount this month:{" "}
                      <span className="font-semibold">
                        ₹{fmt(
                          auction.perMemberDiscount ??
                          (auction.winningDiscount > 0 &&
                            meta.totalMembers > 0
                            ? Math.round(
                              auction.winningDiscount /
                              meta.totalMembers,
                            )
                            : 0),
                        )}
                      </span>
                    </div>
                    <div>
                      Net payout to winner (pot − discount − admin):{" "}
                      <span className="font-semibold">
                        ₹{fmt(auction.winningPayout)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium">
                      Distribution of discount
                    </div>
                    {!auction.distributedToMembers ||
                      !auction.distributedToMembers.length ? (
                      <div className="text-xs text-gray-500">
                        No distribution data.
                      </div>
                    ) : (
                      <div className="overflow-auto mt-1">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="p-2">Member</th>
                              <th className="p-2">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auction.distributedToMembers.map((d) => (
                              <tr key={d.memberId} className="border-t">
                                <td className="p-2">
                                  {memberDisplay(d.memberId)}
                                </td>
                                <td className="p-2">
                                  ₹{fmt(d.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Detailed payment rows list */}
            <div className="mb-2">
              <div className="text-sm font-medium mb-2">
                Detailed payments (including summary rows)
              </div>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="p-2">Member</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Ref / Month</th>
                      <th className="p-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td className="p-2" colSpan={5}>
                          No payment rows.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">
                            {r.memberName ?? r.memberId ?? "-"}
                          </td>
                          <td className="p-2">₹{fmt(r.amount)}</td>
                          <td className="p-2">
                            {r.type ?? r.source ?? "-"}
                          </td>
                          <td className="p-2 text-xs">
                            {r.allocation?.monthIndex
                              ? `Month ${r.allocation.monthIndex}`
                              : r.reference ?? "-"}
                          </td>
                          <td className="p-2 text-xs">
                            {r.date
                              ? new Date(r.date).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {loading && (
              <div className="text-xs text-gray-500 mt-2">
                Refreshing data...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminChitsPage;
