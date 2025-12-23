import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import Payment from "@/app/models/Payment";
import { verifyToken } from "@/app/lib/jwt";
import mongoose from "mongoose";
import LoanProfileClient from "./LoanProfileClient";

async function getLoanData(loanId: string) {
  await dbConnect();

  if (!mongoose.Types.ObjectId.isValid(loanId)) {
    return null;
  }

  // Fetch loan with member details - optimized query
  const loan = await Loan.findById(loanId)
    .populate("userId", "name userId mobile")
    .lean();

  if (!loan) {
    return null;
  }

  // Get member ID efficiently
  const memberId = (loan as any).userId?._id || (loan as any).userId;
  if (!memberId) {
    return null;
  }

  // Fetch only relevant payments - optimized query with projection
  const allPayments = await Payment.find({
    memberId: memberId,
    status: { $in: ["approved", "submitted"] },
  })
    .select("allocated approvedAt createdAt")
    .lean();

  // Process EMI schedule with payment tracking and penalty calculation
  const schedule = (loan as any).schedule || [];
  const now = new Date();
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Pre-create month names array
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Create a map of payments by loanId and monthNumber for O(1) lookup
  const paymentMap = new Map<string, { amount: number; date: string | null }>();
  for (const payment of allPayments) {
    const allocated = (payment as any).allocated || [];
    for (const allocation of allocated) {
      // Compare loanId as strings to handle ObjectId comparison
      const allocationLoanId = String(allocation.loanId || "");
      if (allocationLoanId === loanId && allocation.monthNumber) {
        const key = `${allocation.monthNumber}`;
        const existing = paymentMap.get(key) || { amount: 0, date: null };
        // Serialize date to ISO string if it exists
        const paymentDate = (payment as any).approvedAt || (payment as any).createdAt;
        const serializedDate = paymentDate 
          ? (paymentDate instanceof Date ? paymentDate.toISOString() : String(paymentDate))
          : null;
        paymentMap.set(key, {
          amount: existing.amount + (allocation.amount || 0),
          date: existing.date || serializedDate,
        });
      }
    }
  }

  const processedSchedule = schedule.map((emi: any) => {
    // Safely parse dueDate
    const rawDueDate = emi.dueDate;
    let dueDate: Date | null = null;
    if (rawDueDate) {
      const d = new Date(rawDueDate);
      if (!isNaN(d.getTime())) {
        dueDate = d;
      }
    }
    
    // Calculate overdue status only if dueDate is valid
    let isOverdue = false;
    if (dueDate) {
      const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      isOverdue = dueDateStart < nowStart;
    }
    
    // Get payment info from map
    const paymentInfo = paymentMap.get(String(emi.monthNumber)) || { amount: 0, date: null };
    const paidAmount = (emi.paidAmount || 0) + paymentInfo.amount;
    // Serialize payment date to string if it exists
    const paymentDate = paymentInfo.date 
      ? (typeof paymentInfo.date === 'object' && paymentInfo.date instanceof Date ? paymentInfo.date.toISOString() : String(paymentInfo.date))
      : null;
    
    // Determine status
    let status: "paid" | "pending" = "pending";
    if (emi.status === "paid" || paidAmount >= emi.emiAmount) {
      status = "paid";
    }
    
    // Calculate penalty: 2% if overdue and not paid
    let penalty = 0;
    if (isOverdue && status !== "paid") {
      penalty = emi.emiAmount * 0.02;
    } else {
      penalty = emi.penalty || 0;
    }
    
    const totalDue = emi.emiAmount + penalty;
    
    // Re-check status with penalty included
    if (status !== "paid" && paidAmount >= totalDue) {
      status = "paid";
    }
    
    // Generate month name only if dueDate is valid
    const monthName = dueDate 
      ? monthNames[dueDate.getMonth()] + " " + dueDate.getFullYear()
      : "—";
    
    return {
      monthNumber: emi.monthNumber,
      monthName,
      dueDate: dueDate ? dueDate.toISOString() : null,
      emiAmount: emi.emiAmount,
      penalty,
      totalDue,
      paidAmount,
      status,
      paymentDate,
    };
  });

  // Sort schedule by due date (handle null dates)
  processedSchedule.sort((a: any, b: any) => {
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return dateA - dateB;
  });

  // Calculate overall status
  const paidCount = processedSchedule.filter((s: any) => s.status === "paid").length;
  const totalCount = processedSchedule.length;
  let overallStatus = "active";
  if (paidCount === totalCount && totalCount > 0) {
    overallStatus = "completed";
  } else if (paidCount > 0) {
    overallStatus = "in_progress";
  }

  const member = (loan as any).userId || {};
  
  // Helper function to serialize dates and ObjectIds to strings
  const serializeValue = (value: any): any => {
    if (value === null || value === undefined) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (mongoose.Types.ObjectId.isValid(value)) {
      return String(value);
    }
    if (typeof value === 'object' && value.toString) {
      return String(value);
    }
    return value;
  };

  return {
    _id: serializeValue((loan as any)._id),
    memberId: serializeValue(member._id || (loan as any).userId),
    memberName: String((loan as any).memberName || member.name || "Unknown"),
    memberUserId: String(member.userId || ""),
    memberMobile: String(member.mobile || ""),
    principal: Number((loan as any).principal) || 0,
    monthlyInterestPercent: Number((loan as any).monthlyInterestPercent) || 0,
    durationMonths: Number((loan as any).durationMonths) || 0,
    startDate: serializeValue((loan as any).startDate),
    nextEMIDueDate: serializeValue((loan as any).nextEMIDueDate),
    emiAmount: Number((loan as any).emiAmount) || 0,
    schedule: processedSchedule,
    status: overallStatus,
    createdAt: serializeValue((loan as any).createdAt),
    updatedAt: serializeValue((loan as any).updatedAt),
  };
}

export default async function LoanProfilePage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get("adminToken")?.value;

  if (!token) {
    redirect("/");
  }

  try {
    const decoded: any = verifyToken(token);
    if (!decoded || decoded.role !== "admin") {
      redirect("/");
    }
  } catch {
    redirect("/");
  }

  // Get loan ID from params
  const { loanId } = await params;

  if (!loanId) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Loan ID is required
        </div>
      </div>
    );
  }

  // Fetch loan data server-side
  const loan = await getLoanData(loanId);

  if (!loan) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          Loan not found
        </div>
      </div>
    );
  }

  // Render client component with pre-fetched data
  return <LoanProfileClient loan={loan} />;
}

