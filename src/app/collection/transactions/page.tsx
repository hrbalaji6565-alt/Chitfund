"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { User } from "lucide-react";

/* ================= TYPES ================= */

type UnknownRecord = Record<string, unknown>;

const PAGE_SIZE = 20;

type CollectionUser = {
  id: string;
  name: string;
  email: string;
};

type MeApiResponse = {
  success: boolean;
  user?: CollectionUser;
};

type AllocationDetail = {
  monthIndex: number;
  principalPaid: number;
  penaltyPaid: number;
};

type Transaction = {
  _id: string;
  memberName?: string | null;
  groupName?: string | null;
  amount: number;
  utr?: string | null;
  status?: string | null;
  method?: string | null;
  createdAt?: string;
  allocationDetails?: AllocationDetail[];
  collectedById?: string | null;
  collectorName?: string | null;
  collectorRole?: string | null;
};

/* ================= HELPERS ================= */

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asString = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  try {
    return String(v);
  } catch {
    return undefined;
  }
};

const toNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatDate = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN");
};

const formatMonthYear = (iso?: string) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

/* ================= NORMALIZER (ADMIN LEVEL) ================= */

function normalizePayment(raw: unknown): Transaction {
  const r: UnknownRecord = isRecord(raw) ? raw : {};
  const rawMeta = isRecord(r.rawMeta) ? r.rawMeta : undefined;

  const rawMode = asString(
    r.method ??
      r.paymentMode ??
      r.mode ??
      r.type ??
      (rawMeta ? rawMeta.method ?? rawMeta.paymentMode ?? rawMeta.mode : undefined),
  );

  let method: string | null = null;
  if (rawMode) {
    const m = rawMode.toLowerCase();
    if (m.includes("cash")) method = "cash";
    else if (
      m.includes("upi") ||
      m.includes("gpay") ||
      m.includes("phonepe") ||
      m.includes("paytm") ||
      m.includes("bank") ||
      m.includes("neft") ||
      m.includes("rtgs") ||
      m.includes("imps")
    ) {
      method = "upi";
    }
  }

  return {
    _id: String(r._id ?? ""),
    memberName: asString(r.memberName ?? r.name),
    groupName: asString(r.groupName),
    amount: toNumber(r.amount),
    utr: asString(r.utr ?? r.txnId ?? r.reference) ?? null,
    status: asString(r.status),
    method,
    createdAt: asString(r.createdAt),
    allocationDetails: Array.isArray(r.allocationDetails)
      ? (r.allocationDetails as AllocationDetail[])
      : undefined,
    collectedById: asString(rawMeta?.collectedById ?? r.collectedById),
    collectorName: asString(
      rawMeta?.collectorName ?? (rawMeta as UnknownRecord)?.collectedByName ?? r.collectorName,
    ),
    collectorRole: asString(rawMeta?.collectorRole),
  };
}

/* ================= PAGE ================= */

export default function CollectorTransactionsPage() {
  const [collector, setCollector] = useState<CollectionUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  /* ===== LOAD COLLECTOR ===== */

  useEffect(() => {
    const loadMe = async () => {
      const res = await fetch("/api/collections/me", {
        credentials: "include",
      });
      const json = (await res.json()) as MeApiResponse;
      if (json.success && json.user) setCollector(json.user);
    };
    void loadMe();
  }, []);

  /* ===== LOAD TRANSACTIONS ===== */

  const loadTransactions = useCallback(
    async (nextPage: number, reset = false) => {
      if (!collector) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          status: "all",
          collectedById: collector.id,
          page: String(nextPage),
          limit: String(PAGE_SIZE),
        });

        const res = await fetch(`/api/admin/transactions?${params.toString()}`, {
          credentials: "include",
        });
        const json = await res.json();

        const incoming = (json.payments ?? []).map(normalizePayment);
        setTransactions((prev) => {
          if (reset) return incoming;
          const existing = new Set(prev.map((t) => t._id));
          const merged = [...prev];
          for (const item of incoming) {
            if (!existing.has(item._id)) merged.push(item);
          }
          return merged;
        });

        const pagination =
          isRecord(json) && isRecord(json.pagination) ? json.pagination : null;

        if (pagination && typeof pagination.hasMore === "boolean") {
          setHasMore(pagination.hasMore);
        } else {
          setHasMore(incoming.length === PAGE_SIZE);
        }

        setPage(nextPage);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collector],
  );

  useEffect(() => {
    if (!collector) return;
    void loadTransactions(1, true);
  }, [collector, loadTransactions]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        void loadTransactions(page + 1);
      },
      { rootMargin: "200px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadTransactions, loading, loadingMore, page]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.memberName?.toLowerCase().includes(q) ||
        t.groupName?.toLowerCase().includes(q) ||
        String(t.utr ?? "").toLowerCase().includes(q),
    );
  }, [transactions, search]);

  /* ================= UI ================= */

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">My Collection Transactions</h1>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search member / group / UTR"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          disabled={loading}
          onClick={() => {
            if (!collector) return;
            void loadTransactions(1, true);
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {filtered.map((p) => {
        const approved = (p.status ?? "").toLowerCase() === "approved";

        return (
          <Card key={p._id}>
            <CardContent className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-highlight)] grid place-items-center">
                    <User />
                  </div>
                  <div>
                    <div className="font-semibold text-lg flex items-center gap-2">
                      {p.memberName}
                      <Badge variant="outline" className="text-[10px]">
                        {approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">{p.groupName}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div className="font-semibold">₹{p.amount.toLocaleString("en-IN")}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Payment Mode</div>
                    <div className="font-medium">
                      {p.method === "cash" ? "CASH" : p.method === "upi" ? "UPI" : "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Installment Month</div>
                    <div className="font-medium">{formatMonthYear(p.createdAt)}</div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Received</div>
                    <div className="font-medium">{formatDate(p.createdAt)}</div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Collected By: <span className="font-medium">{p.collectorName ?? "-"}</span>
                </div>
              </div>

              <div className="text-xs text-gray-400">
                Payment ID
                <div className="font-mono mt-1">{p._id}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {loadingMore ? (
        <div className="py-4 text-center text-sm text-gray-500">Loading more...</div>
      ) : null}

      {filtered.length === 0 && !loading ? (
        <div className="py-6 text-center text-sm text-gray-500">No transactions found.</div>
      ) : null}

      <div ref={loadMoreRef} className="h-1" />
    </div>
  );
}
