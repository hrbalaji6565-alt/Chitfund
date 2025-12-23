// src/app/admin/collections/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Download,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { fetchMembers } from "@/store/memberSlice";
import type { RootState, AppDispatch } from "@/store/store";
import toast from "react-hot-toast";

type Mode = "cash" | "upi" | "bank" | "cheque";

type PendingRow = {
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

type RowWithLocal = PendingRow & {
  payNow: number;
  mode: Mode;
  date: string;
};

const fmtCurrency = (n: number): string =>
  `₹${n.toLocaleString("en-IN")}`;

export default function CollectionsPage() {
  const dispatch = useDispatch<AppDispatch>();

  // members for names
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
      if (
        typeof it === "object" &&
        it !== null &&
        !Array.isArray(it)
      ) {
        const rec = it as Record<string, unknown>;
        const id = String(rec._id ?? rec.id ?? "");
        const name =
          typeof rec.name === "string" ? rec.name : undefined;
        return { id, name };
      }
      const id = String(it ?? "");
      return { id, name: undefined as string | undefined };
    });
  });

  useEffect(() => {
    if (!membersFromStore.length) {
      dispatch(fetchMembers());
    }
  }, [dispatch, membersFromStore.length]);

  const memberNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mm of membersFromStore) {
      if (mm.id) m[mm.id] = mm.name ?? mm.id;
    }
    return m;
  }, [membersFromStore]);

  const [rows, setRows] = useState<RowWithLocal[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    todayTotal: 0,
    monthTotal: 0,
    yearTotal: 0,
  });
 

  async function loadPending() {
    setLoading(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/collections/pending", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        items?: PendingRow[];
        stats?: Stats;
        error?: string;
      };
      if (!res.ok || !json.success || !json.items) {
        throw new Error(json.error ?? res.statusText);
      }

      if (json.stats) {
        setStats(json.stats);
      }

      const enriched: RowWithLocal[] = json.items
        // safety: skip rows with pending <= 0
        .filter((r) => r.pending > 0)
        .map((r) => ({
          ...r,
          payNow: r.pending,
          mode: "cash",
          date: new Date().toISOString().split("T")[0],
        }));
      setRows(enriched);
    } catch (err) {
      setErrorText(
        err instanceof Error
          ? err.message
          : "Failed to load pending list",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPending();
  }, []);

  const groups = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) {
      if (!set.has(r.chitGroupId)) {
        set.set(r.chitGroupId, r.chitGroupName);
      }
    }
    return Array.from(set.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [rows]);

  const visibleRowsRaw = useMemo(
    () =>
      selectedGroup === "all"
        ? rows
        : rows.filter((r) => r.chitGroupId === selectedGroup),
    [rows, selectedGroup],
  );

  // extra safety: ignore if pending <= 0
  const visibleRows = visibleRowsRaw.filter((r) => r.pending > 0);

  const totalPendingVisible = visibleRows.reduce(
    (sum, r) => sum + r.pending,
    0,
  );

  const totalToCollectNow = visibleRows.reduce(
    (sum, r) =>
      sum + (Number.isFinite(r.payNow) ? r.payNow : 0),
    0,
  );

  async function handleCollect(row: RowWithLocal) {
  try {
    setErrorText(null);

    if (row.payNow <= 0 || row.payNow > row.pending) {
      setErrorText(
        `Invalid amount for ${row.memberName ?? row.memberId}. It must be > 0 and ≤ pending.`
      );
      return;
    }

    const body = {
      chitGroupId: row.chitGroupId,
      memberId: row.memberId,
      monthIndex: row.monthIndex,
      amount: row.payNow,
      mode: row.mode,
      note: "Collection visit",
      utr: "",
      collectorRole: "collector" as const,
      collectedById: undefined,
    };

    const res = await fetch("/api/collections/collect", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
      stats?: Stats;
    };

    if (!res.ok || !json.success) {
      throw new Error(json.error ?? res.statusText);
    }

    if (json.stats) {
      setStats(json.stats);
    }

    setRows((prev) =>
      prev
        .map((r) =>
          r.id === row.id
            ? {
                ...r,
                paid: r.paid + row.payNow,
                pending: Math.max(0, r.pending - row.payNow),
                payNow: Math.max(0, r.pending - row.payNow),
              }
            : r
        )
        .filter((r) => r.pending > 0)
    );

    toast.success("Collection successful");
  } catch (err) {
    setErrorText(
      err instanceof Error ? err.message : "Failed to submit collection"
    );
  }
}


  const displayMemberName = (r: RowWithLocal): string =>
    r.memberName ??
    memberNameMap[r.memberId] ??
    r.memberId;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Today collected
                  </p>
                  <h3 className="text-2xl font-bold text-emerald-600">
                    {fmtCurrency(stats.todayTotal)}
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50">
                  <CheckCircle className="w-7 h-7 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    This month
                  </p>
                  <h3 className="text-2xl font-bold text-indigo-600">
                    {fmtCurrency(stats.monthTotal)}
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50">
                  <Calendar className="w-7 h-7 text-indigo-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    This year
                  </p>
                  <h3 className="text-2xl font-bold text-blue-600">
                    {fmtCurrency(stats.yearTotal)}
                  </h3>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50">
                  <DollarSign className="w-7 h-7 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <p className="text-sm text-gray-500 mb-1">
                Pending in view
              </p>
              <h3 className="text-2xl font-bold text-red-600">
                {fmtCurrency(totalPendingVisible)}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Planned to collect now:{" "}
                {fmtCurrency(totalToCollectNow)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Group filter + table */}
      <Card className="shadow-sm border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
            <CardTitle className="text-lg">
              Monthly Collection Management
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={selectedGroup}
                onValueChange={setSelectedGroup}
              >
                <SelectTrigger className="w-56 h-10 rounded-xl">
                  <SelectValue placeholder="Filter by group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All groups
                  </SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => void loadPending()}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {errorText && (
            <div className="mb-2 text-sm text-red-600">
              {errorText}
            </div>
          )}
          {loading && (
            <div className="mb-2 text-sm text-gray-500">
              Loading pending members…
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left">Member</th>
                  <th className="py-3 px-4 text-left">Group</th>
                  <th className="py-3 px-4 text-left">Expected</th>
                  <th className="py-3 px-4 text-left">Paid</th>
                  <th className="py-3 px-4 text-left">Pending</th>
                  <th className="py-3 px-4 text-left">
                    Collect now
                  </th>
                  <th className="py-3 px-4 text-left">Mode</th>
                  <th className="py-3 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {visibleRows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-t"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {displayMemberName(row)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Month #{row.monthIndex}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">
                        {row.chitGroupName}
                      </td>
                      <td className="py-3 px-4">
                        {fmtCurrency(row.expected)}
                      </td>
                      <td className="py-3 px-4">
                        {fmtCurrency(row.paid)}
                      </td>
                      <td className="py-3 px-4 text-red-600 font-semibold">
                        {fmtCurrency(row.pending)}
                      </td>
                      <td className="py-3 px-4">
                        <Input
                          type="number"
                          min={0}
                          max={row.pending}
                          value={row.payNow}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            const n = v ? Number(v) : 0;
                            if (Number.isNaN(n)) return;
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, payNow: n }
                                  : r,
                              ),
                            );
                          }}
                          className="h-9 w-28 text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Select
                          value={row.mode}
                          onValueChange={(value) => {
                            const v = value as Mode;
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, mode: v }
                                  : r,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger className="h-9 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">
                              Cash
                            </SelectItem>
                            <SelectItem value="upi">
                              UPI
                            </SelectItem>
                            <SelectItem value="bank">
                              Bank transfer
                            </SelectItem>
                            <SelectItem value="cheque">
                              Cheque
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          disabled={
                            row.pending <= 0 || row.payNow <= 0
                          }
                          onClick={() =>
                            void handleCollect(row)
                          }
                        >
                          Collect
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {visibleRows.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-4 text-center text-sm text-gray-500"
                    >
                      No pending installments for selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

     
    </div>
  );
}
