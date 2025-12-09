"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

type Row = {
  _id: string;
  loanId: string;
  monthIndex: number;
  totalDue: number;
  paidAmount: number;
  status: string;
  utr?: string;
  createdAt: string;
};

export default function UserLoanTransactionsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    // reuse same admin endpoint but ideally a user-specific one bana sakte ho
    const res = await fetch("/api/loans/user", {
      credentials: "include",
    });
    const data = await res.json();
    if (!data.success) return;
    const out: Row[] = [];
    for (const ln of data.loans as any[]) {
      for (const p of ln.payments as any[]) {
        if (p.status === "approved" || p.status === "submitted") {
          out.push({
            _id: p._id,
            loanId: ln._id,
            monthIndex: p.monthIndex,
            totalDue: p.currentTotalDue,
            paidAmount: p.paidAmount ?? 0,
            status: p.status,
            utr: p.utr,
            createdAt: p.createdAt ?? p.dueDate,
          });
        }
      }
    }
    out.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
    setRows(out);
  };

  useEffect(() => {
    load();
  }, []);

  const fmtCurrency = (n: number) =>
    `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">
        Loan Transactions
      </h1>

      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">
            My EMI payments
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-2 text-left">Loan</th>
                <th className="py-2 px-2 text-left">Month</th>
                <th className="py-2 px-2 text-left">Total</th>
                <th className="py-2 px-2 text-left">Paid</th>
                <th className="py-2 px-2 text-left">Status</th>
                <th className="py-2 px-2 text-left">UTR</th>
                <th className="py-2 px-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 px-2">{r.loanId}</td>
                  <td className="py-2 px-2">#{r.monthIndex}</td>
                  <td className="py-2 px-2">
                    {fmtCurrency(r.totalDue)}
                  </td>
                  <td className="py-2 px-2">
                    {fmtCurrency(r.paidAmount)}
                  </td>
                  <td className="py-2 px-2">{r.status}</td>
                  <td className="py-2 px-2">
                    {r.utr ?? "-"}
                  </td>
                  <td className="py-2 px-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-3 text-center text-xs text-gray-500"
                  >
                    No transactions yet.
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
