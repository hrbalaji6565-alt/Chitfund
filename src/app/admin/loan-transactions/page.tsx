"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";

type PaymentRow = {
  _id: string;
  loanId: string;
  memberId: string;
  monthIndex: number;
  totalDue: number;
  paidAmount: number;
  status: string;
  source: string;
  utr?: string;
  createdAt: string;
};

export default function AdminLoanTransactionsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/loans/payments", {
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) return;
    setRows(data.payments as PaymentRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Loan Transactions
        </h1>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">
            All loan payments
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-2 text-left">Member</th>
                <th className="py-2 px-2 text-left">Loan</th>
                <th className="py-2 px-2 text-left">Month</th>
                <th className="py-2 px-2 text-left">Total Due</th>
                <th className="py-2 px-2 text-left">Paid</th>
                <th className="py-2 px-2 text-left">Status</th>
                <th className="py-2 px-2 text-left">Source</th>
                <th className="py-2 px-2 text-left">UTR</th>
                <th className="py-2 px-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 px-2">{r.memberId}</td>
                  <td className="py-2 px-2">{r.loanId}</td>
                  <td className="py-2 px-2">
                    #{r.monthIndex}
                  </td>
                  <td className="py-2 px-2">
                    ₹{(r.totalDue ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-2 px-2">
                    ₹{(r.paidAmount ?? 0).toLocaleString(
                      "en-IN",
                    )}
                  </td>
                  <td className="py-2 px-2">{r.status}</td>
                  <td className="py-2 px-2">{r.source}</td>
                  <td className="py-2 px-2">
                    {r.utr ?? "-"}
                  </td>
                  <td className="py-2 px-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-3 text-center text-xs text-gray-500"
                  >
                    No payments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
