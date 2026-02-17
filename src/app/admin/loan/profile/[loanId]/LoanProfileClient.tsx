"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, Trash2 } from "lucide-react";
import Button from "@/app/components/ui/button";

type EMIScheduleItem = {
  monthNumber: number;
  monthName: string;
  dueDate: string | null;
  emiAmount: number;
  penalty: number;
  totalDue: number;
  paidAmount: number;
  status: "paid" | "pending";
  paymentDate: string | null;
};

type Loan = {
  _id: string;
  memberId: string;
  memberName: string;
  memberUserId: string;
  memberMobile: string;
  principal: number;
  monthlyInterestPercent: number;
  durationMonths: number;
  durationType?: "MONTHS" | "DAYS";
  durationValue?: number;
  startDate: string;
  nextEMIDueDate: string | null;
  emiAmount: number;
  schedule: EMIScheduleItem[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

type LoanProfileClientProps = {
  loan: Loan;
};

type CollectModalState = {
  emi: EMIScheduleItem;
  mode: "CASH" | "UPI";
  amount: string;
  utrNumber: string;
  error: string;
};

export default function LoanProfileClient({ loan }: LoanProfileClientProps) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState(false);
  const [collectingMonth, setCollectingMonth] = React.useState<number | null>(null);
  const [collectModal, setCollectModal] = React.useState<CollectModalState | null>(null);

  const handleDeleteLoan = async () => {
    const ok = window.confirm("Delete this loan? This will also remove linked loan transactions.");
    if (!ok) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/loan/${encodeURIComponent(loan._id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.message || "Failed to delete loan");
        return;
      }
      router.push("/admin/loan/list");
    } catch {
      alert("Failed to delete loan");
    } finally {
      setDeleting(false);
    }
  };

  const openCollectModal = (emi: EMIScheduleItem, mode: "CASH" | "UPI") => {
    const pending = Math.max(0, Number(emi.totalDue || 0) - Number(emi.paidAmount || 0));
    if (pending <= 0) {
      return;
    }
    setCollectModal({
      emi,
      mode,
      amount: String(pending),
      utrNumber: "",
      error: "",
    });
  };

  const handleCollectEmi = async () => {
    if (!collectModal) return;
    const emi = collectModal.emi;
    const mode = collectModal.mode;
    const pending = Math.max(0, Number(emi.totalDue || 0) - Number(emi.paidAmount || 0));
    const amount = Number(collectModal.amount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > pending) {
      setCollectModal((prev) => (prev ? { ...prev, error: "Invalid amount." } : prev));
      return;
    }

    if (mode === "UPI") {
      if (!collectModal.utrNumber.trim()) {
        setCollectModal((prev) =>
          prev ? { ...prev, error: "UTR number is required for UPI." } : prev
        );
        return;
      }
    }

    try {
      setCollectingMonth(emi.monthNumber);
      const res = await fetch("/api/admin/loan/emi/mark-paid", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loan._id,
          monthNumber: emi.monthNumber,
          amount,
          paymentMode: mode,
          utrNumber: collectModal.utrNumber.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setCollectModal((prev) =>
          prev ? { ...prev, error: data?.message || "Failed to collect EMI" } : prev
        );
        return;
      }
      setCollectModal(null);
      router.refresh();
    } catch {
      setCollectModal((prev) => (prev ? { ...prev, error: "Failed to collect EMI" } : prev));
    } finally {
      setCollectingMonth(null);
    }
  };

  // Memoize formatting functions to prevent recreation on every render
  const formatCurrency = useMemo(
    () => (amount: number | undefined | null | string) => {
      if (amount === undefined || amount === null || amount === "") {
        return "₹0.00";
      }
      const numAmount = Number(amount);
      if (isNaN(numAmount) || !isFinite(numAmount)) {
        return "₹0.00";
      }
      return `₹${numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    []
  );

  const formatDate = useMemo(
    () => (dateString: string | null | undefined) => {
      if (!dateString) return "—";
      try {
        return new Date(dateString).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch {
        return "—";
      }
    },
    []
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-600 text-white">In Progress</Badge>;
      default:
        return <Badge className="bg-blue-600 text-white">Active</Badge>;
    }
  };

  const getEMIStatusBadge = (status: "paid" | "pending") => {
    if (status === "paid") {
      return (
        <Badge className="bg-green-600 text-white">
          <CheckCircle className="w-3 h-3 mr-1 inline" />
          Paid
        </Badge>
      );
    }
    return (
      <Badge className="bg-yellow-600 text-white">
        <XCircle className="w-3 h-3 mr-1 inline" />
        Pending
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <button
          onClick={() => router.push("/admin/loan/list")}
          className="hover:text-[var(--color-primary)] transition-colors"
        >
          Loan List
        </button>
        <span>/</span>
        <span className="text-[var(--text-primary)]">Loan Profile</span>
      </div>

      {/* Back Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => router.push("/admin/loan/list")}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Loan List
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleDeleteLoan}
          disabled={deleting}
          className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? "Deleting..." : "Delete Loan"}
        </Button>
      </div>

      {/* Loan Details Card */}
      <Card className="border-0 shadow-lg bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Member Name</p>
              <p className="font-semibold text-lg">{loan.memberName}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {loan.memberMobile || loan.memberUserId}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Status</p>
              <div className="mt-1">{getStatusBadge(loan.status)}</div>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Loan Amount</p>
              <p className="font-semibold text-lg">{formatCurrency(loan.principal)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">EMI Amount</p>
              <p className="font-semibold text-lg">{formatCurrency(loan.emiAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Duration</p>
              <p className="font-semibold">
                {loan.durationType === "DAYS" 
                  ? `${loan.durationValue || loan.durationMonths} days`
                  : `${loan.durationValue || loan.durationMonths} months`
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Interest Rate</p>
              <p className="font-semibold">{loan.monthlyInterestPercent}% per month</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Loan Start Date</p>
              <p className="font-semibold">{formatDate(loan.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">Next EMI Due Date</p>
              <p className="font-semibold">{formatDate(loan.nextEMIDueDate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EMI Schedule Card */}
      <Card className="border-0 shadow-lg bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardHeader>
          <CardTitle>EMI Installment Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[var(--bg-highlight)] to-[var(--bg-highlight)] text-[var(--text-primary)]">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Month</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Due Date</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">EMI Amount</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">Penalty</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">Total Due</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">Paid Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Payment Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Collect</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[var(--text-secondary)]">
                      No EMI schedule found.
                    </td>
                  </tr>
                ) : (
                  loan.schedule.map((emi) => (
                    <tr
                      key={`${emi.monthNumber}-${emi.dueDate}`}
                      className="border-b hover:bg-[var(--bg-highlight)] transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium">{emi.monthName}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            EMI #{emi.monthNumber}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm">{formatDate(emi.dueDate)}</td>
                      <td className="py-4 px-6 text-sm text-right">
                        {formatCurrency(emi.emiAmount)}
                      </td>
                      <td className="py-4 px-6 text-sm text-right">
                        {emi.penalty > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {formatCurrency(emi.penalty)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)]">₹0.00</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-right font-semibold">
                        {formatCurrency(emi.totalDue)}
                      </td>
                      <td className="py-4 px-6 text-sm text-right">
                        {formatCurrency(emi.paidAmount)}
                      </td>
                      <td className="py-4 px-6 text-sm">
                        {emi.paymentDate ? formatDate(emi.paymentDate) : "—"}
                      </td>
                      <td className="py-4 px-6">{getEMIStatusBadge(emi.status)}</td>
                      <td className="py-4 px-6">
                        {emi.status === "paid" ? (
                          <span className="text-xs text-gray-500">Completed</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={collectingMonth === emi.monthNumber}
                              onClick={() => openCollectModal(emi, "CASH")}
                            >
                              Cash
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={collectingMonth === emi.monthNumber}
                              onClick={() => openCollectModal(emi, "UPI")}
                            >
                              UPI
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {collectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Collect EMI</h3>
            <p className="text-sm text-gray-600 mb-4">
              EMI #{collectModal.emi.monthNumber} via {collectModal.mode}
            </p>

            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Pending:{" "}
                <span className="font-semibold">
                  {formatCurrency(
                    Math.max(
                      0,
                      Number(collectModal.emi.totalDue || 0) - Number(collectModal.emi.paidAmount || 0)
                    )
                  )}
                </span>
              </div>

              <div>
                <label className="text-sm text-gray-700 block mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectModal.amount}
                  onChange={(e) =>
                    setCollectModal((prev) => (prev ? { ...prev, amount: e.target.value, error: "" } : prev))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {collectModal.mode === "UPI" && (
                <div>
                  <label className="text-sm text-gray-700 block mb-1">UTR Number</label>
                  <input
                    type="text"
                    value={collectModal.utrNumber}
                    onChange={(e) =>
                      setCollectModal((prev) =>
                        prev ? { ...prev, utrNumber: e.target.value, error: "" } : prev
                      )
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Enter UTR number"
                  />
                </div>
              )}

              {collectModal.error && (
                <p className="text-sm text-red-600">{collectModal.error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCollectModal(null)}
                disabled={collectingMonth === collectModal.emi.monthNumber}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleCollectEmi()}
                disabled={collectingMonth === collectModal.emi.monthNumber}
              >
                {collectingMonth === collectModal.emi.monthNumber ? "Collecting..." : "Collect"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

