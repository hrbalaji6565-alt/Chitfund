"use client";

import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter, useParams } from "next/navigation";
import type { RootState } from "@/store/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import Button from "@/app/components/ui/button";
import { 
  ArrowLeft, 
  Calendar, 
  IndianRupee, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Smartphone,
  Banknote
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";

interface EMI {
  monthNumber: number;
  emiAmount: number;
  dueDate: string;
  penalty: number;
  paidAmount: number;
  status: string;
  isCurrentMonth?: boolean;
  isPastMonth?: boolean;
  isFutureMonth?: boolean;
  canPay?: boolean;
  paymentMode?: string;
  paymentDate?: string;
  transactionId?: string;
  utrNumber?: string;
}

interface LoanDetails {
  _id: string;
  memberName: string;
  principal: number;
  monthlyInterestPercent: number;
  durationMonths: number;
  startDate: string;
  emiAmount: number;
  schedule: EMI[];
}

export default function LoanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const loanId = params.loanId as string;

  const [loan, setLoan] = useState<LoanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<EMI | null>(null);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI">("UPI");
  const [utrNumber, setUtrNumber] = useState("");
  const [showQR, setShowQR] = useState(false);

  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (loanId) {
      fetchLoanDetails();
    }
  }, [loanId, token]);

  const fetchLoanDetails = async () => {
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/user/loans/${loanId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setLoan(data.loan);
      } else {
        setError(data.message || "Failed to fetch loan details");
      }
    } catch (err) {
      console.error("Error fetching loan details:", err);
      setError("Failed to load loan details");
    } finally {
      setLoading(false);
    }
  };

  const handlePayEMI = async (emi: EMI) => {
    if (!paymentMode) {
      toast.error("Please select a payment mode");
      return;
    }

    if (paymentMode === "UPI" && !utrNumber.trim()) {
      toast.error("Please enter UTR number for UPI payment");
      return;
    }

    try {
      setPaymentLoading(emi.monthNumber);

      const response = await fetch(`/api/user/loans/${loanId}/pay-emi`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          monthNumber: emi.monthNumber,
          paymentMode,
          amount: emi.emiAmount,
          utrNumber: paymentMode === "UPI" ? utrNumber : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("EMI payment recorded successfully!");
        
        // Close modal and reset form
        setShowPaymentModal(null);
        setUtrNumber("");
        setShowQR(false);
        
        // Refresh loan details to update EMI status immediately
        await fetchLoanDetails();
        
        // Show transaction details in success message
        if (data.transaction) {
          setTimeout(() => {
            toast.success(
              `Transaction created: ${data.transaction.loanName} - Month ${data.transaction.emiMonth}`,
              { duration: 4000 }
            );
          }, 1000);
        }
      } else {
        toast.error(data.message || "Failed to process payment");
      }
    } catch (err) {
      console.error("Error processing payment:", err);
      toast.error("Failed to process payment");
    } finally {
      setPaymentLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  const formatDate = (dateString: string | Date, fallbackLoan?: LoanDetails, monthNumber?: number) => {
    // First try to parse the provided date
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    
    // If date is valid, format it
    if (date && !isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    
    // If date is invalid and we have fallback data, calculate the due date
    if (fallbackLoan && monthNumber) {
      const startDate = new Date(fallbackLoan.startDate);
      if (!isNaN(startDate.getTime())) {
        // Calculate due date: startDate + monthNumber months
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + monthNumber);
        
        return dueDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    }
    
    // Fallback to "Date not available"
    return "Date not available";
  };

  const getEMIStatusColor = (emi: EMI) => {
    if (emi.status === "paid") return "bg-green-100 text-green-800";
    if (emi.isPastMonth && emi.status === "pending") return "bg-red-100 text-red-800";
    if (emi.isCurrentMonth) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  const getEMIStatusText = (emi: EMI) => {
    if (emi.status === "paid") return "Paid";
    if (emi.isPastMonth && emi.status === "pending") return "Overdue";
    if (emi.isCurrentMonth) return "Due Now";
    return "Upcoming";
  };

  const getEMIIcon = (emi: EMI) => {
    if (emi.status === "paid") return <CheckCircle size={16} className="text-green-600" />;
    if (emi.isPastMonth && emi.status === "pending") return <AlertCircle size={16} className="text-red-600" />;
    if (emi.isCurrentMonth) return <Clock size={16} className="text-blue-600" />;
    return <Calendar size={16} className="text-gray-400" />;
  };

  // Check if EMI payment is enabled based on current date vs due date
  const isPaymentEnabled = (emi: EMI) => {
    if (emi.status === "paid") return false;
    
    const currentDate = new Date();
    const dueDate = new Date(emi.dueDate);
    
    // Enable payment if current date >= due date
    return currentDate >= dueDate;
  };

  // Get helper text for disabled payment buttons
  const getPaymentHelperText = (emi: EMI) => {
    if (emi.status === "paid") return "";
    
    const currentDate = new Date();
    const dueDate = new Date(emi.dueDate);
    
    if (currentDate < dueDate) {
      return `Payment will be enabled on ${formatDate(emi.dueDate)}`;
    }
    
    return "";
  };

  // Generate UPI QR code data
  const generateUPIString = (emi: EMI) => {
    const upiId = process.env.NEXT_PUBLIC_DEFAULT_UPI || "7489988065@ibl";
    const payeeName = loan?.memberName || "Loan EMI";
    const amount = emi.emiAmount;
    const reference = `${loanId}-Month${emi.monthNumber}`;
    const note = `EMI Payment - Month ${emi.monthNumber}`;
    
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(reference)}`;
  };

  const generateQRCodeURL = (emi: EMI) => {
    const upiString = generateUPIString(emi);
    return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(upiString)}&chld=M|0`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading loan details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <CreditCard size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Loan</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{loan.memberName || "Personal Loan"}</h1>
          <p className="text-gray-600">Loan Details & EMI Schedule</p>
        </div>
      </div>

      {/* Loan Summary */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <IndianRupee size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Principal Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(loan.principal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">EMI Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(loan.emiAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="text-lg font-semibold">{loan.durationMonths} months</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="text-lg font-semibold">{formatDate(loan.startDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EMI Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>EMI Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loan.schedule.map((emi) => {
              const paymentEnabled = isPaymentEnabled(emi);
              const helperText = getPaymentHelperText(emi);
              
              return (
                <div
                  key={emi.monthNumber}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    {getEMIIcon(emi)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Month {emi.monthNumber}</p>
                        <Badge className={getEMIStatusColor(emi)}>
                          {getEMIStatusText(emi)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">Due: {formatDate(emi.dueDate, loan, emi.monthNumber)}</p>
                      {emi.status === "paid" && emi.paymentDate && (
                        <p className="text-sm text-green-600">
                          Paid on {formatDate(emi.paymentDate)}
                          {emi.paymentMode && ` via ${emi.paymentMode}`}
                          {emi.transactionId && ` (${emi.transactionId})`}
                        </p>
                      )}
                      {helperText && (
                        <p className="text-sm text-amber-600">{helperText}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(emi.emiAmount)}</p>
                      {emi.penalty > 0 && (
                        <p className="text-sm text-red-600">+₹{emi.penalty} penalty</p>
                      )}
                    </div>

                    {emi.status === "pending" && paymentEnabled && (
                      <Button
                        size="sm"
                        onClick={() => setShowPaymentModal(emi)}
                        disabled={paymentLoading === emi.monthNumber}
                        className="min-w-[80px]"
                      >
                        {paymentLoading === emi.monthNumber ? "Processing..." : "Pay EMI"}
                      </Button>
                    )}

                    {emi.status === "pending" && !paymentEnabled && (
                      <div className="min-w-[80px] flex justify-center">
                        <Button
                          size="sm"
                          disabled
                          className="min-w-[80px] opacity-50"
                        >
                          Pay EMI
                        </Button>
                      </div>
                    )}

                    {emi.status === "paid" && (
                      <div className="min-w-[80px] flex justify-center">
                        <Badge className="bg-green-100 text-green-800">
                          Paid
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              Pay EMI - Month {showPaymentModal.monthNumber}
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Amount to Pay</p>
                <p className="text-xl font-semibold">{formatCurrency(showPaymentModal.emiAmount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setPaymentMode("UPI");
                      setShowQR(false);
                    }}
                    className={`p-3 border rounded-lg flex items-center justify-center gap-2 ${
                      paymentMode === "UPI"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <Smartphone size={16} />
                    UPI
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMode("CASH");
                      setShowQR(false);
                    }}
                    className={`p-3 border rounded-lg flex items-center justify-center gap-2 ${
                      paymentMode === "CASH"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <Banknote size={16} />
                    Cash
                  </button>
                </div>
              </div>

              {paymentMode === "UPI" && (
                <>
                  <div>
                    <Button
                      onClick={() => setShowQR(!showQR)}
                      className="w-full mb-3"
                      variant="outline"
                    >
                      {showQR ? "Hide QR Code" : "Generate UPI QR Code"}
                    </Button>
                  </div>

                  {showQR && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="text-center mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Scan to Pay via UPI</p>
                        <Image
                          src={generateQRCodeURL(showPaymentModal)}
                          alt="UPI QR Code"
                          width={200}
                          height={200}
                          className="mx-auto rounded"
                        />
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p><strong>Amount:</strong> {formatCurrency(showPaymentModal.emiAmount)}</p>
                        <p><strong>Reference:</strong> {loanId}-Month{showPaymentModal.monthNumber}</p>
                        <p><strong>Note:</strong> EMI Payment - Month {showPaymentModal.monthNumber}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      UTR Number
                    </label>
                    <input
                      type="text"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="Enter UTR number after payment"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPaymentModal(null);
                    setUtrNumber("");
                    setShowQR(false);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePayEMI(showPaymentModal)}
                  disabled={paymentLoading === showPaymentModal.monthNumber}
                  className="flex-1"
                >
                  {paymentLoading === showPaymentModal.monthNumber ? "Processing..." : "Confirm Payment"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}