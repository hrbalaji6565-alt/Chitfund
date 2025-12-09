"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import QRCode from "qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Search as SearchIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { useSelector, useDispatch } from "react-redux";
import Image from "next/image";

import type { RootState, AppDispatch } from "@/store/store";
import type { ChitGroup } from "@/app/lib/types";
import BidPanel from "@/app/components/BidPanel";
import { fetchGroups } from "@/store/chitGroupSlice";

/* ---------- helpers & types ---------- */

type AnyObject = { [key: string]: unknown };

const isRecord = (x: unknown): x is AnyObject =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const toStr = (v: unknown, d = ""): string =>
  typeof v === "string"
    ? v
    : typeof v === "number"
      ? String(v)
      : d;

const toNum = (v: unknown, d = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }
  return d;
};

const idStr = (x: unknown): string =>
  typeof x === "string"
    ? x
    : typeof x === "number"
      ? String(x)
      : isRecord(x)
        ? toStr(x._id ?? x.id ?? "")
        : "";

const monthsElapsedSinceStart = (start?: string): number => {
  if (!start) return 1;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return 1;
  const n = new Date();
  let months =
    (n.getFullYear() - s.getFullYear()) * 12 +
    (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months + 1);
};

type PaymentMeta = {
  id?: string;
  date?: string;
  ref?: string;
};

type PaymentDetail = {
  principal: number;
  penalty: number;
  meta?: PaymentMeta;
};

type MonthType = {
  idx: number;
  label: string;
  paid: number;
  penalty: number;
  details: PaymentDetail[];
  status: string;
  remaining: number;
};

type OverdueDetail = {
  monthIndex: number;
  remaining: number;
  monthsOver: number;
  penalty: number;
  totalIfCleared: number;
};

type OverdueInfo = {
  totalRem: number;
  penaltyIfNow: number;
  details: OverdueDetail[];
  maxPayableIfClearNow: number;
  currentMonthPenalty: number;
};

type AllocationItem = {
  monthIndex: number;
  due: number;
  penalty: number;
  apply: number;
};

type FundView = {
  id: string;
  fundName: string;
  groupName: string;
  totalAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  penaltyPercent: number;
  startDate: string;
  maturityDate: string;
  status: string;
  interestRate: number;
  numberOfInstallments: number;
  completedInstallments: number;
  installmentProgress: number;
  raw: unknown;
};

type MemberFundSummary = {
  groupId: string;
  totalFunds: number;
  collected: number;
  pending: number;
};

/* ---------- Payment panel (per member × group) ---------- */

function PaymentPanel({
  groupObj,
  memberId,
  onSummaryChange,
}: {
  groupObj: unknown;
  memberId: string;
  onSummaryChange?: (summary: MemberFundSummary) => void;
})  {
  const [payments, setPayments] = useState<AnyObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const [auctionDiscountShare, setAuctionDiscountShare] = useState(0);
  const [canPayThisMonth, setCanPayThisMonth] = useState(false);
  const [auctionDate, setAuctionDate] = useState<string | null>(null);
  const [auctionMonthIndex, setAuctionMonthIndex] = useState<number | null>(null);
  const [myWinningPayout, setMyWinningPayout] = useState(0);

  const startDate = isRecord(groupObj) ? toStr(groupObj.startDate ?? "") : "";

  const totalMonthsFromModel = isRecord(groupObj)
    ? Math.max(
        1,
        toNum(
          groupObj.totalMonths ??
            groupObj.numberOfInstallments ??
            12,
        ),
      )
    : 12;

  const penaltyPercent = isRecord(groupObj)
    ? toNum(
        groupObj.penaltyPercent ??
          groupObj.penalty ??
          groupObj.penalty_rate ??
          0,
      )
    : 0;

  const curMonth = monthsElapsedSinceStart(startDate);

  const perMember = useMemo(() => {
    if (!isRecord(groupObj)) return 0;
    const monthly = toNum(
      groupObj.monthlyInstallment ?? groupObj.monthly ?? 0,
    );
    const members = Math.max(
      1,
      toNum(
        groupObj.totalMembers ??
          (Array.isArray(groupObj.members)
            ? groupObj.members.length
            : 0),
      ),
    );
    const chit = toNum(
      groupObj.chitValue ?? groupObj.totalAmount ?? 0,
    );
    const months = Math.max(
      1,
      toNum(
        groupObj.totalMonths ??
          groupObj.numberOfInstallments ??
          1,
      ),
    );
    if (monthly > 0) return Math.round(monthly);
    if (chit > 0 && months > 0) {
      const perInstallment = chit / months;
      const perMemberShare =
        members > 0 ? perInstallment / members : perInstallment;
      return Math.round(perMemberShare);
    }
    return 0;
  }, [groupObj]);

  const extractPaymentMemberId = (p: AnyObject): string | undefined => {
    const memberIdField = p.memberId;
    if (typeof memberIdField === "string" && memberIdField) return memberIdField;
    const memberField = p.member;
    if (typeof memberField === "string" && memberField) return memberField;
    if (isRecord(memberField)) {
      return toStr(
        memberField._id ??
          memberField.id ??
          memberField.memberId ??
          "",
      );
    }
    if (typeof memberIdField === "number") return String(memberIdField);
    return undefined;
  };

  const normalizeAndFilterPayments = useCallback(
    (arr: unknown[]): AnyObject[] => {
      const map = new Map<string, AnyObject>();

      for (const p of arr) {
        if (!isRecord(p)) continue;
        const idSource = p._id ?? p.id ?? Math.random().toString(36).slice(2);
        const pid = toStr(idSource);
        if (!pid) continue;

        const existing = map.get(pid);
        if (existing) {
          const existingGood = Boolean(
            existing.verified ?? existing.isVerified ?? existing.approvedAt,
          );
          const curGood = Boolean(
            p.verified ?? p.isVerified ?? p.approvedAt,
          );
          if (curGood && !existingGood) map.set(pid, p);
        } else {
          map.set(pid, p);
        }
      }

      const unique = Array.from(map.values());
      if (!memberId) return unique;

      return unique.filter((p) => {
        const mid = extractPaymentMemberId(p);
        return Boolean(mid && mid === memberId);
      });
    },
    [memberId],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        if (!isRecord(groupObj) || !memberId) {
          if (alive) setPayments([]);
          return;
        }

        const gid = toStr(groupObj._id ?? groupObj.id ?? "");
        if (!gid) {
          if (alive) setPayments([]);
          return;
        }

        const url = `/api/chitgroups/${encodeURIComponent(
          gid,
        )}/payments?memberId=${encodeURIComponent(
          memberId,
        )}&all=true`;

        const res = await fetch(url, { credentials: "include" });
        const j: unknown = await res.json().catch(() => []);

        if (!alive) return;

        let arr: unknown[] = [];
        if (Array.isArray(j)) arr = j;
        else if (isRecord(j) && Array.isArray(j.payments)) arr = j.payments;
        else if (isRecord(j) && Array.isArray(j.data)) arr = j.data;
        else if (isRecord(j) && Array.isArray(j.items)) arr = j.items;

        const filtered = normalizeAndFilterPayments(arr);
        if (alive) setPayments(filtered);
      } catch (e) {
        if (alive) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupObj, memberId, normalizeAndFilterPayments]);

  const parseAllocations = (
    raw: AnyObject,
  ):
    | {
        monthIndex: number;
        principal: number;
        penalty: number;
      }[]
    | undefined => {
    const tryParse = (
      cand: unknown,
    ):
      | {
          monthIndex?: number;
          principal?: unknown;
          penalty?: unknown;
        }[]
      | undefined => {
      if (!cand) return undefined;
      if (Array.isArray(cand) && cand.length) {
        return cand as {
          monthIndex?: number;
          principal?: unknown;
          penalty?: unknown;
        }[];
      }
      if (isRecord(cand)) {
        if (Array.isArray(cand.allocation)) return cand.allocation as {
          monthIndex?: number;
          principal?: unknown;
          penalty?: unknown;
        }[];
        if (Array.isArray(cand.allocated)) return cand.allocated as {
          monthIndex?: number;
          principal?: unknown;
          penalty?: unknown;
        }[];
        if (Array.isArray(cand.allocationSummary)) return cand.allocationSummary as {
          monthIndex?: number;
          principal?: unknown;
          penalty?: unknown;
        }[];
      }
      if (typeof cand === "string") {
        try {
          const parsed = JSON.parse(cand);
          return tryParse(parsed);
        } catch {
          return undefined;
        }
      }
      return undefined;
    };

    const rawMeta = isRecord(raw.rawMeta) ? raw.rawMeta : undefined;
    const candidates: unknown[] = [
      raw.allocation,
      raw.allocated,
      raw.allocationSummary,
      rawMeta?.allocation,
      rawMeta?.allocationSummary,
      raw.allocationDetails,
      rawMeta?.allocationDetails,
    ];

    for (const c of candidates) {
      const arr = tryParse(c);
      if (arr && arr.length) {
        const norm: {
          monthIndex: number;
          principal: number;
          penalty: number;
        }[] = [];
        for (const item of arr) {
          const obj: AnyObject = isRecord(item) ? item : {};
          let m = obj.monthIndex;

          if (typeof m === "number" && m >= 0 && m < 1) m += 1;

          if (m === undefined && typeof raw.monthIndex === "number") {
            m = raw.monthIndex;
          }

          const monthIndex =
            typeof m === "number" && Number.isFinite(m)
              ? Math.round(m)
              : 1;

          const principal = toNum(
            obj.principalPaid ??
              obj.principal ??
              obj.amount ??
              0,
          );
          const penalty = toNum(
            obj.penaltyPaid ?? obj.penalty ?? 0,
          );

          norm.push({
            monthIndex: Math.max(1, monthIndex),
            principal,
            penalty,
          });
        }
        return norm;
      }
    }
    return undefined;
  };

  const monthsSummary: MonthType[] = useMemo(() => {
    const monthsCount = Math.max(
      totalMonthsFromModel || 12,
      curMonth,
    );

    const months: MonthType[] = Array.from(
      { length: monthsCount },
      (_, i) => {
        const label = (() => {
          if (!startDate) {
            const d = new Date();
            d.setMonth(d.getMonth() - (monthsCount - 1 - i));
            return `${d.toLocaleString(undefined, {
              month: "short",
            })} ${d.getFullYear()}`;
          }
          const s = new Date(startDate);
          const d = new Date(s.getFullYear(), s.getMonth() + i, 1);
          return `${d.toLocaleString(undefined, {
            month: "short",
          })} ${d.getFullYear()}`;
        })();

        return {
          idx: i + 1,
          label,
          paid: 0,
          penalty: 0,
          details: [],
          status: "Unpaid",
          remaining: perMember,
        };
      },
    );

    const addToMonth = (
      mIdx: number,
      principal: number,
      penalty: number,
      meta: PaymentMeta,
    ) => {
      if (mIdx < 1) mIdx = 1;
      if (mIdx > months.length) mIdx = months.length;
      const bucket = months[mIdx - 1];
      bucket.paid += principal;
      bucket.penalty += penalty;
      bucket.details.push({ principal, penalty, meta });
    };

    for (const p of payments) {
      if (!isRecord(p)) continue;

      const rawStatus = p.status ?? p.state;
      const statusStr =
        typeof rawStatus === "string"
          ? rawStatus.toLowerCase()
          : undefined;

      const verifiedFlag = Boolean(
        p.verified ?? p.isVerified ?? false,
      );
      const approvedAtFlag = Boolean(p.approvedAt);

      const isApproved =
        statusStr === "approved" || verifiedFlag || approvedAtFlag;

      if (!isApproved) continue;

      const allocs = parseAllocations(p);

      if (allocs && allocs.length) {
        for (const a of allocs) {
          addToMonth(a.monthIndex, a.principal, a.penalty, {
            id: toStr(p._id ?? p.id),
            date: toStr(p.date ?? p.createdAt),
            ref: toStr(
              p.reference ?? p.txnId ?? p.utr ?? "",
            ),
          });
        }
      } else {
        let monthIndex: number | undefined;

        if (typeof p.monthIndex === "number") {
          monthIndex = p.monthIndex;
        } else if (
          isRecord(p.allocation) &&
          typeof p.allocation.monthIndex === "number"
        ) {
          monthIndex = p.allocation.monthIndex;
        } else if (
          typeof p.date === "string" ||
          typeof p.createdAt === "string"
        ) {
          const d = new Date((p.date ?? p.createdAt) as string);
          if (startDate) {
            const sdate = new Date(startDate);
            monthIndex =
              (d.getFullYear() - sdate.getFullYear()) * 12 +
              (d.getMonth() - sdate.getMonth()) +
              1;
          } else {
            monthIndex = curMonth;
          }
        } else {
          monthIndex = curMonth;
        }

        const principal = toNum(p.amount ?? p.amt ?? 0);
        addToMonth(
          typeof monthIndex === "number" ? monthIndex : curMonth,
          principal,
          0,
          {
            id: toStr(p._id ?? p.id),
            date: toStr(p.date ?? p.createdAt),
            ref: toStr(
              p.reference ?? p.txnId ?? p.utr ?? "",
            ),
          },
        );
      }
    }

    for (const m of months) {
      const expectedForMonth =
        m.idx === curMonth
          ? Math.max(
              0,
              perMember -
                Math.round(auctionDiscountShare),
            )
          : perMember;

      m.status =
        m.paid >= expectedForMonth
          ? "Paid in full"
          : m.paid === 0
            ? "Unpaid"
            : "Partial";

      m.remaining = Math.max(
        0,
        expectedForMonth - m.paid,
      );
    }

    return months;
  }, [
    payments,
    startDate,
    totalMonthsFromModel,
    perMember,
    curMonth,
    parseAllocations,
    auctionDiscountShare,
  ]);

  const paidThisMonth = useMemo(() => {
    const bucket = monthsSummary[curMonth - 1];
    return bucket ? Math.round(bucket.paid) : 0;
  }, [monthsSummary, curMonth]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setAuctionDiscountShare(0);
      setCanPayThisMonth(false);
      setAuctionDate(null);
      setAuctionMonthIndex(null);
      setMyWinningPayout(0);

      if (!isRecord(groupObj) || !memberId) return;

      const gid = toStr(groupObj._id ?? groupObj.id ?? "");
      if (!gid) return;

      try {
        const url = `/api/chitgroups/${encodeURIComponent(
          gid,
        )}/auction?monthIndex=${curMonth}`;
        const res = await fetch(url, { credentials: "include" });
        const json: unknown = await res.json().catch(() => ({}));

        if (!alive) return;
        if (!isRecord(json)) return;

        let auctionRaw: AnyObject | null = null;

        if (isRecord(json.auction)) {
          auctionRaw = json.auction;
        } else if (isRecord(json.data)) {
          auctionRaw = json.data;
        } else if (Array.isArray(json.auctions)) {
          const arr = json.auctions;
          const withMonth = arr.filter(
            (a) =>
              isRecord(a) &&
              typeof a.monthIndex === "number" &&
              a.monthIndex === curMonth,
          );
          const pick =
            (withMonth[0] as AnyObject | undefined) ??
            (arr[arr.length - 1] as AnyObject | undefined);
          if (pick && isRecord(pick)) auctionRaw = pick;
        }

        if (!auctionRaw) {
          if (alive) {
            setAuctionDiscountShare(0);
            setCanPayThisMonth(false);
            setMyWinningPayout(0);
          }
          return;
        }

        const winningMemberId = toStr(
          auctionRaw.winningMemberId ??
            (auctionRaw as { winner?: unknown }).winner ??
            "",
        );
        const winningPayout = toNum(
          auctionRaw.winningPayout ??
            (auctionRaw as { payoutToWinner?: unknown })
              .payoutToWinner ??
            0,
        );

        if (winningMemberId && winningMemberId === memberId) {
          setMyWinningPayout(winningPayout);
        } else {
          setMyWinningPayout(0);
        }

        const distRaw = auctionRaw.distributedToMembers;

        if (Array.isArray(distRaw)) {
          let myShare = 0;
          for (const d of distRaw) {
            if (!isRecord(d)) continue;
            const mid = idStr(d.memberId ?? d.id ?? "");
            if (!mid) continue;
            if (mid === memberId) {
              myShare = toNum(d.amount, 0);
              break;
            }
          }
          if (alive) setAuctionDiscountShare(myShare);
        } else if (alive) {
          setAuctionDiscountShare(0);
        }

        const mIdx = toNum(
          auctionRaw.monthIndex ??
            (auctionRaw as {
              biddingMonthIndex?: unknown;
            }).biddingMonthIndex ??
            curMonth,
          curMonth,
        );
        const normalizedMonth =
          Number.isFinite(mIdx) && mIdx > 0
            ? Math.round(mIdx)
            : curMonth;

        if (alive) {
          setAuctionMonthIndex(normalizedMonth);
          setCanPayThisMonth(normalizedMonth === curMonth);
        }

        const createdAt =
          typeof auctionRaw.createdAt === "string"
            ? auctionRaw.createdAt
            : typeof auctionRaw.date === "string"
              ? auctionRaw.date
              : null;

        if (alive) setAuctionDate(createdAt);
      } catch {
        if (alive) {
          setAuctionDiscountShare(0);
          setCanPayThisMonth(false);
          setMyWinningPayout(0);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [groupObj, memberId, curMonth]);

  const expectedThisMonth = Math.max(
    0,
    perMember - Math.round(auctionDiscountShare),
  );
  const monthlyRemaining = Math.max(
    0,
    expectedThisMonth - paidThisMonth,
  );

  const overdue = useMemo<OverdueInfo>(() => {
    const info: OverdueInfo = {
      totalRem: 0,
      penaltyIfNow: 0,
      details: [],
      maxPayableIfClearNow: 0,
      currentMonthPenalty: 0,
    };

    for (let mi = 1; mi < curMonth; mi += 1) {
      const b = monthsSummary[mi - 1];
      const paid = b ? b.paid : 0;
      const rem = Math.max(0, perMember - paid);
      if (rem > 0) {
        const monthsOver = curMonth - mi;
        let remWithPenalty = rem;
        for (let k = 0; k < monthsOver; k += 1) {
          remWithPenalty *= 1 + penaltyPercent / 100;
        }
        const pen = remWithPenalty - rem;
        const penRounded = Math.round(pen);

        info.totalRem += rem;
        info.penaltyIfNow += penRounded;
        info.details.push({
          monthIndex: mi,
          remaining: rem,
          monthsOver,
          penalty: penRounded,
          totalIfCleared: Math.round(rem + penRounded),
        });
      }
    }

    if (
      auctionMonthIndex === curMonth &&
      auctionDate &&
      monthlyRemaining > 0 &&
      penaltyPercent > 0
    ) {
      const aDate = new Date(auctionDate);
      if (!Number.isNaN(aDate.getTime())) {
        const now = new Date();
        const diffMs = now.getTime() - aDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 4) {
          const pen = Math.round(
            monthlyRemaining * (penaltyPercent / 100),
          );
          info.currentMonthPenalty = pen;
          info.penaltyIfNow += pen;
        }
      }
    }

    info.maxPayableIfClearNow = Math.round(
      info.totalRem +
        info.penaltyIfNow +
        monthlyRemaining,
    );
    return info;
  }, [
    monthsSummary,
    perMember,
    curMonth,
    penaltyPercent,
    monthlyRemaining,
    auctionMonthIndex,
    auctionDate,
  ]);

  const memberAggregate = useMemo<MemberFundSummary | null>(() => {
    if (!isRecord(groupObj)) return null;

    const gid = toStr(groupObj._id ?? groupObj.id ?? "");
    if (!gid) return null;

    const chitValue = toNum(
      (groupObj as { chitValue?: unknown }).chitValue ??
        (groupObj as { totalAmount?: unknown }).totalAmount ??
        perMember * totalMonthsFromModel,
    );
    const totalFundsForMember =
      chitValue > 0 ? chitValue : perMember * totalMonthsFromModel;

    const totalPaidPrincipal = monthsSummary.reduce(
      (sum, m) => sum + m.paid,
      0,
    );

    const discountCurrentMonth = Math.max(
      0,
      perMember - expectedThisMonth,
    );

    const effectiveTotalPayable =
      totalFundsForMember - discountCurrentMonth;

    const pendingForMember = Math.max(
      0,
      effectiveTotalPayable - totalPaidPrincipal,
    );

    return {
      groupId: gid,
      totalFunds: totalFundsForMember,
      collected: Math.round(totalPaidPrincipal),
      pending: Math.round(pendingForMember),
    };
  }, [
    groupObj,
    perMember,
    totalMonthsFromModel,
    monthsSummary,
    expectedThisMonth,
  ]);

  useEffect(() => {
    if (!memberAggregate || !onSummaryChange) return;
    onSummaryChange(memberAggregate);
  }, [memberAggregate, onSummaryChange]);

  const upiId = isRecord(groupObj)
    ? toStr(
        groupObj.upiId ??
          groupObj.merchantUpi ??
          groupObj.upi ??
          "7489988065@ibl",
      )
    : "7489988065@ibl";

  const payee = isRecord(groupObj)
    ? toStr(
        groupObj.name ??
          groupObj.groupName ??
          "ChitFund",
      )
    : "ChitFund";

  const upiPayload = useMemo(() => {
    if (!upiId) return "";
    const amt =
      typeof amount === "number" && amount > 0
        ? String(amount)
        : "";
    const noteStr = note ? `&tn=${encodeURIComponent(note)}` : "";
    return `upi://pay?pa=${encodeURIComponent(
      upiId,
    )}&pn=${encodeURIComponent(payee)}${
      amt ? `&am=${encodeURIComponent(amt)}` : ""
    }&cu=INR${noteStr}`;
  }, [upiId, payee, amount, note]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!showQr || !upiPayload) {
        setQrDataUrl(null);
        return;
      }
      try {
        const dataUrl = await QRCode.toDataURL(upiPayload, {
          margin: 1,
          width: 300,
        });
        if (!alive) return;
        setQrDataUrl(dataUrl);
      } catch {
        setErr("Failed to generate QR.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [showQr, upiPayload]);

  const onFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const f = e.target.files && e.target.files[0];
    setFile(f ?? null);
  };

  const submitRequest = async () => {
    setErr(null);
    if (!isRecord(groupObj)) {
      setErr("Group missing");
      return;
    }
    if (!memberId) {
      setErr("Member missing");
      return;
    }
    if (!canPayThisMonth) {
      setErr(
        "Auction for this month is not completed yet. You can pay after winner is decided.",
      );
      return;
    }
    if (typeof amount !== "number" || amount <= 0) {
      setErr("Enter amount");
      return;
    }

    const maxPayNow = overdue.maxPayableIfClearNow;
    if (amount > maxPayNow) {
      setErr(
        `Max payable now (incl. overdue, current penalty & this month): ₹${maxPayNow}`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const gid = toStr(
        (groupObj as { _id?: unknown; id?: unknown })._id ??
          (groupObj as { _id?: unknown; id?: unknown }).id ??
          "",
      );
      const url = `/api/chitgroups/${encodeURIComponent(
        gid,
      )}/payments/request`;

      const fd = new FormData();
      fd.append("memberId", memberId);
      fd.append("amount", String(amount));
      fd.append("monthIndex", String(curMonth));
      if (note) fd.append("note", note);
      if (utr) fd.append("utr", utr);

      const allocationSummary: AllocationItem[] = [];
      let remainingToAllocate = amount;

      for (const d of overdue.details) {
        if (remainingToAllocate <= 0) break;
        const totalForMonth = Math.round(
          d.remaining + d.penalty,
        );
        const apply = Math.min(
          remainingToAllocate,
          totalForMonth,
        );
        allocationSummary.push({
          monthIndex: d.monthIndex,
          due: d.remaining,
          penalty: d.penalty,
          apply,
        });
        remainingToAllocate -= apply;
      }

      if (
        remainingToAllocate > 0 &&
        (monthlyRemaining > 0 ||
          overdue.currentMonthPenalty > 0)
      ) {
        const totalForMonth = Math.round(
          monthlyRemaining + overdue.currentMonthPenalty,
        );
        const apply = Math.min(
          remainingToAllocate,
          totalForMonth,
        );
        allocationSummary.push({
          monthIndex: curMonth,
          due: monthlyRemaining,
          penalty: overdue.currentMonthPenalty,
          apply,
        });
        remainingToAllocate -= apply;
      }

      fd.append(
        "allocationSummary",
        JSON.stringify(allocationSummary),
      );
      fd.append(
        "allocationPlannedTotal",
        String(amount),
      );
      fd.append(
        "allocationUnallocated",
        String(Math.max(0, remainingToAllocate)),
      );
      if (file) fd.append("file", file);

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const text = await res.text();
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }

      if (!res.ok) {
        if (isRecord(parsed)) {
          const msg =
            toStr(parsed.error) ||
            toStr(parsed.message) ||
            res.statusText;
          throw new Error(msg);
        }
        throw new Error(res.statusText);
      }

      const pUrl = `/api/chitgroups/${encodeURIComponent(
        gid,
      )}/payments?memberId=${encodeURIComponent(
        memberId,
      )}&all=true`;
      const pr = await fetch(pUrl, {
        credentials: "include",
      });
      const pj: unknown = await pr.json().catch(() => []);
      const arr: unknown[] = Array.isArray(pj)
        ? pj
        : isRecord(pj) && Array.isArray(pj.payments)
          ? pj.payments
          : [];
      setPayments(normalizeAndFilterPayments(arr));

      setAmount("");
      setNote("");
      setUtr("");
      setFile(null);
      setShowQr(false);
      setQrDataUrl(null);
      // eslint-disable-next-line no-alert
      alert("Submitted as pending — admin approval required.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const fillFull = () => {
    setAmount(overdue.maxPayableIfClearNow);
    setShowQr(true);
  };

  const inputsDisabled =
    !canPayThisMonth || submitting || loading;

  return (
    <div className="bg-[var(--bg-main)] p-2 sm:p-4 rounded-xl border space-y-3 w-full">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">
          Your due this month
        </div>
        {!canPayThisMonth && (
          <div className="text-[11px] text-amber-600 text-right">
            Auction winner not finalised for this month yet. Payments will open after admin runs the auction.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-4">
        <div>
          <div className="text-xs text-gray-500">
            Installment
            {auctionDiscountShare > 0
              ? " (after auction)"
              : ""}
          </div>
          <div className="text-lg font-semibold">
            ₹{expectedThisMonth.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">
            Already paid
          </div>
          <div className="text-lg">
            ₹{paidThisMonth.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">
            Remaining
          </div>
          <div className="text-lg font-semibold">
            ₹{monthlyRemaining.toLocaleString()}
          </div>
        </div>
        {myWinningPayout > 0 && (
          <div>
            <div className="text-xs text-gray-500">
              This month payout (winner)
            </div>
            <div className="text-lg font-semibold text-emerald-600">
              ₹{myWinningPayout.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {(overdue.totalRem > 0 ||
        overdue.currentMonthPenalty > 0) && (
        <div className="mt-1 p-2 rounded-lg bg-yellow-50 border text-xs space-y-1">
          {overdue.totalRem > 0 && (
            <div>
              <span className="font-medium">
                Overdue principal:
              </span>{" "}
              ₹{overdue.totalRem.toLocaleString()}
            </div>
          )}
          {overdue.currentMonthPenalty > 0 && (
            <div>
              <span className="font-medium">
                Current month penalty (till today):
              </span>{" "}
              ₹
              {overdue.currentMonthPenalty.toLocaleString()}
            </div>
          )}
          <div>
            <span className="font-medium">
              Total penalty:
            </span>{" "}
            ₹{Math.round(
              overdue.penaltyIfNow,
            ).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">
              Max payable now (overdue + penalty + this month):
            </span>{" "}
            ₹{overdue.maxPayableIfClearNow.toLocaleString()}
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        <div>
          <label className="text-xs text-gray-500">
            Amount to pay
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (!v) {
                setAmount("");
                setShowQr(false);
                return;
              }
              const n = Number(v);
              if (Number.isNaN(n)) return;
              setAmount(n);
            }}
            placeholder={`Max ₹${overdue.maxPayableIfClearNow}`}
            disabled={inputsDisabled}
            className="w-full p-2 rounded border bg-white"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">
            UTR / Ref (optional)
          </label>
          <input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            disabled={inputsDisabled}
            className="w-full p-2 rounded border bg-white"
            placeholder="UTR or txn ref"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">
            Note (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={inputsDisabled}
            className="w-full p-2 rounded border bg-white"
            placeholder="Payment note"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">
            Upload screenshot (optional)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={onFileChange}
            disabled={inputsDisabled}
            className="w-full p-1"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-2 text-sm">
        <button
          type="button"
          onClick={fillFull}
          disabled={
            inputsDisabled ||
            (monthlyRemaining <= 0 &&
              overdue.totalRem <= 0 &&
              overdue.currentMonthPenalty <= 0)
          }
          className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          Pay full month
        </button>

        <button
          type="button"
          onClick={() => {
            if (!canPayThisMonth) {
              setErr(
                "You can generate QR after auction is completed.",
              );
              return;
            }
            if (
              typeof amount !== "number" ||
              amount <= 0
            ) {
              setErr(
                "Enter valid amount to generate QR.",
              );
              return;
            }
            if (!upiId) {
              setErr("Group UPI not configured.");
              return;
            }
            setErr(null);
            setShowQr((s) => !s);
          }}
          disabled={inputsDisabled}
          className="px-3 py-2 rounded-lg bg-gray-200 disabled:opacity-50"
        >
          {showQr ? "Hide QR" : "Generate QR"}
        </button>

        <button
          type="button"
          onClick={submitRequest}
          disabled={
            inputsDisabled ||
            typeof amount !== "number" ||
            amount <= 0
          }
          className="px-3 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit (pending)"}
        </button>
      </div>

      {showQr &&
        amount &&
        typeof amount === "number" && (
          <div className="mt-3 border rounded-xl p-3 flex flex-col sm:flex-row gap-4 items-start bg-white">
            <div className="flex-shrink-0">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="UPI QR"
                  width={160}
                  height={160}
                />
              ) : (
                <div className="w-[160px] h-[160px] grid place-items-center text-xs">
                  Generating QR…
                </div>
              )}
            </div>
            <div className="text-xs break-words">
              <div className="font-medium">UPI ID</div>
              <div className="mb-2">
                {upiId || "Not configured"}
              </div>
              <div>{upiPayload}</div>
              <div className="mt-2 text-gray-500">
                After paying, paste UTR or upload screenshot and press Submit (admin approval required).
              </div>
            </div>
          </div>
        )}

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">
            Payment history (month-wise)
          </div>
        </div>
        <div className="overflow-auto bg-white rounded-xl border max-h-64">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-gray-500">
                <th className="p-2">Month</th>
                <th className="p-2">Principal</th>
                <th className="p-2">Penalty</th>
                <th className="p-2">Total</th>
                <th className="p-2">Remaining</th>
                <th className="p-2">Status</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {monthsSummary.map((m) => (
                <tr key={m.idx} className="border-t">
                  <td className="p-2">
                    {m.label}{" "}
                    {m.idx === curMonth && (
                      <span className="text-[11px] text-gray-400">
                        (current)
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    ₹{Math.round(m.paid).toLocaleString()}
                  </td>
                  <td className="p-2">
                    ₹{Math.round(m.penalty).toLocaleString()}
                  </td>
                  <td className="p-2">
                    ₹
                    {Math.round(
                      m.paid + m.penalty,
                    ).toLocaleString()}
                  </td>
                  <td className="p-2">
                    ₹{Math.round(m.remaining).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <span
                      className={
                        m.status === "Paid in full"
                          ? "font-semibold text-green-600"
                          : m.status === "Partial"
                            ? "font-semibold text-yellow-600"
                            : "font-semibold text-red-600"
                      }
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="p-2 text-[11px] text-gray-600">
                    {m.details.length ? (
                      m.details.map((d, i) => (
                        <div key={`${m.idx}-${i}`}>
                          ₹
                          {Math.round(
                            d.principal,
                          ).toLocaleString()}
                          {d.penalty
                            ? ` • penalty ₹${Math.round(
                                d.penalty,
                              ).toLocaleString()}`
                            : ""}
                          {d.meta?.ref
                            ? ` • ${d.meta.ref}`
                            : ""}
                          {d.meta?.date
                            ? ` • ${new Date(
                                d.meta.date,
                              ).toLocaleString()}`
                            : ""}
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400">
                        —
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {err && (
        <div className="mt-1 text-xs text-red-600">
          {err}
        </div>
      )}
      {loading && (
        <div className="mt-1 text-xs text-gray-600">
          Loading payments…
        </div>
      )}
    </div>
  );
}

/* ---------- main: UserActiveFunds ---------- */

export default function UserActiveFunds() {
  const dispatch = useDispatch<AppDispatch>();

  const [q, setQ] = useState("");
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const chitGroupsState = useSelector(
    (s: RootState) => s.chitGroups,
  );
  const joined = useSelector(
    (s: RootState) => s.userChit?.joinedIds,
  ) as unknown[] | undefined;
  const auth = useSelector(
    (s: RootState) => s.auth?.member,
  ) as unknown | undefined;

  const { groupsRaw, groupsStatus } = useMemo(() => {
    if (!chitGroupsState || !isRecord(chitGroupsState)) {
      return {
        groupsRaw: [] as unknown[],
        groupsStatus: "idle",
      };
    }
    const rawGroups = Array.isArray(chitGroupsState.groups)
      ? chitGroupsState.groups
      : [];
    const status =
      typeof chitGroupsState.status === "string"
        ? chitGroupsState.status
        : "idle";
    return {
      groupsRaw: rawGroups as unknown[],
      groupsStatus: status,
    };
  }, [chitGroupsState]);

  const safeGroups = useMemo<unknown[]>(
    () => (Array.isArray(groupsRaw) ? groupsRaw : []),
    [groupsRaw],
  );

  const isLoadingFunds =
    groupsStatus === "idle" || groupsStatus === "loading";

  useEffect(() => {
    if (groupsStatus === "idle") {
      dispatch(fetchGroups());
    }
  }, [dispatch, groupsStatus]);

  const authId =
    isRecord(auth) && (auth._id || auth.id || auth.memberId)
      ? idStr(auth._id ?? auth.id ?? auth.memberId)
      : "";

  const [memberFundSummaries, setMemberFundSummaries] = useState<
    Record<string, MemberFundSummary>
  >({});

  const handleMemberSummaryChange = useCallback(
    (summary: MemberFundSummary) => {
      setMemberFundSummaries((prev) => {
        const prevForGroup = prev[summary.groupId];
        if (
          prevForGroup &&
          prevForGroup.totalFunds === summary.totalFunds &&
          prevForGroup.collected === summary.collected &&
          prevForGroup.pending === summary.pending
        ) {
          return prev;
        }
        return {
          ...prev,
          [summary.groupId]: summary,
        };
      });
    },
    [],
  );

  const funds = useMemo<FundView[]>(() => {
    return safeGroups.map((g) => {
      const groupRecord = isRecord(g) ? g : {};

      const id = toStr(groupRecord._id ?? groupRecord.id ?? "");

      const baseTotal = toNum(
        groupRecord.totalAmount ?? groupRecord.chitValue ?? 0,
      );
      const baseCollected = toNum(
        groupRecord.collectedAmount ?? groupRecord.collected ?? 0,
      );

      const override = memberFundSummaries[id];

      const totalAmount = override
        ? override.totalFunds
        : baseTotal;
      const collectedAmount = override
        ? override.collected
        : baseCollected;
      const pendingAmount = override
        ? override.pending
        : Math.max(0, totalAmount - collectedAmount);

      const startDateStr = toStr(groupRecord.startDate ?? "");

      const numberOfInstallmentsRaw = toNum(
        groupRecord.numberOfInstallments ??
          groupRecord.totalMonths ??
          0,
      );
      const numberOfInstallments =
        numberOfInstallmentsRaw > 0
          ? numberOfInstallmentsRaw
          : 1;

      const completedInstallmentsRaw =
        monthsElapsedSinceStart(startDateStr);
      const completedInstallments = Math.min(
        completedInstallmentsRaw,
        numberOfInstallments,
      );

      const installmentProgress =
        (completedInstallments / numberOfInstallments) * 100;

      return {
        id,
        fundName: toStr(
          groupRecord.fundName ?? groupRecord.name ?? "",
        ),
        groupName: toStr(
          groupRecord.groupName ?? groupRecord.group ?? "",
        ),
        totalAmount,
        collectedAmount,
        pendingAmount,
        penaltyPercent: toNum(
          groupRecord.penaltyPercent ??
            groupRecord.penalty ??
            0,
        ),
        startDate: startDateStr,
        maturityDate: toStr(
          groupRecord.maturityDate ??
            groupRecord.endDate ??
            "",
        ),
        status: toStr(groupRecord.status ?? "Active"),
        interestRate: toNum(groupRecord.interestRate ?? 0),
        numberOfInstallments,
        completedInstallments,
        installmentProgress,
        raw: g,
      };
    });
  }, [safeGroups, memberFundSummaries]);

  const userFunds = useMemo<FundView[]>(() => {
    if (Array.isArray(joined) && joined.length) {
      const setJ = new Set(joined.map((x) => idStr(x)));
      return funds.filter((f) => setJ.has(f.id));
    }

    return funds.filter((f) => {
      const grp = safeGroups.find((g) => {
        if (!isRecord(g)) return false;
        const gid = toStr(g._id ?? g.id ?? "");
        return gid === f.id;
      });

      if (!grp || !isRecord(grp)) return false;

      const membersRaw =
        (grp.members as unknown) ??
        grp.memberIds ??
        grp.users ??
        [];

      const members = Array.isArray(membersRaw) ? membersRaw : [];
      if (members.length === 0) return false;

      return members.some((m) => {
        if (typeof m === "string") return m === authId;
        if (isRecord(m)) {
          return idStr(m._id ?? m.id) === authId;
        }
        return false;
      });
    });
  }, [joined, funds, safeGroups, authId]);

  const filtered = userFunds.filter((f) =>
    `${f.fundName} ${f.groupName}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  const totalFunds = userFunds.reduce(
    (sum, f) => sum + f.totalAmount,
    0,
  );
  const totalCollected = userFunds.reduce(
    (sum, f) => sum + f.collectedAmount,
    0,
  );
  const totalPending = userFunds.reduce(
    (sum, f) => sum + f.pendingAmount,
    0,
  );

  const statusClass = (s: string) =>
    s === "Active"
      ? "bg-green-100 text-green-800"
      : s === "Completed"
        ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-800";

  const toggleOpen = (id: string) => {
    setOpenGroupId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 p-1 sm:p-4 bg-[var(--bg-main)] min-h-screen">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">
              Total Funds
            </p>
            <h3 className="text-2xl font-bold">
              ₹{totalFunds.toLocaleString()}
            </h3>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">
              Collected
            </p>
            <h3 className="text-2xl font-bold text-green-600">
              ₹{totalCollected.toLocaleString()}
            </h3>
          </CardContent>
        </Card>
        <Card className="shadow-sm border">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">
              Pending
            </p>
            <h3 className="text-2xl font-bold text-red-600">
              ₹{totalPending.toLocaleString()}
            </h3>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-lg">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search funds or groups..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-10 h-11 rounded-xl shadow-sm border-gray-200 bg-white"
        />
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {filtered.map((f, i) => {
            const grp = safeGroups.find((g) => {
              if (!isRecord(g)) return false;
              const gid = toStr(g._id ?? g.id ?? "");
              return gid === f.id;
            });

            const isOpen = openGroupId === f.id;

            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="shadow-sm border overflow-hidden">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {f.fundName}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {f.groupName}
                            </p>
                          </div>
                          <Badge
                            className={statusClass(f.status)}
                          >
                            {f.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">
                              Total
                            </p>
                            <p className="font-semibold">
                              ₹
                              {f.totalAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              Collected
                            </p>
                            <p className="font-semibold text-green-600">
                              ₹
                              {f.collectedAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              Pending
                            </p>
                            <p className="font-semibold text-red-600">
                              ₹
                              {f.pendingAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              Penalty
                            </p>
                            <p className="font-semibold">
                              {f.penaltyPercent}%
                            </p>
                          </div>
                        </div>

                        <div className="mt-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">
                              Installment progress
                            </span>
                            <span className="font-semibold">
                              {f.installmentProgress.toFixed(
                                1,
                              )}
                              %
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                            <div
                              style={{
                                width: `${f.installmentProgress}%`,
                              }}
                              className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full transition-all"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {f.startDate} - {f.maturityDate}
                            </span>
                          </div>
                          <div>
                            {f.completedInstallments}/
                            {f.numberOfInstallments} installments
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleOpen(f.id)}
                        className="mt-2 md:mt-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium bg-white hover:bg-gray-50"
                      >
                        {isOpen ? (
                          <>
                            Hide details
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            View bids & payments
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                        <div className="space-y-3">
                          {grp && isRecord(grp) ? (
                            (() => {
                              const chitGroup = grp as ChitGroup;
                              const chitId = idStr(
                                (chitGroup as {
                                  _id?: unknown;
                                  id?: unknown;
                                })._id ??
                                  (chitGroup as {
                                    _id?: unknown;
                                    id?: unknown;
                                  }).id ??
                                  chitGroup,
                              );
                              const start = toStr(
                                (chitGroup as {
                                  startDate?: unknown;
                                }).startDate ?? "",
                              );
                              const currentMonthIndex =
                                monthsElapsedSinceStart(start);

                              const rawBiddingOpen = (
                                chitGroup as {
                                  biddingOpen?: unknown;
                                }
                              ).biddingOpen;
                              const rawBiddingMonth = (
                                chitGroup as {
                                  biddingMonthIndex?: unknown;
                                }
                              ).biddingMonthIndex;

                              const biddingMonth =
                                typeof rawBiddingMonth ===
                                  "number" &&
                                Number.isFinite(
                                  rawBiddingMonth,
                                )
                                  ? Math.max(
                                      1,
                                      Math.round(
                                        rawBiddingMonth,
                                      ),
                                    )
                                  : currentMonthIndex;

                              const isBiddingOpen =
                                rawBiddingOpen === true &&
                                biddingMonth ===
                                  currentMonthIndex;

                              const chitValue = toNum(
                                (chitGroup as {
                                  chitValue?: unknown;
                                }).chitValue ??
                                  (chitGroup as {
                                    totalAmount?: unknown;
                                  }).totalAmount ??
                                  0,
                              );

                              return (
                                <BidPanel
                                  chitId={chitId}
                                  memberId={authId}
                                  chitValue={chitValue}
                                  isBiddingOpen={
                                    isBiddingOpen
                                  }
                                  currentMonthIndex={
                                    currentMonthIndex
                                  }
                                />
                              );
                            })()
                          ) : (
                            <div className="text-sm text-gray-500">
                              Bid panel unavailable.
                            </div>
                          )}
                        </div>

                        <PaymentPanel
                          groupObj={grp ?? {}}
                          memberId={authId}
                          onSummaryChange={
                            handleMemberSummaryChange
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoadingFunds && (
          <div className="text-center text-gray-500 mt-4 text-sm">
            Loading your funds...
          </div>
        )}

        {!isLoadingFunds && filtered.length === 0 && (
          <div className="text-center text-gray-500 mt-4 text-sm">
            You have no active chit funds joined.
          </div>
        )}
      </div>
    </div>
  );
}
