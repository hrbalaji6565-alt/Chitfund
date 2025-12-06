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
  winningDiscount: number; // total discount offered by winner (rupees)
  winningPayout: number; // payout amount to winner this month
  distributedToMembers: Array<{ memberId: string; amount: number }>;
  perMemberDiscount?: number; // how much monthly installment reduced per member this month
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

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toStr = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v);

const safeNum = (v: unknown): number => {
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
  const [biddingStatusMsg, setBiddingStatusMsg] = useState<string | null>(null);

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

    const group = (groups ?? []).find(
      (g) => String(g._id ?? g.id) === groupId,
    ) as ChitGroup | undefined;

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

      const byMember = new Map<
        string,
        { paid: number; rows: PaymentRow[] }
      >();
      const matrix = new Map<string, Map<number, number>>();
      const pending: PaymentRow[] = [];

      const addRow = (mid: string, row: PaymentRow) => {
        if (!byMember.has(mid)) {
          byMember.set(mid, { paid: 0, rows: [] });
        }
        const rec = byMember.get(mid)!;
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
        let memberName: string | undefined = nameMap[memberId];

        if (
          !memberName &&
          isRecord(pr.member) &&
          typeof pr.member.name === "string"
        ) {
          memberName = pr.member.name;
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

        const allocation = isRecord(pr.allocation)
          ? { monthIndex: safeNum(pr.allocation.monthIndex) || undefined }
          : undefined;

        const allocationDetails: AllocationDetail[] | undefined = Array.isArray(
          pr.allocationDetails,
        )
          ? (pr.allocationDetails as unknown[])
              .filter(isRecord)
              .map((ad) => ({
                monthIndex: safeNum(ad.monthIndex),
                principalPaid: safeNum(ad.principalPaid),
                penaltyPaid: safeNum(ad.penaltyPaid),
              }))
          : undefined;

        const isApproved =
          pr.status === "approved" ||
          pr.status === "APPROVED" ||
          pr.approved === true;

        const allocMonth =
          typeof allocation?.monthIndex === "number"
            ? allocation.monthIndex
            : undefined;

        const row: PaymentRow = {
          id,
          memberId,
          memberName,
          amount,
          date,
          type,
          reference,
          allocation,
          allocationDetails,
          source: "payment",
        };

        addRow(memberId, row);

        if (isApproved) {
          if (allocationDetails && allocationDetails.length) {
            for (const ad of allocationDetails) {
              const usedMonth = ad.monthIndex > 0 ? ad.monthIndex : 1;
              if (!matrix.has(memberId)) matrix.set(memberId, new Map());
              const mm = matrix.get(memberId)!;
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
            if (!matrix.has(memberId)) matrix.set(memberId, new Map());
            const mm = matrix.get(memberId)!;
            mm.set(usedMonth, (mm.get(usedMonth) ?? 0) + amount);
          }
        } else {
          pending.push(row);
        }
      }

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

      if (auctionRaw) {
        const arc = auctionRaw;

        const winningMemberId = String(
          arc.winningMemberId ??
            arc.winningMember ??
            arc.winner ??
            "NO_WINNER",
        );
 let winningBidAmount = safeNum(
          (arc as { winningBidAmount?: unknown }).winningBidAmount ??
            (arc as { totalBidAmount?: unknown }).totalBidAmount ??
            (arc as { bidAmount?: unknown }).bidAmount ??
            0,
        );
        let winningDiscount = safeNum(
          (arc as { winningDiscount?: unknown }).winningDiscount ??
            (arc as { discountOffered?: unknown }).discountOffered ??
            0,
        );

       let winningPayout = safeNum(
          (arc as { winningPayout?: unknown }).winningPayout,
        );
        if (!winningPayout && baseExpectedMonthlyTotal > 0) {
          winningPayout =
            winningDiscount > 0
              ? Math.max(0, baseExpectedMonthlyTotal - winningDiscount)
              : baseExpectedMonthlyTotal;
        }

        const totalPot = safeNum(
          (arc as { totalPot?: unknown }).totalPot ?? baseExpectedMonthlyTotal,
        );

        let adminCommissionAmount = safeNum(
          (arc as { adminCommissionAmount?: unknown }).adminCommissionAmount,
        );
        if (!adminCommissionAmount && baseExpectedMonthlyTotal > 0) {
          adminCommissionAmount = Math.round(baseExpectedMonthlyTotal * 0.04);
        }
         if (!winningDiscount && winningBidAmount > 0 && baseExpectedMonthlyTotal > 0) {
          const diff =
            winningBidAmount ;
          winningDiscount = diff > 0 ? diff : 0;
        }
        if (!winningBidAmount && baseExpectedMonthlyTotal > 0) {
          winningBidAmount =
            baseExpectedMonthlyTotal + adminCommissionAmount + winningDiscount;
        }
        

        const distributedToMembers: Array<{
          memberId: string;
          amount: number;
        }> = [];

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

        let perMemberDiscount: number | undefined;
        if (distributedToMembers.length > 0) {
          const totalDist = distributedToMembers.reduce(
            (sum, d) => sum + d.amount,
            0,
          );
          const uniqueMembersCount = new Set(
            distributedToMembers.map((d) => d.memberId),
          ).size;
          perMemberDiscount =
            uniqueMembersCount > 0
              ? Math.round(totalDist / uniqueMembersCount)
              : undefined;
        }

        auctionDisplay = {
          winningMemberId,
          winningDiscount,        // e.g. 10,000
          winningPayout,          // e.g. 90,000
          distributedToMembers,
          perMemberDiscount,
          adminCommissionAmount,  // e.g. 4,000
          totalPot,               // base pot (1,00,000)
          winningBidAmount,       // full bid (1,14,000)
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
            baseMeta.perMemberInstallment - auctionDisplay.perMemberDiscount,
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
      // eslint-disable-next-line no-console
      console.log("Auction completed, winner calculated.");
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setAuctionRunning(false);
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
                          width: `${
                            (fund.collectedAmount /
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
                              String(m._id ?? m.id ?? "UNKNOWN"),
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
                <div className="space-y-2">
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
                        Winning discount
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
                        ₹{fmt(auction.winningBidAmount ?? 0)}
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
                    {/* {typeof auction.adminCommissionAmount === "number" && (
                      <div>
                        <div className="text-xs text-gray-500">
                          Admin commission
                        </div>
                        <div className="font-semibold">
                          ₹{fmt(auction.adminCommissionAmount)}
                        </div>
                      </div>
                    )} */}
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
