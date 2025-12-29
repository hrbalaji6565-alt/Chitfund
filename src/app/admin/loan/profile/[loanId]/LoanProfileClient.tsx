"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
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

export default function LoanProfileClient({ loan }: LoanProfileClientProps) {
  const router = useRouter();

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

  const getStatusBadge = useMemo(
    () => (status: string) => {
      switch (status) {
        case "completed":
          return <Badge className="bg-green-600 text-white">Completed</Badge>;
        case "in_progress":
          return <Badge className="bg-yellow-600 text-white">In Progress</Badge>;
        default:
          return <Badge className="bg-blue-600 text-white">Active</Badge>;
      }
    },
    []
  );

  const getEMIStatusBadge = useMemo(
    () => (status: "paid" | "pending") => {
      if (status === "paid") {
        return (
          <Badge className="bg-green-600 text-white">
            <CheckCircle className="w-3 h-3 mr-1 inline" />
            Paid
          </Badge>
        );
      } else {
        return (
          <Badge className="bg-yellow-600 text-white">
            <XCircle className="w-3 h-3 mr-1 inline" />
            Pending
          </Badge>
        );
      }
    },
    []
  );

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
      <div>
        <Button
          onClick={() => router.push("/admin/loan/list")}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Loan List
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
                </tr>
              </thead>
              <tbody>
                {loan.schedule.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[var(--text-secondary)]">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

