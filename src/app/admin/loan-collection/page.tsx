"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

type PendingLoanRow = {
  loanId: string;
  memberId: string;
  monthIndex: number;
  dueDate: string;
  installmentAmount: number;
  penalty: number;
  totalDue: number;
};

type Mode = "cash" | "upi" | "bank" | "cheque";

export default function LoanCollectionPage() {
  const [rows, setRows] = useState<PendingLoanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modeByKey, setModeByKey] = useState<Record<string, Mode>>({});
  const [amountByKey, setAmountByKey] = useState<Record<string, number>>({});
  const [collectorId, setCollectorId] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/loans/collector/pending", {
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) {
      toast.error(data.error || "Failed to load");
      return;
    }
    setRows(
      (data.items as PendingLoanRow[]).map((r) => ({
        ...r,
        dueDate: new Date(r.dueDate).toISOString(),
      })),
    );
  };

  useEffect(() => {
    load();
  }, []);

  const keyFor = (r: PendingLoanRow) =>
    `${r.loanId}_${r.monthIndex}`;

  const visibleRows = useMemo(() => rows, [rows]);

  const handleCollect = async (r: PendingLoanRow) => {
    const key = keyFor(r);
    const amount =
      amountByKey[key] ?? r.totalDue;
    const mode = modeByKey[key] ?? "cash";

    if (!collectorId.trim()) {
      toast.error("Collector ID required");
      return;
    }

    const res = await fetch("/api/loans/collector/collect", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loanId: r.loanId,
        monthIndex: r.monthIndex,
        amount,
        method: mode,
        collectedById: collectorId.trim(),
      }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(data.error || "Failed to collect");
      return;
    }
    toast.success("Collected successfully");
    load();
  };

  const fmtCurrency = (n: number) =>
    `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <h1 className="text-xl font-semibold">
          Loan Collection
        </h1>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Collector ID"
            className="h-9 w-40"
            value={collectorId}
            onChange={(e) =>
              setCollectorId(e.target.value)
            }
          />
          <Button
            variant="outline"
            className="h-9"
            onClick={load}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">
            Pending EMIs
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && (
            <p className="text-sm text-gray-500 mb-2">
              Loading pending EMIs…
            </p>
          )}
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-3 text-left">Member</th>
                <th className="py-2 px-3 text-left">Loan</th>
                <th className="py-2 px-3 text-left">Month</th>
                <th className="py-2 px-3 text-left">Due Date</th>
                <th className="py-2 px-3 text-left">Installment</th>
                <th className="py-2 px-3 text-left">Penalty</th>
                <th className="py-2 px-3 text-left">Total Due</th>
                <th className="py-2 px-3 text-left">Amount</th>
                <th className="py-2 px-3 text-left">Mode</th>
                <th className="py-2 px-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {visibleRows.map((r, idx) => {
                  const key = keyFor(r);
                  const due = new Date(r.dueDate);
                  const amount =
                    amountByKey[key] ?? r.totalDue;
                  const mode = modeByKey[key] ?? "cash";

                  return (
                    <motion.tr
                      key={key}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.01 }}
                      className="border-t"
                    >
                      <td className="py-2 px-3">
                        {r.memberId}
                      </td>
                      <td className="py-2 px-3">
                        {r.loanId}
                      </td>
                      <td className="py-2 px-3">
                        #{r.monthIndex}
                      </td>
                      <td className="py-2 px-3">
                        {due.toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-2 px-3">
                        {fmtCurrency(r.installmentAmount)}
                      </td>
                      <td className="py-2 px-3 text-red-600">
                        {fmtCurrency(r.penalty)}
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {fmtCurrency(r.totalDue)}
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          className="h-8 w-24"
                          type="number"
                          value={amount}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            const n = v ? Number(v) : 0;
                            if (Number.isNaN(n)) return;
                            setAmountByKey((prev) => ({
                              ...prev,
                              [key]: n,
                            }));
                          }}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Select
                          value={mode}
                          onValueChange={(value) => {
                            setModeByKey((prev) => ({
                              ...prev,
                              [key]: value as Mode,
                            }));
                          }}
                        >
                          <SelectTrigger className="h-8 w-24 text-xs">
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
                              Bank
                            </SelectItem>
                            <SelectItem value="cheque">
                              Cheque
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={() => handleCollect(r)}
                        >
                          Collect
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
