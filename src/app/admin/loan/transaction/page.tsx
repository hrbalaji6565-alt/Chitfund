"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import Button from "@/app/components/ui/button";

interface AdminLoanTransaction {
  _id: string;
  userName: string;
  userIdField: string;
  loanId: string;
  loanName: string;
  emiMonth: number;
  amount: number;
  paymentMethod?: string | null;
  status?: string | null;
  utr: string;
  date: string;
}

export default function AdminLoanTransactionPage() {
  const [transactions, setTransactions] = useState<AdminLoanTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/loan-transactions", {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        setError(data.message || "Failed to fetch transactions");
      }
    } catch (err) {
      console.error("Error fetching admin transactions:", err);
      setError("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    switch (normalized) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "failed") return "Rejected";
    if (s === "paid") return "Approved";
    if (s === "pending") return "Pending";
    return status || "Unknown";
  };

  const getPaymentMethodColor = (method: string) => {
    const normalized = String(method || "").toLowerCase();
    switch (normalized) {
      case "upi":
        return "bg-blue-100 text-blue-800";
      case "cash":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleDecision = async (transactionId: string, action: "approve" | "reject") => {
    try {
      setUpdatingId(transactionId);
      const res = await fetch("/api/admin/loan-transactions", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || "Failed to update transaction");
        return;
      }
      await fetchTransactions();
    } catch {
      setError("Failed to update transaction");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading transactions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Transactions</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchTransactions}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Transactions</h1>
        <p className="text-gray-600">Monitor all EMI payments made by users</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All EMI Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50">
                  <tr className="text-gray-600">
                    <th className="pb-3 pt-3 px-3 font-medium">User Name</th>
                    <th className="pb-3 pt-3 px-3 font-medium">User ID</th>
                    <th className="pb-3 pt-3 px-3 font-medium">Loan ID / Name</th>
                    <th className="pb-3 pt-3 px-3 font-medium">EMI Month</th>
                    <th className="pb-3 pt-3 px-3 font-medium">Amount</th>
                    <th className="pb-3 pt-3 px-3 font-medium">Payment Method</th>
                    <th className="pb-3 pt-3 px-3 font-medium">Status</th>
                    <th className="pb-3 pt-3 px-3 font-medium">UTR</th>
                    <th className="pb-3 pt-3 px-3 font-medium">Date</th>
                    <th className="pb-3 pt-3 px-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-3">
                        <div className="font-medium text-gray-900">
                          {transaction.userName}
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className="text-gray-600">
                          {transaction.userIdField}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {transaction.loanName}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {transaction.loanId}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className="text-gray-900">
                          Month {transaction.emiMonth}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <Badge className={getPaymentMethodColor(transaction.paymentMethod || "")}>
                          {transaction.paymentMethod || "UNKNOWN"}
                        </Badge>
                      </td>
                      <td className="py-4 px-3">
                        <Badge className={getStatusColor(transaction.status || "")}>
                          {getStatusLabel(transaction.status || "")}
                        </Badge>
                      </td>
                      <td className="py-4 px-3">
                        <span className="text-gray-600 text-sm">
                          {transaction.utr}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <span className="text-gray-600 text-sm">
                          {formatDate(transaction.date)}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        {String(transaction.status || "").toLowerCase() === "pending" ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={updatingId === transaction._id}
                              onClick={() => void handleDecision(transaction._id, "approve")}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={updatingId === transaction._id}
                              onClick={() => void handleDecision(transaction._id, "reject")}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
