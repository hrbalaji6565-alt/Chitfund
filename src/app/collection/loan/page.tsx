"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import Button from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

import { fetchMembers } from "@/store/memberSlice";
import type { RootState, AppDispatch } from "@/store/store";

type Mode = "CASH" | "UPI" | "BANK";

type LoanEMIPendingRow = {
  id: string;
  loanId: string;
  loanName: string;
  memberId: string;
  memberName: string;
  emiMonth: number;
  expected: number;
  paid: number;
  pending: number;
  dueDate: string;
  status: string;
};

type RowWithLocal = LoanEMIPendingRow & {
  collectNow: number;
  mode: Mode;
  date: string;
};

interface CollectionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "collector" | "admin";
  active: boolean;
  assignedGroupIds?: string[];
}

interface MeApiResponse {
  success: boolean;
  user?: CollectionUser;
  error?: string;
}

const fmtCurrency = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

export default function LoanCollectionPage() {
  const dispatch = useDispatch<AppDispatch>();

  // Helper function to check if EMI is for current month
  const isCurrentMonthEMI = (dueDateString: string): boolean => {
    try {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      const dueDate = new Date(dueDateString);
      const emiMonth = dueDate.getMonth();
      const emiYear = dueDate.getFullYear();
      
      return emiMonth === currentMonth && emiYear === currentYear;
    } catch {
      return false;
    }
  };

  // Helper function to get month name from due date
  const getMonthNameFromDueDate = (dueDateString: string): string => {
    try {
      const dueDate = new Date(dueDateString);
      return dueDate.toLocaleDateString("en-US", { month: "long" });
    } catch {
      return "Unknown";
    }
  };

  // Helper function to check if collection is allowed based on due date
  const isCollectionAllowed = (dueDateString: string): boolean => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      const dueDate = new Date(dueDateString);
      dueDate.setHours(0, 0, 0, 0); // Start of due date
      
      return today >= dueDate;
    } catch {
      return false; // If date parsing fails, don't allow collection
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  // ---------- members for names (same util as admin) ----------
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
      if (typeof it === "object" && it !== null && !Array.isArray(it)) {
        const rec = it as Record<string, unknown>;
        const id = String(rec._id ?? rec.id ?? "");
        const name = typeof rec.name === "string" ? rec.name : undefined;
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

  // ---------- logged-in collector info (/api/collections/me) ----------
  const [collectorError, setCollectorError] = useState<string | null>(null);
  const [collectorLoading, setCollectorLoading] = useState<boolean>(true);
  const [collector, setCollector] = useState<CollectionUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMe = async () => {
      try {
        setCollectorLoading(true);
        setCollectorError(null);

        const res = await fetch("/api/collections/me", {
          method: "GET",
          credentials: "include",
        });

        const data = (await res.json()) as MeApiResponse;

        if (!res.ok || !data.success || !data.user) {
          if (!cancelled) {
            setCollectorError(data.error ?? "Failed to load collector profile");
          }
          return;
        }

        if (!cancelled) {
          setCollector(data.user);
        }
      } catch {
        if (!cancelled) {
          setCollectorError("Failed to load collector profile");
        }
      } finally {
        if (!cancelled) {
          setCollectorLoading(false);
        }
      }
    };

    void loadMe();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- pending loan EMI list ----------
  const [rows, setRows] = useState<RowWithLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [receiptRow, setReceiptRow] = useState<RowWithLocal | null>(null);

  // Load pending loan EMIs
  async function loadPendingLoanEMIs() {
    setLoading(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/collections/loan-pending", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        items?: LoanEMIPendingRow[];
        error?: string;
      };

      if (!res.ok || !json.success || !json.items) {
        throw new Error(json.error ?? res.statusText);
      }

      const enriched: RowWithLocal[] = json.items
        .filter((r) => r.pending > 0)
        .map((r) => ({
          ...r,
          collectNow: r.pending,
          mode: "CASH",
          date: new Date().toISOString().split("T")[0],
        }));
      setRows(enriched);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Failed to load pending loan EMIs",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPendingLoanEMIs();
  }, []);

  // Handle EMI collection
  async function handleCollect(row: RowWithLocal) {
    try {
      setErrorText(null);
      
      // Frontend validation: Check due date
      if (!isCollectionAllowed(row.dueDate)) {
        setErrorText("EMI cannot be collected before due date.");
        return;
      }
      
      if (row.collectNow <= 0 || row.collectNow > row.pending) {
        setErrorText(
          `Invalid amount for ${row.memberName}. It must be > 0 and ≤ pending.`,
        );
        return;
      }

      const body = {
        loanId: row.loanId,
        memberId: row.memberId,
        emiMonth: row.emiMonth,
        amount: row.collectNow,
        mode: row.mode,
        collectorName: collector?.name ?? "Unknown Collector",
      };

      const res = await fetch("/api/collections/loan-collect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        transaction?: any;
        updatedEMI?: any;
      };

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? res.statusText);
      }

      // Update local rows
      setRows((prev) =>
        prev
          .map((r) =>
            r.id === row.id
              ? {
                ...r,
                paid: r.paid + row.collectNow,
                pending: Math.max(0, r.pending - row.collectNow),
                collectNow: Math.max(0, r.pending - row.collectNow),
                status: json.updatedEMI?.status || r.status,
              }
              : r,
          )
          .filter((r) => r.pending > 0), // Remove fully paid EMIs
      );

      setReceiptRow({
        ...row,
        pending: Math.max(0, row.pending - row.collectNow),
      });

    } catch (err) {
      setErrorText(
        err instanceof Error
          ? err.message
          : "Failed to submit loan EMI collection",
      );
    }
  }

  const displayMemberName = (r: RowWithLocal): string =>
    r.memberName ?? memberNameMap[r.memberId] ?? r.memberId;

  // Filter to show ONLY current month EMIs
  const visibleRows = rows.filter((r) => r.pending > 0 && isCurrentMonthEMI(r.dueDate));

  const totalPendingVisible = visibleRows.reduce(
    (sum, r) => sum + r.pending,
    0,
  );

  const totalToCollectNow = visibleRows.reduce(
    (sum, r) => sum + (Number.isFinite(r.collectNow) ? r.collectNow : 0),
    0,
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Collector info card */}
      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle>Collector Details</CardTitle>
        </CardHeader>
        <CardContent>
          {collectorLoading && (
            <p className="text-sm text-gray-500">
              Loading collector profile…
            </p>
          )}
          {collectorError && (
            <p className="text-sm text-red-600">{collectorError}</p>
          )}
          {!collectorLoading && collector && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 text-sm">
              <div>
                <span className="text-gray-500">Name:</span>{" "}
                <span className="font-semibold">{collector.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>{" "}
                <span className="font-semibold">{collector.email}</span>
              </div>
              {collector.phone && (
                <div>
                  <span className="text-gray-500">Phone:</span>{" "}
                  <span className="font-semibold">{collector.phone}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Role:</span>{" "}
                <span className="font-semibold capitalize">
                  {collector.role}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span
                  className={
                    collector.active
                      ? "text-green-600 font-semibold"
                      : "text-red-600 font-semibold"
                  }
                >
                  {collector.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <p className="text-sm text-gray-500 mb-1">Pending in view</p>
              <h3 className="text-2xl font-bold text-red-600">
                {fmtCurrency(totalPendingVisible)}
              </h3>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <p className="text-sm text-gray-500 mb-1">Planned to collect now</p>
              <h3 className="text-2xl font-bold text-blue-600">
                {fmtCurrency(totalToCollectNow)}
              </h3>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Collection Table */}
      <Card className="shadow-sm border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Loan EMI Collection Management</CardTitle>
          <Button
            onClick={loadPendingLoanEMIs}
            variant="outline"
            disabled={loading}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-center py-8 text-gray-500">
              Loading pending loan EMIs...
            </p>
          )}

          {errorText && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {errorText}
            </div>
          )}

          {!loading && visibleRows.length === 0 && (
            <p className="text-center py-8 text-gray-500">
              No pending loan EMIs found.
            </p>
          )}

          {!loading && visibleRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium">Member</th>
                    <th className="text-left p-3 font-medium">Loan</th>
                    <th className="text-left p-3 font-medium">EMI Month</th>
                    <th className="text-right p-3 font-medium">Expected</th>
                    <th className="text-right p-3 font-medium">Paid</th>
                    <th className="text-right p-3 font-medium">Pending</th>
                    <th className="text-center p-3 font-medium">Collect Now</th>
                    <th className="text-center p-3 font-medium">Mode</th>
                    <th className="text-center p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{displayMemberName(row)}</p>
                          <p className="text-xs text-gray-500">
                            Due: {formatDate(row.dueDate)}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{row.loanName}</p>
                        <p className="text-xs text-gray-500">
                          Status: {row.status}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {getMonthNameFromDueDate(row.dueDate)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">
                        {fmtCurrency(row.expected)}
                      </td>
                      <td className="p-3 text-right text-green-600">
                        {fmtCurrency(row.paid)}
                      </td>
                      <td className="p-3 text-right text-red-600 font-medium">
                        {fmtCurrency(row.pending)}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={row.collectNow}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, collectNow: val } : r,
                              ),
                            );
                          }}
                          className="w-24 text-center"
                          min="0"
                          max={row.pending}
                        />
                      </td>
                      <td className="p-3">
                        <Select
                          value={row.mode}
                          onValueChange={(val: Mode) => {
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, mode: val } : r,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">Cash</SelectItem>
                            <SelectItem value="UPI">UPI</SelectItem>
                            <SelectItem value="BANK">Bank</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          onClick={() => handleCollect(row)}
                          disabled={
                            !isCollectionAllowed(row.dueDate) ||
                            row.collectNow <= 0 || 
                            row.collectNow > row.pending
                          }
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          Collect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <AnimatePresence>
        {receiptRow && (
          <Dialog open={!!receiptRow} onOpenChange={() => setReceiptRow(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Collection Successful
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 p-4 rounded">
                  <p className="text-sm text-green-700">
                    <strong>Member:</strong> {displayMemberName(receiptRow)}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Loan:</strong> {receiptRow.loanName}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>EMI Month:</strong> {receiptRow.emiMonth}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Amount Collected:</strong> {fmtCurrency(receiptRow.collectNow)}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Mode:</strong> {receiptRow.mode}
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>Date:</strong> {new Date().toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Button
                  onClick={() => setReceiptRow(null)}
                  className="w-full"
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}