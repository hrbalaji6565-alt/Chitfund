"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import type { RootState } from "@/store/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import Button from "@/app/components/ui/button";
import { CreditCard, Calendar, IndianRupee, ArrowRight } from "lucide-react";

interface Loan {
  _id: string;
  loanName: string;
  principal: number;
  emiAmount: number;
  status: string;
  startDate: string;
  durationMonths: number;
}

export default function LoansPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { member, token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    fetchLoans();
  }, [token]);

  const fetchLoans = async () => {
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/user/loans", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setLoans(data.loans || []);
      } else {
        setError(data.message || "Failed to fetch loans");
      }
    } catch (err) {
      console.error("Error fetching loans:", err);
      setError("Failed to load loans");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Date not available";
    }
    
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "active":
        return "bg-blue-100 text-blue-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleLoanClick = (loanId: string) => {
    router.push(`/user/loan/${loanId}`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your loans...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <CreditCard size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Loans</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchLoans} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Loans</h1>
        <p className="text-gray-600">Manage your loan accounts and EMI payments</p>
      </div>

      {loans.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <CreditCard size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Loans Found</h3>
          <p className="text-gray-600">You don't have any loans assigned to your account.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loans.map((loan) => (
            <Card 
              key={loan._id} 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={() => handleLoanClick(loan._id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {loan.loanName}
                  </CardTitle>
                  <Badge className={getStatusColor(loan.status)}>
                    {loan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <IndianRupee size={14} className="mr-1" />
                      Principal
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(loan.principal)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <CreditCard size={14} className="mr-1" />
                      EMI Amount
                    </div>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(loan.emiAmount)}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center text-sm text-gray-600 mb-1">
                    <Calendar size={14} className="mr-1" />
                    Start Date
                  </div>
                  <p className="text-sm text-gray-900">
                    {formatDate(loan.startDate)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-gray-600">
                    {loan.durationMonths} months tenure
                  </span>
                  <ArrowRight size={16} className="text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}