"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";

interface LoanTransaction {
  _id: string;
  loan: string;
  month: number;
  total: number;
  paid: number;
  status: string;
  utr: string;
  date: string;
  paymentMethod: string;
}

export default function LoanTransactionsPage() {
  const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  const fetchTransactions = async () => {
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/user/loan-transactions", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        setError(data.message || "Failed to fetch transactions");
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
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
    switch (status.toLowerCase()) {
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
    return status.toLowerCase() === "failed" ? "Rejected" : status;
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
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Loan Transactions</h1>
        <p className="text-gray-600">Track your EMI payments and transaction history</p>
      </div>

      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">My EMI payments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No transactions yet.</p>
            </div>
          ) : (
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
                {transactions.map((transaction) => (
                  <tr key={transaction._id} className="border-t hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div className="font-medium text-gray-900">
                        {transaction.loan}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-gray-900">
                        Month {transaction.month}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className="font-medium text-gray-900">
                        {formatCurrency(transaction.total)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className="font-medium text-green-600">
                        {formatCurrency(transaction.paid)}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <Badge className={getStatusColor(transaction.status)}>
                        {getStatusLabel(transaction.status)}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-gray-600 text-sm">
                        {transaction.utr}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-gray-600 text-sm">
                        {formatDate(transaction.date)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
