"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/app/components/ui/button";

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
  schedule: Array<{
    monthNumber: number;
    emiAmount: number;
    penalty?: number;
    status?: string;
    dueDate?: string;
  }>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function LoanListPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  
  const ITEMS_PER_PAGE = 20;

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/loan/list", {
        credentials: "include",
      });
      const data = await res.json();
      
      if (data.success) {
        setLoans(data.loans || []);
      } else {
        setError(data.message || "Failed to load loans");
      }
    } catch (err) {
      console.error("Error fetching loans:", err);
      setError("Error loading loans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
    
    // Listen for loan creation events
    const handleLoanCreated = () => {
      fetchLoans();
    };
    
    window.addEventListener("loanCreated", handleLoanCreated);
    
    return () => {
      window.removeEventListener("loanCreated", handleLoanCreated);
    };
  }, [fetchLoans]);

  // Memoized filtered and paginated loans
  const filteredLoans = useMemo(() => {
    if (!searchTerm) return loans;
    
    const term = searchTerm.toLowerCase();
    return loans.filter(loan => 
      loan.memberName?.toLowerCase().includes(term) ||
      loan.memberUserId?.toLowerCase().includes(term) ||
      loan.memberMobile?.includes(term)
    );
  }, [loans, searchTerm]);

  const paginatedLoans = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLoans.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLoans, currentPage, ITEMS_PER_PAGE]);

  const totalPages = Math.ceil(filteredLoans.length / ITEMS_PER_PAGE);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatCurrency = (amount: number | undefined | null | string) => {
    if (amount === undefined || amount === null || amount === "") {
      return "₹0.00";
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || !isFinite(numAmount)) {
      return "₹0.00";
    }
    return `₹${numAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null | undefined) => {
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
  };

  const getStatusBadge = useCallback((loan: Loan) => {
    const schedule = loan.schedule || [];
    if (schedule.length === 0) {
      return <Badge className="bg-blue-600 text-white">Active</Badge>;
    }
    
    const paidCount = schedule.filter((s) => s.status === "paid").length;
    const totalCount = schedule.length;
    
    if (paidCount === totalCount) {
      return <Badge className="bg-green-600 text-white">Completed</Badge>;
    } else if (paidCount > 0) {
      return <Badge className="bg-yellow-600 text-white">In Progress</Badge>;
    } else {
      return <Badge className="bg-blue-600 text-white">Active</Badge>;
    }
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Loan List</h2>
        </div>
        <div className="text-center py-8 text-[var(--text-secondary)]">Loading loans...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Loan List</h2>
        <Button
          onClick={fetchLoans}
          variant="outline"
          className="flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by name, user ID, or mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="text-sm text-gray-600">
          Showing {paginatedLoans.length} of {filteredLoans.length} loans
          {searchTerm && ` (filtered from ${loans.length} total)`}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Card className="border-0 shadow-lg bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardHeader>
          <CardTitle>All Loans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[var(--bg-highlight)] to-[var(--bg-highlight)] text-[var(--text-primary)]">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Member Name</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Loan Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">EMI Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Duration</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Loan Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Next EMI Due</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLoans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--text-secondary)]">
                      {searchTerm ? "No loans match your search." : "No loans found."}
                    </td>
                  </tr>
                ) : (
                  paginatedLoans.map((loan) => {
                    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                      // Prevent navigation if clicking on interactive elements
                      const target = e.target as HTMLElement;
                      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
                        return;
                      }
                      
                      const loanId = String(loan._id || '');
                      if (loanId) {
                        router.push(`/admin/loan/profile/${loanId}`);
                      }
                    };

                    return (
                      <tr
                        key={loan._id}
                        onClick={handleRowClick}
                        className="border-b hover:bg-[var(--bg-highlight)] transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          <div>
                            <p className="font-medium">{loan.memberName}</p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {loan.memberMobile || loan.memberUserId}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm">{formatCurrency(loan.principal)}</td>
                        <td className="py-4 px-6 text-sm">{formatCurrency(loan.emiAmount)}</td>
                        <td className="py-4 px-6 text-sm">
                          {loan.durationType === "DAYS" 
                            ? `${loan.durationValue || loan.durationMonths} days`
                            : `${loan.durationValue || loan.durationMonths} months`
                          }
                        </td>
                        <td className="py-4 px-6 text-sm">{formatDate(loan.startDate)}</td>
                        <td className="py-4 px-6 text-sm">{formatDate(loan.nextEMIDueDate)}</td>
                        <td className="py-4 px-6">{getStatusBadge(loan)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              variant="outline"
              size="sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

