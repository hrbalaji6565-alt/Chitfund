// src/app/admin/chits/page.tsx
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
type AllocationDetail = { monthIndex: number; principalPaid: number; penaltyPaid: number };
type PaymentRow = {
  id: string;
  memberId?: string;
  memberName?: string;
  amount: number;
  date?: string;
  type?: string;
  reference?: string;
  allocation?: { monthIndex?: number } | null;
  allocationDetails?: AllocationDetail[];
  source?: "payment" | "contribution";
};
type BidRow = { id: string; memberId: string; memberName?: string; discountOffered: number; createdAt?: string };
type AuctionDisplay = {
  winningMemberId: string;
  winningDiscount: number;
  winningPayout: number;
  distributedToMembers: Array<{ memberId: string; amount: number }>;
};
type PaymentsMeta = {
  expectedMonthlyTotal: number;
  perMemberInstallment: number;
  currentMonthIndex: number;
  totalMembers: number;
  monthlyCollected: number;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toStr = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const safeNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => n.toLocaleString();

const monthsElapsedSinceStart = (startIso?: string) => {
  if (!startIso) return 1;
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return 1;
  const n = new Date();
  let months = (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months + 1);
};

const extractArray = (
  obj: unknown,
  keys: string[] = ["payments", "payment", "data", "contributions", "contribution"]
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
  if (isRecord(raw)) {
    if (raw._id) return String(raw._id);
    if (raw.id) return String(raw.id);
  }
  return String(raw);
};

const parseAllocationArray = (input: unknown): AllocationDetail[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const out: AllocationDetail[] = [];
  for (const item of input) {
    if (!isRecord(item)) continue;
    const maybeMonth = item.monthIndex ?? item.idx ?? item.month ?? item.mindex;
    let monthIndex = typeof maybeMonth === "number" ? maybeMonth : 1;
    if (monthIndex >= 0 && monthIndex < 1) monthIndex = monthIndex + 1;

    const principalPaid = safeNum(
      item.principalPaid ?? item.principal ?? item.prc ?? item.pr ?? item.amount ?? item.apply ?? 0
    );
    const penaltyPaid = safeNum(
      item.penaltyPaid ?? item.penalty ?? item.pen ?? item.penaltyApplied ?? 0
    );
    out.push({
      monthIndex: Math.max(1, Math.round(monthIndex)),
      principalPaid,
      penaltyPaid,
    });
  }
  return out.length ? out : undefined;
};

const parseAllocations = (raw: UnknownRecord): AllocationDetail[] | undefined => {
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
      rm.appliedAllocation
    );
  }

  for (const c of candidates) {
    if (typeof c === "string") {
      try {
        const parsed = JSON.parse(c) as unknown;
        const arr = parseAllocationArray(parsed);
        if (arr?.length) return arr;
      } catch {
        // ignore
      }
    } else {
      const arr = parseAllocationArray(c);
      if (arr?.length) return arr;
    }
  }

  return undefined;
};

const buildMonthColumns = (group: ChitGroup | undefined): { idx: number; label: string }[] => {
  const totalMonths = Number(group?.totalMonths ?? 12);
  const startDate = group?.startDate ?? "";
  const months: { idx: number; label: string }[] = [];
  const now = new Date();

  if (startDate) {
    const s = new Date(startDate);
    const count = Math.max(1, Math.min(60, totalMonths || 12));
    for (let i = 1; i <= count; i += 1) {
      const d = new Date(s.getFullYear(), s.getMonth() + (i - 1), 1);
      months.push({
        idx: i,
        label: `${d.toLocaleString(undefined, { month: "short" })} ${d.getFullYear()}`,
      });
    }
  } else {
    const count = 12;
    for (let i = 0; i < count; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
      months.push({
        idx: i + 1,
        label: `${d.toLocaleString(undefined, { month: "short" })} ${d.getFullYear()}`,
      });
    }
  }

  return months;
};

export default function ManageFundsPage(): React.ReactElement {
  const dispatch = useDispatch<AppDispatch>();
  const groups = useSelector(
    (s: RootState) => s.chitGroups?.groups
  ) as ChitGroup[] | undefined;
  const fetchStatus = useSelector(
    (s: RootState) => s.chitGroups?.status
  ) as string | undefined;

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
    if (fetchStatus === "idle") dispatch(fetchGroups());
    if (!membersFromStore.length) dispatch(fetchMembers());
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
  const [paymentsMatrix, setPaymentsMatrix] = useState<Map<string, Map<number, number>>>(new Map());
  const [memberNamesMap, setMemberNamesMap] = useState<Record<string, string | undefined>>({});
  const [pendingRequests, setPendingRequests] = useState<PaymentRow[]>([]);

  // build names map snapshot
  const membersSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    const pairs = membersFromStore.map((m: Member) => `${m._id}|${m.name ?? ""}`).sort();
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
          monthsElapsedSinceStart(g.startDate ?? "")
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
          interestRate: safeNum(g.interestRate),
          numberOfInstallments: safeNum(g.totalMonths),
          completedInstallments: monthsPassed,
          rawGroup: g,
        } as const;
      }),
    [groups]
  );

  const filteredFunds = useMemo(
    () =>
      funds.filter((f) => {
        const s = searchTerm.trim().toLowerCase();
        if (!s) return statusFilter === "all" ? true : f.status === statusFilter;
        return (
          (f.fundName + " " + f.groupName).toLowerCase().includes(s) &&
          (statusFilter === "all" || f.status === statusFilter)
        );
      }),
    [funds, searchTerm, statusFilter]
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

    const group = (groups ?? []).find((g) => String(g._id ?? g.id) === groupId);
    const totalMembers = safeNum(
      group?.totalMembers ??
        (Array.isArray(group?.members) ? (group?.members as unknown[]).length : 0)
    );
    const monthlyFromModel = safeNum(group?.monthlyInstallment);
    const chitValue = safeNum(group?.chitValue);
    const totalMonths = safeNum(group?.totalMonths);

    let expectedMonthlyTotal = 0;
    if (monthlyFromModel > 0 && totalMembers > 0) {
      expectedMonthlyTotal = monthlyFromModel * totalMembers;
    } else if (chitValue > 0 && totalMonths > 0) {
      expectedMonthlyTotal = Math.round(chitValue / Math.max(1, totalMonths));
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

    const currentMonthIndex = monthsElapsedSinceStart(group?.startDate);

    try {
      const fetchWithFallback = async (url: string, postBody?: unknown) => {
        const first = await fetch(url, { credentials: "include" });
        if (first.status === 405) {
          return fetch(url, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: postBody !== undefined ? JSON.stringify(postBody) : undefined,
          });
        }
        return first;
      };

      const [pRes, bRes, aRes] = await Promise.all([
        fetchWithFallback(
          `/api/chitgroups/${encodeURIComponent(groupId)}/payments?all=true`,
          { all: true }
        ),
        fetchWithFallback(
          `/api/chitgroups/${encodeURIComponent(groupId)}/bids?all=true`,
          { all: true }
        ),
        fetchWithFallback(
          `/api/chitgroups/${encodeURIComponent(groupId)}/auction?all=true`,
          { all: true }
        ),
      ]);

      if (!pRes.ok) {
        const pj: unknown = await pRes.json().catch(() => ({}));
        setErrorText(
          isRecord(pj)
            ? String(pj.error ?? pj.message ?? pRes.statusText)
            : pRes.statusText
        );
        setLoading(false);
        return;
      }

      const pJson: unknown = await pRes.json().catch(() => ({}));
      const bJson: unknown = await bRes.json().catch(() => []);
      const aJson: unknown = await aRes.json().catch(() => ({}));

      const nameMap: Record<string, string | undefined> = { ...memberNamesMap };
      if (Array.isArray(group?.members)) {
        for (const m of group.members as unknown[]) {
          let id = "UNKNOWN";
          let n: string | undefined;
          if (typeof m === "string") {
            id = m;
          } else if (isRecord(m)) {
            id = String(m._id ?? m.id ?? "UNKNOWN");
            n = typeof m.name === "string" ? m.name : undefined;
          }
          if (!nameMap[id]) nameMap[id] = n ?? id;
        }
      }

      const paymentsArr = extractArray(pJson);

      const byMember = new Map<string, { paid: number; rows: PaymentRow[] }>();
      const matrix = new Map<string, Map<number, number>>();
      const pending: PaymentRow[] = [];

      const addRow = (mid: string, row: PaymentRow) => {
        if (!byMember.has(mid)) byMember.set(mid, { paid: 0, rows: [] });
        const rec = byMember.get(mid)!;
        rec.rows.push(row);
        rec.paid += row.amount;
      };

      for (const p of paymentsArr) {
        if (!isRecord(p)) continue;
        const pr = p as UnknownRecord;
        const id = toStr(pr._id ?? pr.id ?? Math.random().toString(36).slice(2))!;
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

        let memberName: string | undefined = nameMap[memberId];
        if (!memberName && isRecord(pr.member) && typeof pr.member.name === "string") {
          memberName = pr.member.name;
        }
        if (!memberName && typeof pr.memberName === "string") {
          memberName = pr.memberName;
        }
        if (memberName) nameMap[memberId] = memberName;

        const allocationDetails = parseAllocations(pr) ?? undefined;

        const allocMonth = (() => {
          const base =
            pr.monthIndex ??
            (isRecord(pr.allocation) ? pr.allocation.monthIndex : undefined);
          if (typeof base === "number") return base;
          if (date && group?.startDate) {
            const d = new Date(date);
            const gs = new Date(group.startDate);
            return (d.getFullYear() - gs.getFullYear()) * 12 + (d.getMonth() - gs.getMonth()) + 1;
          }
          return undefined;
        })();

        const rawStatus = pr.status ?? pr.state;
        const statusStr = typeof rawStatus === "string" ? rawStatus.toLowerCase() : undefined;
        const verifiedFlag = Boolean(pr.verified ?? pr.isVerified ?? false);
        const approvedAtFlag = Boolean(pr.approvedAt);
        const isApproved = statusStr === "approved" || verifiedFlag || approvedAtFlag;

        const row: PaymentRow = {
          id,
          memberId,
          memberName,
          amount,
          date,
          type: typeof pr.type === "string" ? pr.type : undefined,
          reference:
            typeof pr.reference === "string"
              ? pr.reference
              : typeof pr.txnId === "string"
              ? pr.txnId
              : undefined,
          allocation:
            allocationDetails && allocationDetails.length
              ? { monthIndex: allocationDetails[0].monthIndex }
              : typeof allocMonth === "number"
              ? { monthIndex: allocMonth }
              : null,
          allocationDetails,
          source: Array.isArray(
            (pJson as UnknownRecord | undefined)?.payments as unknown
          )
            ? "payment"
            : "contribution",
        };

        addRow(memberId, row);

        if (isApproved) {
          if (allocationDetails && allocationDetails.length) {
            for (const ad of allocationDetails) {
              const usedMonth = ad.monthIndex > 0 ? ad.monthIndex : 1;
              if (!matrix.has(memberId)) matrix.set(memberId, new Map());
              const mm = matrix.get(memberId)!;
              mm.set(usedMonth, (mm.get(usedMonth) ?? 0) + ad.principalPaid);
            }
          } else {
            const usedMonth =
              typeof allocMonth === "number" && allocMonth > 0
                ? allocMonth
                : currentMonthIndex;
            if (!matrix.has(memberId)) matrix.set(memberId, new Map());
            const mm = matrix.get(memberId)!;
            mm.set(usedMonth, (mm.get(usedMonth) ?? 0) + amount);
          }
        } else {
          pending.push(row);
        }
      }

      // ensure group members exist in matrix
      if (Array.isArray(group?.members)) {
        for (const m of group.members as unknown[]) {
          let mid = "UNKNOWN";
          if (typeof m === "string") mid = m;
          else if (isRecord(m)) {
            mid = String(m._id ?? m.id ?? "UNKNOWN");
            if (!nameMap[mid]) {
              nameMap[mid] = typeof m.name === "string" ? m.name : mid;
            }
          }
          if (!matrix.has(mid)) matrix.set(mid, new Map());
        }
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
          const id = toStr(b._id ?? b.id ?? Math.random().toString(36).slice(2))!;
          const memberId = toStr(
            b.memberId ?? (isRecord(b.member) ? b.member._id : undefined) ?? "UNKNOWN"
          )!;
          const memberNameFromMember =
            isRecord(b.member) && typeof b.member.name === "string"
              ? b.member.name
              : undefined;
          const memberNameField =
            typeof b.memberName === "string" ? b.memberName : undefined;
          const memberName =
            nameMap[memberId] ?? memberNameFromMember ?? memberNameField ?? memberId;
          nameMap[memberId] = memberName;
          const discountOffered = safeNum(b.discountOffered ?? b.amount);
          const createdAt =
            typeof b.createdAt === "string"
              ? b.createdAt
              : typeof b.date === "string"
              ? b.date
              : undefined;
          return { id, memberId, memberName, discountOffered, createdAt };
        })
        .sort((a, b) => b.discountOffered - a.discountOffered);

      let auctionDisplay: AuctionDisplay | null = null;

      let auctionRaw: UnknownRecord | null = null;
      if (isRecord(aJson)) {
        const aRec = aJson as UnknownRecord;
        if (isRecord(aRec.auction)) auctionRaw = aRec.auction as UnknownRecord;
        else if (isRecord(aRec.data)) auctionRaw = aRec.data as UnknownRecord;
      }

      if (auctionRaw) {
        const arc = auctionRaw;
        const winningMemberId = String(
          arc.winningMemberId ?? arc.winningMember ?? arc.winner ?? "NO_WINNER"
        );
        const winningDiscount = safeNum(
          arc.winningBidAmount ?? arc.winningDiscount ?? 0
        );
        const winningPayout = safeNum(
          arc.winningPayout ?? Math.max(0, expectedMonthlyTotal - winningDiscount)
        );
        const distributedToMembers: Array<{ memberId: string; amount: number }> = [];

        if (Array.isArray(arc.distributedToMembers)) {
          for (const d of arc.distributedToMembers) {
            if (isRecord(d)) {
              distributedToMembers.push({
                memberId: String(d.memberId ?? d.id ?? "UNKNOWN"),
                amount: safeNum(d.amount),
              });
            }
          }
        }

        auctionDisplay = {
          winningMemberId,
          winningDiscount,
          winningPayout,
          distributedToMembers,
        };
      } else if (normalizedBids.length > 0) {
        const top = normalizedBids[0];
        const winningDiscount = safeNum(top.discountOffered);
        const winningPayout = Math.max(0, expectedMonthlyTotal - winningDiscount);
        const contributions = Array.from(byMember.entries()).map(([memberId, rec]) => ({
          memberId,
          paid: rec.paid,
        }));
        const totalCollectedSum = contributions.reduce((s, c) => s + c.paid, 0);
        const distributedToMembers: Array<{ memberId: string; amount: number }> = [];
        if (totalCollectedSum > 0 && winningDiscount > 0) {
          for (const c of contributions) {
            const share = Math.round((c.paid / totalCollectedSum) * winningDiscount);
            if (share > 0) distributedToMembers.push({ memberId: c.memberId, amount: share });
          }
          const distributedSum = distributedToMembers.reduce((s, x) => s + x.amount, 0);
          const diff = winningDiscount - distributedSum;
          if (diff !== 0 && distributedToMembers.length) {
            distributedToMembers[0].amount += diff;
          }
        }
        auctionDisplay = {
          winningMemberId: top.memberId,
          winningDiscount,
          winningPayout,
          distributedToMembers,
        };
      } else {
        auctionDisplay = {
          winningMemberId: "NO_BIDS",
          winningDiscount: 0,
          winningPayout: expectedMonthlyTotal,
          distributedToMembers: [],
        };
      }

      setRows(modalRows);
      setMeta({
        expectedMonthlyTotal,
        perMemberInstallment,
        currentMonthIndex,
        totalMembers,
        monthlyCollected,
      });
      setBids(normalizedBids);
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
    (groups ?? []).find((g) => String(g._id ?? g.id) === id) as ChitGroup | undefined;

  const memberDisplay = (id?: string) => (id ? memberNamesMap[id] ?? id : "Unknown");

  const resetModal = () => {
    setOpenGroupId(null);
    setRows([]);
    setMeta(null);
    setErrorText(null);
    setPaymentsMatrix(new Map());
    setPendingRequests([]);
  };

  return (
    <div className="space-y-6" style={{ background: "var(--bg-main)" }}>
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" />
            <Input
              placeholder="Search funds or groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 rounded-xl"
            />
          </div>

          <div className="relative w-full sm:w-[180px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-12 pl-10 pr-3 rounded-xl"
              style={{ appearance: "none" }}
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {filteredFunds.map((fund, idx) => (
            <motion.div
              key={fund.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold">{fund.fundName}</h3>
                          <p className="text-sm mt-1 text-gray-500">{fund.groupName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              fund.status === "Active"
                                ? "status-active"
                                : fund.status === "Completed"
                                ? "status-completed"
                                : "status-pending"
                            }
                          >
                            {fund.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Fund Size (Total)</p>
                          <p className="text-lg font-semibold">₹{fmt(fund.totalAmount)}</p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Per-member / month</p>
                          <p className="text-lg font-semibold">
                            {(() => {
                              const raw = fund.rawGroup as UnknownRecord | undefined;
                              const monthlyFromModel = safeNum(raw?.monthlyInstallment);
                              const totalMembers = Math.max(
                                1,
                                safeNum(
                                  raw?.totalMembers ??
                                    (Array.isArray(raw?.members)
                                      ? (raw?.members as unknown[]).length
                                      : 0)
                                )
                              );
                              const totalMonths = Math.max(
                                1,
                                safeNum(raw?.totalMonths ?? fund.numberOfInstallments)
                              );
                              if (monthlyFromModel > 0) {
                                return `₹${fmt(Math.round(monthlyFromModel))}`;
                              }
                              const perMember = Math.round(
                                (Number(fund.totalAmount ?? 0) / totalMonths) / totalMembers
                              );
                              return `₹${fmt(perMember)}`;
                            })()}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500">Penalty %</p>
                          <p className="text-lg font-semibold">
                            {(() => {
                              const raw = fund.rawGroup as UnknownRecord | undefined;
                              const p =
                                raw?.penaltyPercent ??
                                raw?.penalty ??
                                raw?.penalty_rate ??
                                0;
                              return `${safeNum(p)}%`;
                            })()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Collection Progress</span>
                          <span className="font-semibold">
                            {((fund.collectedAmount / (fund.totalAmount || 1)) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--bg-highlight)] rounded-full h-3 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${
                                (fund.collectedAmount / (fund.totalAmount || 1)) * 100
                              }%`,
                            }}
                            style={{
                              height: "100%",
                              background: "var(--gradient-primary)",
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />{" "}
                          <span>
                            {fund.startDate} to {fund.maturityDate}
                          </span>
                        </div>
                        <div>
                          <span>
                            {fund.completedInstallments}/{fund.numberOfInstallments} Installments
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:flex-col gap-2 justify-end items-start">
                      <Button
                        className="h-10 rounded-xl px-3"
                        onClick={() => fetchPaymentsForGroup(fund.id)}
                      >
                        View Payments
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Payments modal */}
      {openGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={resetModal} />
          <div className="relative max-w-6xl w-full bg-[var(--bg-card)] rounded-xl shadow-lg overflow-auto max-h-[90vh] p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">
                  Group {getGroupById(openGroupId)?.name ?? openGroupId} — Month #
                  {meta?.currentMonthIndex ?? "?"}
                </h3>
                <div className="text-sm text-gray-500">
                  Expected pot & per-member split for this month — admin view
                </div>
              </div>
              <div>
                <Button variant="ghost" onClick={resetModal}>
                  Close
                </Button>
              </div>
            </div>

            {loading && <div className="py-6 text-center">Loading...</div>}
            {errorText && <div className="text-red-500 py-4">{errorText}</div>}

            {!loading && !errorText && meta && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-[var(--bg-main)] rounded">
                    <div className="text-xs text-gray-500">Expected Monthly Pot</div>
                    <div className="text-lg font-semibold">₹{fmt(meta.expectedMonthlyTotal)}</div>
                  </div>
                  <div className="p-3 bg-[var(--bg-main)] rounded">
                    <div className="text-xs text-gray-500">Collected this month</div>
                    <div className="text-lg font-semibold">₹{fmt(meta.monthlyCollected)}</div>
                  </div>
                  <div className="p-3 bg-[var(--bg-main)] rounded">
                    <div className="text-xs text-gray-500">Remaining this month</div>
                    <div className="text-lg font-semibold">
                      ₹{fmt(Math.max(0, meta.expectedMonthlyTotal - meta.monthlyCollected))}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-main)] rounded">
                    <div className="text-xs text-gray-500">Per-member Due</div>
                    <div className="text-lg font-semibold">₹{fmt(meta.perMemberInstallment)}</div>
                  </div>
                </div>

                {/* Pending requests (not counted) */}
                {pendingRequests.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded">
                    <div className="text-sm font-medium mb-2">
                      Pending payment requests (not counted)
                    </div>
                    {pendingRequests.map((pr) => (
                      <div
                        key={pr.id}
                        className="flex justify-between items-center text-sm py-1"
                      >
                        <div>
                          {memberNamesMap[pr.memberId ?? ""] ??
                            pr.memberName ??
                            pr.memberId}{" "}
                          • ₹{pr.amount}{" "}
                          {pr.allocation?.monthIndex
                            ? `• month ${pr.allocation.monthIndex}`
                            : ""}
                        </div>
                        <div className="text-xs text-gray-600">
                          {pr.date ? new Date(pr.date).toLocaleString() : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-member status (this month) */}
                <div className="mb-6">
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
                          const memberIdsSet = new Set<string>();

                          for (const k of paymentsMatrix.keys()) {
                            memberIdsSet.add(k);
                          }

                          if (groupObj && Array.isArray(groupObj.members)) {
                            for (const m of groupObj.members as unknown[]) {
                              if (typeof m === "string") {
                                memberIdsSet.add(m);
                              } else if (isRecord(m)) {
                                memberIdsSet.add(
                                  String(m._id ?? m.id ?? "UNKNOWN")
                                );
                              }
                            }
                          }

                          const membersList = Array.from(memberIdsSet);
                          if (!membersList.length) {
                            return (
                              <tr>
                                <td className="p-2" colSpan={5}>
                                  No members/payments found for this group.
                                </td>
                              </tr>
                            );
                          }

                          return membersList.map((mid) => {
                            const name = memberNamesMap[mid] ?? mid;
                            const mm = paymentsMatrix.get(mid) ?? new Map();
                            const paid = Number(mm.get(meta.currentMonthIndex) ?? 0);
                            const expected = meta.perMemberInstallment;
                            const remaining = Math.max(0, expected - paid);
                            const statusText =
                              paid >= expected
                                ? "Paid in full"
                                : paid === 0
                                ? "Unpaid"
                                : "Partial";
                            return (
                              <tr key={mid} className="border-t">
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

                {/* Bids & auction */}
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Bids for this month</div>
                  {bids.length === 0 ? (
                    <div className="text-sm text-gray-500">No bids placed yet.</div>
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
                                {memberNamesMap[b.memberId] ?? b.memberName ?? b.memberId}
                              </td>
                              <td className="p-2">₹{fmt(b.discountOffered)}</td>
                              <td className="p-2">
                                {b.createdAt ? new Date(b.createdAt).toLocaleString() : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Auction outcome</div>
                  {!auction ? (
                    <div className="text-sm text-gray-500">No auction run yet.</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-[var(--bg-main)] rounded flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-500">Winner</div>
                          <div className="font-semibold">
                            {memberDisplay(auction.winningMemberId)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Winning discount</div>
                          <div className="font-semibold">
                            ₹{fmt(auction.winningDiscount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Payout to winner</div>
                          <div className="font-semibold">
                            ₹{fmt(auction.winningPayout)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Distribution of discount</div>
                        {!auction.distributedToMembers ||
                        !auction.distributedToMembers.length ? (
                          <div className="text-sm text-gray-500">No distribution</div>
                        ) : (
                          <div className="overflow-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-xs text-gray-500">
                                  <th className="p-2">Member</th>
                                  <th className="p-2">Distributed amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {auction.distributedToMembers.map((d) => (
                                  <tr key={d.memberId} className="border-t">
                                    <td className="p-2">
                                      {memberDisplay(d.memberId)}
                                    </td>
                                    <td className="p-2">₹{fmt(d.amount)}</td>
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

                {/* Payments by month & detailed payments */}
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
                            funds.find((f) => f.id === openGroupId)?.rawGroup as
                              | ChitGroup
                              | undefined
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
                              .localeCompare((b.name ?? b.memberId).toLowerCase())
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

                          const g = funds.find((f) => f.id === openGroupId)
                            ?.rawGroup as ChitGroup | undefined;
                          const months = buildMonthColumns(g);

                          return rowsArr.map((r) => {
                            const totalPaid = Array.from(r.months.values()).reduce(
                              (s, v) => s + v,
                              0
                            );
                            return (
                              <tr key={r.memberId} className="border-t">
                                <td className="p-2">{r.name ?? r.memberId}</td>
                                {months.map((m) => (
                                  <td key={m.idx} className="p-2">
                                    ₹{fmt(r.months.get(m.idx) ?? 0)}
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

                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">
                    Detailed payments (all months)
                  </div>
                  {rows.length === 0 && (
                    <div className="text-sm text-gray-500">
                      No payments found for this group.
                    </div>
                  )}
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2 bg-[var(--bg-main)] rounded mb-2"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {r.memberName ?? r.memberId ?? "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {r.type ?? ""} {r.reference ? `• ${r.reference}` : ""}{" "}
                          {r.allocation?.monthIndex
                            ? ` • month ${r.allocation.monthIndex}`
                            : ""}
                          {r.allocationDetails && r.allocationDetails.length ? (
                            <div className="mt-1 text-xs text-gray-600">
                              {r.allocationDetails.map((ad, i) => (
                                <div key={i}>
                                  Month {ad.monthIndex}: principal ₹
                                  {fmt(ad.principalPaid)}
                                  {ad.penaltyPaid
                                    ? ` • penalty ₹${fmt(ad.penaltyPaid)}`
                                    : ""}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{fmt(Number(r.amount))}</div>
                        <div className="text-xs text-gray-500">
                          {r.date ? new Date(r.date).toLocaleString() : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
