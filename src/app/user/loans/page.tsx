"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import toast from "react-hot-toast";

type Payment = {
  _id: string;
  monthIndex: number;
  dueDate: string;
  status: string;
  currentPenalty: number;
  currentTotalDue: number;
  utr?: string;
};

type Loan = {
  _id: string;
  principal: number;
  monthlyInterestRate: number;
  tenureMonths: number;
  penaltyRate: number;
  installmentAmount: number;
  nextDue: Payment | null;
  payments: Payment[];
};

const keyFor = (loanId: string, monthIndex: number) =>
  `${loanId}_${monthIndex}`;

export default function UserLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [utrByKey, setUtrByKey] = useState<Record<string, string>>({});
  const [payLoading, setPayLoading] = useState<Record<string, boolean>>({});

  const load = async () => {
    const res = await fetch("/api/loans/user", {
      credentials: "include",
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(data.error || "Failed to load loans");
      return;
    }
    setLoans(
      (data.loans as Loan[]).map((ln) => ({
        ...ln,
        payments: ln.payments.map((p) => ({
          ...p,
          dueDate: new Date(p.dueDate).toISOString(),
        })),
        nextDue: ln.nextDue
          ? {
              ...ln.nextDue,
              dueDate: new Date(ln.nextDue.dueDate).toISOString(),
            }
          : null,
      })),
    );
  };

  useEffect(() => {
    load();
  }, []);

  const handlePay = async (loanId: string, monthIndex: number) => {
    const key = keyFor(loanId, monthIndex);
    const utr = (utrByKey[key] ?? "").trim();
    if (!utr) {
      toast.error("Enter UTR first");
      return;
    }
    setPayLoading((prev) => ({ ...prev, [key]: true }));
    const res = await fetch("/api/loans/pay", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanId, monthIndex, utr, method: "upi" }),
    });
    const data = await res.json();
    setPayLoading((prev) => ({ ...prev, [key]: false }));
    if (!data.success) {
      toast.error(data.error || "Failed to submit payment");
      return;
    }
    toast.success("Payment submitted");
    load();
  };

  const fmtCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold">My Loans</h1>

      {loans.map((loan) => {
        const nextDue = loan.nextDue;
        const nextMonthIndex = nextDue?.monthIndex ?? 0;
        const nextKey =
          nextDue && nextMonthIndex > 0
            ? keyFor(loan._id, nextMonthIndex)
            : "";

        return (
          <Card key={loan._id} className="shadow-sm border">
            <CardHeader>
              <CardTitle className="text-lg">
                Principal: {fmtCurrency(loan.principal)} • EMI:{" "}
                {fmtCurrency(loan.installmentAmount)} • Tenure:{" "}
                {loan.tenureMonths} months
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div>
                  Interest / month:{" "}
                  <span className="font-semibold">
                    {loan.monthlyInterestRate}%
                  </span>{" "}
                  • Penalty / month on EMI:{" "}
                  <span className="font-semibold">
                    {loan.penaltyRate}%
                  </span>
                </div>
                {nextDue && (
                  <div className="mt-1">
                    Next EMI:{" "}
                    <span className="font-semibold">
                      {fmtCurrency(loan.installmentAmount)}
                    </span>{" "}
                    + penalty:{" "}
                    <span className="font-semibold text-red-600">
                      {fmtCurrency(nextDue.currentPenalty)}
                    </span>{" "}
                    ={" "}
                    <span className="font-semibold">
                      {fmtCurrency(nextDue.currentTotalDue)}
                    </span>{" "}
                    (Month #{nextDue.monthIndex})
                  </div>
                )}
              </div>

              {nextDue && nextMonthIndex > 0 && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="text-xs text-gray-600 mb-1">
                    Pay current EMI (QR scan ke baad UTR daalo)
                  </div>
                  {/* QR section payment provider se integrate karo */} 
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <Input
                      placeholder="Enter UTR"
                      className="h-9 w-64"
                      value={utrByKey[nextKey] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const key = keyFor(loan._id, nextMonthIndex);
                        setUtrByKey((prev) => ({
                          ...prev,
                          [key]: v,
                        }));
                      }}
                    />
                    <Button
                      className="h-9 rounded-xl"
                      onClick={() => handlePay(loan._id, nextMonthIndex)}
                      disabled={payLoading[nextKey] === true}
                    >
                      {payLoading[nextKey] ? "Submitting…" : "Submit UTR"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <div className="font-medium mb-1">All EMIs</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-1 px-2 text-left">Month</th>
                        <th className="py-1 px-2 text-left">Due Date</th>
                        <th className="py-1 px-2 text-left">
                          Total (current)
                        </th>
                        <th className="py-1 px-2 text-left">Status</th>
                        <th className="py-1 px-2 text-left">UTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.payments.map((p) => {
                        const due = new Date(p.dueDate);
                        return (
                          <tr key={p._id} className="border-t">
                            <td className="py-1 px-2">#{p.monthIndex}</td>
                            <td className="py-1 px-2">
                              {due.toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-1 px-2">
                              {fmtCurrency(p.currentTotalDue)}
                            </td>
                            <td className="py-1 px-2">{p.status}</td>
                            <td className="py-1 px-2">
                              {p.utr ?? "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {loan.payments.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-2 text-center text-xs text-gray-500"
                          >
                            No EMI rows.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
