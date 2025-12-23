import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import Payment from "@/app/models/Payment";
import { verifyToken } from "@/app/lib/jwt";
import mongoose from "mongoose";

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    map[k.trim()] = decodeURIComponent((v || []).join("=").trim());
  });
  return map;
}

async function resolveParams(context: unknown): Promise<{ loanId: string }> {
  if (!context || typeof context !== "object") {
    throw new Error("Missing route context");
  }
  const ctx = context as Record<string, unknown>;
  const raw = ctx.params as unknown;
  const params = raw instanceof Promise ? (await raw) : raw;

  if (!params || typeof params !== "object" || !("loanId" in (params as Record<string, unknown>))) {
    throw new Error("Missing params.loanId");
  }

  const loanId = String((params as Record<string, unknown>).loanId);
  return { loanId };
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

export async function GET(req: NextRequest, context: unknown) {
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

    const { loanId } = await resolveParams(context);
    
    if (!isValidObjectId(loanId)) {
      return NextResponse.json({ success: false, message: "Invalid loan ID" }, { status: 400 });
    }

    await dbConnect();

    // Fetch loan with member details
    const loan = await Loan.findById(loanId)
      .populate("userId", "name userId mobile")
      .lean();

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    // Fetch all payments for this member that might be related to loans - optimized query
    const memberId = (loan as any).userId?._id || (loan as any).userId;
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
        if (allocation.loanId === loanId && allocation.monthNumber) {
          const key = `${allocation.monthNumber}`;
          const existing = paymentMap.get(key) || { amount: 0, date: null };
          paymentMap.set(key, {
            amount: existing.amount + (allocation.amount || 0),
            date: existing.date || (payment as any).approvedAt || (payment as any).createdAt || null,
          });
        }
      }
    }
    
    const processedSchedule = schedule.map((emi: any) => {
      const dueDate = new Date(emi.dueDate);
      const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const isOverdue = dueDateStart < nowStart;
      
      // Get payment info from map (O(1) lookup)
      const paymentInfo = paymentMap.get(String(emi.monthNumber)) || { amount: 0, date: null };
      const paidAmount = (emi.paidAmount || 0) + paymentInfo.amount;
      const paymentDate = paymentInfo.date;
      
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
      
      const monthName = monthNames[dueDate.getMonth()] + " " + dueDate.getFullYear();
      
      return {
        monthNumber: emi.monthNumber,
        monthName,
        dueDate: dueDate.toISOString(),
        emiAmount: emi.emiAmount,
        penalty,
        totalDue,
        paidAmount,
        status,
        paymentDate,
      };
    });

    // Sort schedule by due date
    processedSchedule.sort((a: any, b: any) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

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
    const formattedLoan = {
      _id: (loan as any)._id,
      memberId: member._id || (loan as any).userId,
      memberName: (loan as any).memberName || member.name || "Unknown",
      memberUserId: member.userId || "",
      memberMobile: member.mobile || "",
      principal: (loan as any).principal,
      monthlyInterestPercent: (loan as any).monthlyInterestPercent,
      durationMonths: (loan as any).durationMonths,
      startDate: (loan as any).startDate,
      nextEMIDueDate: (loan as any).nextEMIDueDate,
      emiAmount: (loan as any).emiAmount,
      schedule: processedSchedule,
      status: overallStatus,
      createdAt: (loan as any).createdAt,
      updatedAt: (loan as any).updatedAt,
    };

    return NextResponse.json({
      success: true,
      loan: formattedLoan,
    });
  } catch (err) {
    console.error("GET /api/admin/loan/[loanId] error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

