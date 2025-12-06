// src/app/user/dashboard/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import Button from "@/app/components/ui/button";
import {
  TrendingUp,
  Wallet,
  CreditCard,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  PlusCircle,
} from "lucide-react";

/* ---------- shared helpers & types ---------- */

type UnknownRecord = Record<string, unknown>;

type TxStatus = "approved" | "pending" | "rejected" | "failed" | "unknown";

type Tx = {
  id: string;
  date?: string;
  amount: number;
  method?: string;
  status: TxStatus;
  remarks?: string;
  groupId?: string;
  groupName?: string;
};

type FundsSummary = {
  activeCount: number;
  totalCommitment: number;
  hasWonAuction: boolean;
  auctionPayoutTotal: number;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toStr = (v: unknown, fallback = ""): string =>
  typeof v === "string"
    ? v
    : typeof v === "number"
      ? String(v)
      : fallback;

const toNum = (v: unknown, fallback = 0): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const formatMoney = (n: number): string =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

const monthsElapsedSinceStart = (start?: string): number => {
  if (!start) return 1;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return 1;
  const now = new Date();
  let months =
    (now.getFullYear() - s.getFullYear()) * 12 +
    (now.getMonth() - s.getMonth());
  if (now.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months + 1);
};

const statusClass = (s: TxStatus): string => {
  if (s === "approved") return "bg-green-100 text-green-800";
  if (s === "pending") return "bg-yellow-100 text-yellow-800";
  if (s === "rejected" || s === "failed")
    return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
};

const toArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (isRecord(v)) {
    if (Array.isArray(v.transactions)) return v.transactions;
    if (Array.isArray(v.payments)) return v.payments;
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.data)) return v.data;
  }
  return [];
};

const getString = (obj: unknown, ...keys: string[]): string | undefined => {
  if (!isRecord(obj)) return undefined;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim() !== "") return val;
    if (typeof val === "number") return String(val);
  }
  return undefined;
};

const matchesMember = (raw: UnknownRecord, memberId: string): boolean => {
  try {
    const direct =
      getString(raw, "memberId") ||
      getString(raw.member, "_id", "id", "memberId");
    if (direct && direct === memberId) return true;

    if (JSON.stringify(raw).includes(memberId)) return true;
  } catch {
    // ignore
  }
  return false;
};

const normalizeTx = (raw: UnknownRecord): Tx => {
  const id =
    getString(raw, "_id", "id", "txId") ??
    Math.random().toString(36).slice(2);

  const amount =
    toNum(
      raw.amount ??
        raw.amt ??
        raw.payAmount ??
        raw.total ??
        0,
      0,
    ) || 0;

  const date =
    (typeof raw.createdAt === "string" && raw.createdAt) ||
    (typeof raw.date === "string" && raw.date) ||
    undefined;

  const method =
    (typeof raw.method === "string" && raw.method) ||
    (typeof raw.type === "string" && raw.type) ||
    undefined;

  const rawStatus =
    raw.status ?? raw.state ?? raw.verified ?? raw.approvedAt;
  const statusStr = String(rawStatus ?? "").toLowerCase();

  const status: TxStatus =
    rawStatus === true ||
    statusStr === "approved" ||
    Boolean(raw.approvedAt)
      ? "approved"
      : statusStr === "rejected"
        ? "rejected"
        : statusStr === "failed"
          ? "failed"
          : statusStr === "pending"
            ? "pending"
            : "unknown";

  const remarks =
    (typeof raw.note === "string" && raw.note) ||
    (typeof raw.adminNote === "string" && raw.adminNote) ||
    (typeof raw.remarks === "string" && raw.remarks) ||
    undefined;

  const groupId =
    getString(raw, "groupId", "chitGroupId") ??
    getString(raw.group, "_id", "id");

  const groupName =
    getString(raw.group, "name", "groupName", "title") ??
    (typeof raw.groupName === "string" ? raw.groupName : undefined);

  return {
    id,
    amount,
    date,
    method,
    status,
    remarks,
    groupId,
    groupName,
  };
};

const groupHasMember = (group: UnknownRecord, memberId: string): boolean => {
  const membersField = group.members;
  if (Array.isArray(membersField)) {
    for (const m of membersField) {
      if (typeof m === "string" && m === memberId) return true;
      if (isRecord(m)) {
        const mid = getString(m, "_id", "id", "memberId");
        if (mid === memberId) return true;
      }
    }
  }
  const direct =
    getString(group, "memberId") || getString(group, "member");
  if (direct && direct === memberId) return true;
  return false;
};

const isGroupActive = (group: UnknownRecord): boolean => {
  const rawStatus = group.status ?? group.state;
  const s =
    typeof rawStatus === "string"
      ? rawStatus.toLowerCase()
      : "";
  if (
    s.includes("complete") ||
    s.includes("closed") ||
    s.includes("finish") ||
    s.includes("inactive") ||
    s.includes("cancel")
  ) {
    return false;
  }
  return true;
};

const resolveMemberId = (authMember: unknown): string | undefined => {
  const fromAuth =
    getString(authMember, "_id", "id") ||
    getString(authMember, "memberId");
  if (fromAuth) return fromAuth;

  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("member");
      if (raw) {
        const parsed = JSON.parse(raw) as UnknownRecord | null;
        const idFromLocal =
          parsed?._id ?? parsed?.id ?? parsed?.memberId;
        if (idFromLocal !== undefined) return String(idFromLocal);
      }
    }
  } catch {
    // ignore
  }
  return undefined;
};

/* ---------- API helpers (pure) ---------- */

async function fetchTransactionsForMember(
  memberId: string,
): Promise<{ txs: Tx[]; totalPaid: number }> {
  const candidates: string[] = [
    `/api/user/transactions?memberId=${encodeURIComponent(memberId)}`,
    `/api/transactions?memberId=${encodeURIComponent(memberId)}`,
    `/api/transactions/me?memberId=${encodeURIComponent(memberId)}`,
    `/api/payments?memberId=${encodeURIComponent(memberId)}`,
    "/api/user/transactions",
    "/api/transactions",
    "/api/transactions/me",
    "/api/payments",
  ];

  let found: UnknownRecord[] = [];

  for (const url of candidates) {
    try {
      let res = await fetch(url, { credentials: "include" });
      if (res.status === 405) {
        res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true, memberId }),
        });
      }
      if (!res.ok) continue;

      const body: unknown = await res.json().catch(() => ({}));
      const arr = toArray(body).filter(isRecord) as UnknownRecord[];
      if (!arr.length) continue;

      const filtered = arr.filter((p) => matchesMember(p, memberId));
      found = filtered.length ? filtered : arr;
      if (found.length) break;
    } catch {
      // ignore and try next
    }
  }

  if (!found.length) {
    return { txs: [], totalPaid: 0 };
  }

  const txs = found
    .map((raw) => normalizeTx(raw))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const totalPaid = txs
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.amount, 0);

  return { txs, totalPaid };
}

async function fetchFundsAndAuctionsForMember(
  memberId: string,
): Promise<FundsSummary> {
  let groups: UnknownRecord[] = [];

  try {
    const res = await fetch(
      `/api/chitgroups?memberId=${encodeURIComponent(memberId)}`,
      { credentials: "include" },
    );
    const body: unknown = await res.json().catch(() => ({}));
    const fromBody = isRecord(body) && Array.isArray(body.groups)
      ? body.groups
      : body;
    groups = toArray(fromBody).filter(isRecord) as UnknownRecord[];
  } catch {
    // fallback: all groups
    try {
      const res = await fetch("/api/chitgroups", {
        credentials: "include",
      });
      const body: unknown = await res.json().catch(() => ({}));
      const fromBody = isRecord(body) && Array.isArray(body.groups)
        ? body.groups
        : body;
      groups = toArray(fromBody).filter(isRecord) as UnknownRecord[];
    } catch {
      // ignore
    }
  }

  if (!groups.length) {
    return {
      activeCount: 0,
      totalCommitment: 0,
      hasWonAuction: false,
      auctionPayoutTotal: 0,
    };
  }

  const myGroupsRaw =
    groups.filter((g) => groupHasMember(g, memberId)) || groups;

  const activeGroups = myGroupsRaw.filter(isGroupActive);

  let activeCount = 0;
  let totalCommitment = 0;

  for (const g of activeGroups) {
    activeCount += 1;

    const monthly = toNum(
      (g as { monthlyInstallment?: unknown }).monthlyInstallment ??
        (g as { monthly?: unknown }).monthly ??
        0,
      0,
    );

    const membersCountRaw =
      (g as { totalMembers?: unknown }).totalMembers ??
      (Array.isArray(g.members)
        ? g.members.length
        : 0);
    const membersCount = Math.max(
      1,
      toNum(membersCountRaw, 1),
    );

    const chitValue = toNum(
      (g as { chitValue?: unknown }).chitValue ??
        (g as { totalAmount?: unknown }).totalAmount ??
        0,
      0,
    );

    const totalMonths = Math.max(
      1,
      toNum(
        (g as { totalMonths?: unknown }).totalMonths ??
          (g as { numberOfInstallments?: unknown })
            .numberOfInstallments ??
          0,
        1,
      ),
    );

    let perMemberInstallment = monthly;
    if (!perMemberInstallment && chitValue > 0 && totalMonths > 0) {
      const perInstallment = chitValue / totalMonths;
      perMemberInstallment =
        membersCount > 0
          ? perInstallment / membersCount
          : perInstallment;
    }

    let commitment = 0;
    if (perMemberInstallment > 0 && totalMonths > 0) {
      commitment = perMemberInstallment * totalMonths;
    } else if (chitValue > 0) {
      commitment = chitValue;
    }

    if (commitment > 0) {
      totalCommitment += commitment;
    }
  }

  // auction info: check if user has won current month in any active chit
  let hasWonAuction = false;
  let auctionPayoutTotal = 0;

  const auctionPromises = activeGroups.map(async (g) => {
    const gid =
      getString(g, "_id", "id") ?? "";
    if (!gid) return;

    const startDate = toStr(
      (g as { startDate?: unknown }).startDate ?? "",
    );
    const curMonth = monthsElapsedSinceStart(startDate);

    try {
      const res = await fetch(
        `/api/chitgroups/${encodeURIComponent(
          gid,
        )}/auction?monthIndex=${curMonth}`,
        { credentials: "include" },
      );
      const json: unknown = await res
        .json()
        .catch(() => ({} as unknown));
      if (!res.ok || !isRecord(json)) return;

      const root = json;
      let auction: UnknownRecord | null = null;

      if (root.auction && isRecord(root.auction)) {
        auction = root.auction;
      } else if (root.data && isRecord(root.data)) {
        auction = root.data;
      }

      if (!auction) return;

      const winningMemberId =
        getString(auction, "winningMemberId", "winner") ?? "";
      if (!winningMemberId || winningMemberId !== memberId) return;

      hasWonAuction = true;
      const payout = toNum(
        (auction as { winningPayout?: unknown }).winningPayout ??
          (auction as { payoutToWinner?: unknown })
            .payoutToWinner ??
          0,
        0,
      );
      auctionPayoutTotal += payout;
    } catch {
      // ignore per-group failure
    }
  });

  try {
    await Promise.all(auctionPromises);
  } catch {
    // ignore
  }

  return {
    activeCount,
    totalCommitment,
    hasWonAuction,
    auctionPayoutTotal,
  };
}

/* ---------- main component ---------- */

export default function UserDashboardPage() {
  const authMember = useSelector(
    (s: RootState) => s.auth?.member ?? null,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);

  const [activeFundsCount, setActiveFundsCount] = useState(0);
  const [totalCommitment, setTotalCommitment] = useState(0);
  const [hasWonAuction, setHasWonAuction] = useState(false);
  const [auctionPayoutTotal, setAuctionPayoutTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const memberId = resolveMemberId(authMember);
        if (!memberId) {
          setError("Member not identified.");
          return;
        }

        const [txResult, fundsResult] = await Promise.all([
          fetchTransactionsForMember(memberId),
          fetchFundsAndAuctionsForMember(memberId),
        ]);

        if (cancelled) return;

        setTransactions(txResult.txs);
        setTotalPaid(txResult.totalPaid);

        setActiveFundsCount(fundsResult.activeCount);
        setTotalCommitment(fundsResult.totalCommitment);
        setHasWonAuction(fundsResult.hasWonAuction);
        setAuctionPayoutTotal(fundsResult.auctionPayoutTotal);
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authMember]);

  const recentTransactions = useMemo(
    () => transactions.slice(0, 5),
    [transactions],
  );

  const metrics = useMemo(
    () => [
      {
        title: "Active Chit Funds",
        value: `${activeFundsCount}`,
        icon: <Wallet className="w-6 h-6 text-white" />,
        bg: "var(--color-primary)",
      },
      {
        title: "Total Commitment",
        value: formatMoney(totalCommitment),
        icon: <TrendingUp className="w-6 h-6 text-white" />,
        bg: "var(--color-secondary)",
      },
      {
        title: "Paid Till Now",
        value: formatMoney(totalPaid),
        icon: <CreditCard className="w-6 h-6 text-white" />,
        bg: "var(--color-accent)",
      },
      {
        title: "Auction Status",
        value: hasWonAuction
          ? `Won • ${formatMoney(auctionPayoutTotal)}`
          : "Not won yet",
        icon: <Clock className="w-6 h-6 text-white" />,
        bg: "var(--color-accent-light)",
      },
    ],
    [
      activeFundsCount,
      totalCommitment,
      totalPaid,
      hasWonAuction,
      auctionPayoutTotal,
    ],
  );

  return (
    <div className="p-4 space-y-5 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1
          className="text-2xl sm:text-3xl font-semibold"
          style={{ color: "var(--color-primary)" }}
        >
          User Dashboard
        </h1>

        <Button
          className="rounded-lg text-white text-sm sm:text-base"
          style={{
            background: "var(--gradient-primary)",
            boxShadow: "0 3px 6px var(--shadow-color)",
            padding: "8px 14px",
          }}
        >
          <PlusCircle className="w-4 h-4 mr-1" />
          New
        </Button>
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="text-sm text-gray-500">
          Loading your dashboard…
        </div>
      )}
      {error && !loading && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      <div
        className="grid gap-2 sm:gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        {metrics.map((item, idx) => (
          <Card
            key={idx}
            className="border-0 shadow-sm transition-transform hover:scale-[1.02]"
            style={{
              background: item.bg,
              color: "var(--text-light)",
              minHeight: "95px",
              width: "100%",
            }}
          >
            <CardContent className="flex flex-col justify-between p-3 sm:p-4">
              <div className="flex justify-between items-center">
                <p className="text-[11px] sm:text-sm opacity-90">
                  {item.title}
                </p>
                <div className="bg-white/25 p-2 rounded-xl shrink-0">
                  {item.icon}
                </div>
              </div>
              <h3 className="text-lg sm:text-2xl font-bold mt-1">
                {item.value}
              </h3>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Transactions */}
      <Card
        className="shadow-lg border-0"
        style={{ width: "100%" }}
      >
        <CardHeader
          style={{
            background: "var(--bg-highlight)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <CardTitle
            className="py-2"
            style={{ color: "var(--color-secondary)" }}
          >
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent
          className="p-0 overflow-x-auto"
          style={{ scrollbarWidth: "thin" }}
        >
          {recentTransactions.length === 0 && !loading ? (
            <div className="p-4 text-sm text-gray-500">
              No transactions found for this account yet.
            </div>
          ) : (
            <table
              className="min-w-full border-collapse text-sm sm:text-base"
              style={{
                width: "100%",
                tableLayout: "auto",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-highlight)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <th
                    className="p-3 text-left font-medium"
                    style={{ minWidth: "150px" }}
                  >
                    Name
                  </th>
                  <th
                    className="p-3 text-left font-medium"
                    style={{ minWidth: "120px" }}
                  >
                    Date
                  </th>
                  <th
                    className="p-3 text-left font-medium"
                    style={{ minWidth: "120px" }}
                  >
                    Status
                  </th>
                  <th
                    className="p-3 text-right font-medium"
                    style={{ minWidth: "100px" }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-[var(--bg-highlight)] transition"
                    style={{
                      borderBottom:
                        "1px solid var(--border-color)",
                    }}
                  >
                    <td
                      className="p-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {tx.groupName ||
                        tx.method ||
                        "Payment"}
                    </td>
                    <td
                      className="p-3"
                      style={{
                        color: "var(--text-secondary)",
                      }}
                    >
                      {tx.date
                        ? new Date(tx.date).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-3">
                      <Badge
                        className={`rounded-full px-2 py-1 text-xs sm:text-sm ${statusClass(
                          tx.status,
                        )}`}
                      >
                        {tx.status === "approved" ? (
                          <ArrowUpRight className="w-3 h-3 inline mr-1" />
                        ) : tx.status === "rejected" ||
                          tx.status === "failed" ? (
                          <ArrowDownRight className="w-3 h-3 inline mr-1" />
                        ) : (
                          <Clock className="w-3 h-3 inline mr-1" />
                        )}
                        {tx.status.charAt(0).toUpperCase() +
                          tx.status.slice(1)}
                      </Badge>
                    </td>
                    <td
                      className="p-3 text-right font-semibold"
                      style={{
                        color:
                          tx.status === "approved"
                            ? "var(--color-secondary)"
                            : "var(--color-primary)",
                      }}
                    >
                      {formatMoney(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
