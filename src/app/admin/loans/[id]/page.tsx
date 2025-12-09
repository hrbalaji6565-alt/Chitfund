// src/app/admin/loans/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import toast from "react-hot-toast";

type Loan = {
  _id: string;
  memberId: string;
  principal: number;
  monthlyInterestRate: number;
  tenureMonths: number;
  dueDayOfMonth: number;
  penaltyRate: number;
  installmentAmount: number;
  status: string;
  startDate?: string;
};

type Payment = {
  _id: string;
  monthIndex: number;
  dueDate: string;
  baseAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  totalDue: number;
  paidAmount: number;
  paidAt?: string;
  utr?: string;
  method?: string;
  status: string;
  source: string;
};

type ScheduleItem = {
  monthIndex: number;
  dueDate: string;
  baseAmount: number;
  interestAmount: number;
  emiAmount: number;
};

const fmtCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function LoanDetailsAdminPage() {
  const params = useParams();
  const loanId = String(params.id);

  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/loans/${loanId}`, {
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);

    if (!data.success) {
      toast.error(data.error ?? "Failed to load loan");
      return;
    }

    setLoan(data.loan as Loan);
    setPayments(data.payments as Payment[]);
    setSchedule(data.schedule as ScheduleItem[]);
  };

  const approvePayment = async (p: Payment, approve: boolean) => {
    const res = await fetch("/api/admin/loans/payments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: p._id, approve }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(data.error ?? "Failed to update");
      return;
    }
    toast.success(approve ? "Approved" : "Rejected");
    load();
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId]);

  if (loading && !loan) {
    return <p className="p-4 text-sm">Loading…</p>;
  }

  if (!loan) {
    return <p className="p-4 text-sm">Loan not found.</p>;
  }

  const totalInterest = schedule.reduce(
    (sum, s) => sum + s.interestAmount,
    0,
  );
  const totalPayable = loan.principal + totalInterest;
  const firstDue = schedule[0]
    ? new Date(schedule[0].dueDate)
    : undefined;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Overview card with slight animation */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="shadow-lg border-0 hover:shadow-xl transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="text-lg">
              Loan Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="font-medium">Member ID:</span>{" "}
                {loan.memberId}
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                {loan.status}
              </div>
              <div>
                <span className="font-medium">Principal:</span>{" "}
                {fmtCurrency(loan.principal)}
              </div>
              <div>
                <span className="font-medium">Interest / month:</span>{" "}
                {loan.monthlyInterestRate}%
              </div>
              <div>
                <span className="font-medium">Tenure:</span>{" "}
                {loan.tenureMonths} months
              </div>
              <div>
                <span className="font-medium">EMI (fixed):</span>{" "}
                {fmtCurrency(loan.installmentAmount)}
              </div>
              <div>
                <span className="font-medium">
                  Penalty / month on EMI:
                </span>{" "}
                {loan.penaltyRate}%
              </div>
              <div>
                <span className="font-medium">First due date:</span>{" "}
                {firstDue
                  ? firstDue.toLocaleDateString("en-IN")
                  : "-"}
              </div>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-slate-50 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                Pay this EMI on or before{" "}
                <span className="font-semibold">
                  day {loan.dueDayOfMonth} of every month
                </span>{" "}
                to avoid penalty.
              </div>
              <div className="text-right">
                <div>
                  <span className="font-medium">Total interest:</span>{" "}
                  {fmtCurrency(totalInterest)}
                </div>
                <div>
                  <span className="font-medium">Total payable:</span>{" "}
                  {fmtCurrency(totalPayable)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Schedule + transactions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg">
              Installment Schedule & Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-2 text-left">Month</th>
                  <th className="py-2 px-2 text-left">Due Date</th>
                  <th className="py-2 px-2 text-left">Base</th>
                  <th className="py-2 px-2 text-left">Interest</th>
                  <th className="py-2 px-2 text-left">EMI</th>
                  <th className="py-2 px-2 text-left">Paid</th>
                  <th className="py-2 px-2 text-left">Status</th>
                  <th className="py-2 px-2 text-left">UTR</th>
                  <th className="py-2 px-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s) => {
                  const p = payments.find(
                    (pp) => pp.monthIndex === s.monthIndex,
                  );
                  const dueDate = new Date(s.dueDate);

                  return (
                    <tr
                      key={s.monthIndex}
                      className="border-t hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2 px-2">#{s.monthIndex}</td>
                      <td className="py-2 px-2">
                        {dueDate.toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-2 px-2">
                        {fmtCurrency(s.baseAmount)}
                      </td>
                      <td className="py-2 px-2">
                        {fmtCurrency(s.interestAmount)}
                      </td>
                      <td className="py-2 px-2">
                        {fmtCurrency(s.emiAmount)}
                      </td>
                      <td className="py-2 px-2">
                        {p?.paidAmount
                          ? fmtCurrency(p.paidAmount)
                          : "-"}
                      </td>
                      <td className="py-2 px-2">
                        {p?.status ?? "pending"}
                      </td>
                      <td className="py-2 px-2">
                        {p?.utr ?? "-"}
                      </td>
                      <td className="py-2 px-2">
                        {p && p.status !== "approved" && (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              className="rounded-xl bg-green-600 hover:bg-green-700"
                              onClick={() => approvePayment(p, true)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-xl bg-red-600 hover:bg-red-700"
                              onClick={() => approvePayment(p, false)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {schedule.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-3 text-center text-xs text-gray-500"
                    >
                      No schedule.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
