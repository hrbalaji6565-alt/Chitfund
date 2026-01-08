"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { User } from "lucide-react";

/* ================= TYPES ================= */

type UnknownRecord = Record<string, unknown>;

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
  (rawMeta
    ? rawMeta.method ??
      rawMeta.paymentMode ??
      rawMeta.mode
    : undefined)
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
    collectedById: asString(
      rawMeta?.collectedById ?? r.collectedById,
    ),
    collectorName: asString(
      rawMeta?.collectorName ??
        (rawMeta as UnknownRecord)?.collectedByName ??
        r.collectorName,
    ),
    collectorRole: asString(rawMeta?.collectorRole),
  };
}

/* ================= PAGE ================= */

export default function CollectorTransactionsPage() {
  const [collector, setCollector] = useState<CollectionUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

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

  useEffect(() => {
    if (!collector) return;

    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/admin/transactions?status=all", {
        credentials: "include",
      });
      const json = await res.json();

      const all = (json.payments ?? [])
        .map(normalizePayment)
        .filter(
          (p: Transaction) =>
            p.collectedById === collector.id,
        );

      setTransactions(all);
      setLoading(false);
    };

    void load();
  }, [collector]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.memberName?.toLowerCase().includes(q) ||
        t.groupName?.toLowerCase().includes(q) ||
        String(t.utr ?? "").includes(q),
    );
  }, [transactions, search]);

  /* ================= UI ================= */

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">
        My Collection Transactions
      </h1>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Search member / group / UTR"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {filtered.map((p) => {
        const approved =
          (p.status ?? "").toLowerCase() === "approved";

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
                    <div className="text-xs text-gray-500">
                      {p.groupName}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500">Amount</div>
                    <div className="font-semibold">
                      ₹{p.amount.toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Payment Mode</div>
                    <div className="font-medium">
                      {p.method === "cash"
                        ? "CASH"
                        : p.method === "upi"
                          ? "UPI"
                          : "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Installment Month</div>
                    <div className="font-medium">
                      {formatMonthYear(p.createdAt)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">Received</div>
                    <div className="font-medium">
                      {formatDate(p.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                  Collected By:{" "}
                  <span className="font-medium">
                    {p.collectorName ?? "—"}
                  </span>
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
    </div>
  );
}
