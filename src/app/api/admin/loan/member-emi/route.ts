import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import Payment from "@/app/models/Payment";
import { verifyToken } from "@/app/lib/jwt";

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    map[k.trim()] = decodeURIComponent((v || []).join("=").trim());
  });
  return map;
}

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = parseCookies(cookieHeader);
    const token = cookies["adminToken"];
    
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = verifyToken(token);
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId");
    
    if (!memberId) {
      return NextResponse.json({ success: false, message: "memberId is required" }, { status: 400 });
    }

    await dbConnect();

    // Find all loans for this member
    const loans = await Loan.find({ userId: memberId }).lean();

    if (loans.length === 0) {
      return NextResponse.json({
        success: true,
        emiSchedule: [],
      });
    }

    // Get all payments for this member related to loans - optimized query
    const allPayments = await Payment.find({
      memberId: memberId,
      status: { $in: ["approved", "submitted"] },
    }).select("allocated rawMeta approvedAt createdAt").lean();

    // Create payment lookup map for O(1) access - PERFORMANCE OPTIMIZATION
    const paymentMap = new Map<string, { amount: number; date: string | null }>();
    
    for (const payment of allPayments) {
      const allocated = (payment as any).allocated || [];
      for (const allocation of allocated) {
        if (allocation.loanId && allocation.monthNumber) {
          const key = `${allocation.loanId}-${allocation.monthNumber}`;
          const existing = paymentMap.get(key) || { amount: 0, date: null };
          const paymentDate = (payment as any).approvedAt || (payment as any).createdAt;
          paymentMap.set(key, {
            amount: existing.amount + (allocation.amount || 0),
            date: existing.date || (paymentDate ? paymentDate.toISOString() : null),
          });
        }
      }
    }

    // Pre-create month names array for performance
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Process each loan and build EMI schedule - OPTIMIZED
    const allEMIs: Array<{
      loanId: string;
      loanAmount: number;
      monthNumber: number;
      monthName: string;
      dueDate: string;
      emiAmount: number;
      penalty: number;
      totalDue: number;
      paidAmount: number;
      status: "paid" | "pending";
    }> = [];

    const now = new Date();
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const loan of loans) {
      const loanId = (loan as any)._id.toString();
      const schedule = (loan as any).schedule || [];
      
      for (const emi of schedule) {
        // Safely parse dueDate
        const rawDueDate = emi.dueDate;
        let dueDate: Date;
        if (rawDueDate instanceof Date) {
          dueDate = rawDueDate;
        } else {
          dueDate = new Date(rawDueDate);
          if (isNaN(dueDate.getTime())) {
            continue; // Skip invalid dates
          }
        }
        
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const isOverdue = dueDateStart < nowStart;
        
        // Get payment info from map - O(1) lookup instead of nested loop
        const paymentKey = `${loanId}-${emi.monthNumber}`;
        const paymentInfo = paymentMap.get(paymentKey) || { amount: 0, date: null };
        const paidAmount = (emi.paidAmount || 0) + paymentInfo.amount;
        
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
        
        // Get month name
        const monthName = monthNames[dueDate.getMonth()] + " " + dueDate.getFullYear();
        
        allEMIs.push({
          loanId,
          loanAmount: (loan as any).principal,
          monthNumber: emi.monthNumber,
          monthName,
          dueDate: dueDate.toISOString(),
          emiAmount: emi.emiAmount,
          penalty,
          totalDue,
          paidAmount,
          status,
        });
      }
    }

    // Sort by due date
    allEMIs.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return NextResponse.json({
      success: true,
      emiSchedule: allEMIs,
    });
  } catch (err) {
    console.error("GET /api/admin/loan/member-emi error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

