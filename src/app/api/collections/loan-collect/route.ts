// src/app/api/collections/loan-collect/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import LoanTransaction from "@/app/models/LoanTransaction";
import { verifyToken } from "@/app/lib/jwt";
import type { JwtPayload } from "jsonwebtoken";

interface CollectionJwtPayload extends JwtPayload {
  id: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // Verify collector authentication
    const token = req.cookies.get("collectionToken")?.value ?? "";
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const decodedRaw = verifyToken(token) as CollectionJwtPayload | string | null;
    if (!decodedRaw || typeof decodedRaw === "string" || !decodedRaw.id) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const collectorId = decodedRaw.id;
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;

    const loanId = String(body.loanId ?? "");
    const memberId = String(body.memberId ?? "");
    const emiMonth = toNumber(body.emiMonth ?? 0);
    const collectedAmount = toNumber(body.amount ?? 0);
    const paymentMode = String(body.mode ?? "CASH").toUpperCase();
    const collectorName = String(body.collectorName ?? "");

    // Enhanced validation with detailed error messages
    if (!loanId) {
      return NextResponse.json(
        { success: false, error: "Loan ID is required" },
        { status: 400 }
      );
    }

    if (!memberId) {
      return NextResponse.json(
        { success: false, error: "Member ID is required" },
        { status: 400 }
      );
    }

    if (emiMonth <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid EMI month is required" },
        { status: 400 }
      );
    }

    if (collectedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Collection amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Validate payment mode
    if (!["CASH", "UPI", "BANK"].includes(paymentMode)) {
      return NextResponse.json(
        { success: false, error: "Invalid payment mode. Must be CASH, UPI, or BANK" },
        { status: 400 }
      );
    }

    // Find the loan
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 }
      );
    }

    // Ensure loan has a valid userId
    if (!loan.userId) {
      return NextResponse.json(
        { success: false, error: "Loan has no associated member" },
        { status: 400 }
      );
    }

    // Verify member matches - Convert both to strings for comparison
    const loanUserId = loan.userId.toString();
    if (loanUserId !== memberId) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Member ID mismatch. This loan belongs to member ${loanUserId}, but collection attempted for ${memberId}` 
        },
        { status: 400 }
      );
    }

    // Find the specific EMI in schedule
    const emiIndex = loan.schedule.findIndex(
      (emi: any) => emi.monthNumber === emiMonth
    );

    if (emiIndex === -1) {
      const availableMonths = loan.schedule.map((e: any) => e.monthNumber).join(", ");
      return NextResponse.json(
        { 
          success: false, 
          error: `EMI month ${emiMonth} not found. Available months: ${availableMonths}` 
        },
        { status: 404 }
      );
    }

    const emi = loan.schedule[emiIndex];
    const expectedAmount = toNumber(emi.emiAmount);
    const alreadyPaid = toNumber(emi.paidAmount);
    const pendingAmount = Math.max(0, expectedAmount - alreadyPaid);

    // Check if EMI is already fully paid
    if (pendingAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "This EMI is already fully paid" },
        { status: 400 }
      );
    }

    // CRITICAL: Validate due date - collection only allowed on or after due date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const dueDate = new Date(emi.dueDate);
    dueDate.setHours(0, 0, 0, 0); // Start of due date
    
    if (today < dueDate) {
      const dueDateFormatted = dueDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      return NextResponse.json(
        {
          success: false,
          error: `EMI cannot be collected before due date (${dueDateFormatted})`
        },
        { status: 400 }
      );
    }

    // Validate collection amount
    if (collectedAmount > pendingAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Collection amount (₹${collectedAmount}) exceeds pending amount (₹${pendingAmount})`
        },
        { status: 400 }
      );
    }

    // Check for duplicate collection (prevent double collection)
    const existingTransaction = await LoanTransaction.findOne({
      loanId,
      emiMonth,
      status: "Paid",
      amount: collectedAmount,
      createdAt: {
        $gte: new Date(Date.now() - 5 * 60 * 1000) // Within last 5 minutes
      }
    });

    if (existingTransaction) {
      return NextResponse.json(
        { success: false, error: "Duplicate collection detected. Please wait before retrying." },
        { status: 400 }
      );
    }

    // Create loan transaction record
    const loanTransaction = await LoanTransaction.create({
      userId: memberId,
      loanId,
      loanName: `Loan-${loanId.slice(-6)}`,
      emiMonth,
      amount: collectedAmount,
      paymentMethod: paymentMode,
      transactionType: "EMI Payment",
      status: "Paid",
      transactionDate: new Date(),
      referenceId: `COL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      // Store collector info in metadata
      collectorId,
      collectorName
    });

    // Update EMI in loan schedule
    const newPaidAmount = alreadyPaid + collectedAmount;
    const newPendingAmount = Math.max(0, expectedAmount - newPaidAmount);
    
    // Determine new status
    let newStatus = "pending";
    if (newPaidAmount >= expectedAmount) {
      newStatus = "paid";
    } else if (newPaidAmount > 0) {
      newStatus = "partial";
    }

    // Update the EMI in loan schedule
    loan.schedule[emiIndex].paidAmount = newPaidAmount;
    loan.schedule[emiIndex].status = newStatus;

    // If this EMI is now fully paid, update next EMI due date
    if (newStatus === "paid") {
      // Find next unpaid EMI
      const nextUnpaidEMI = loan.schedule.find(
        (e: any) => e.status !== "paid" && e.monthNumber > emiMonth
      );
      
      if (nextUnpaidEMI) {
        loan.nextEMIDueDate = nextUnpaidEMI.dueDate;
      } else {
        // All EMIs paid - loan completed
        loan.nextEMIDueDate = null;
      }
    }

    await loan.save();

    return NextResponse.json({
      success: true,
      message: "EMI collection recorded successfully",
      transaction: {
        id: loanTransaction._id,
        amount: collectedAmount,
        emiMonth,
        paymentMode,
        referenceId: loanTransaction.referenceId,
        collectionDate: loanTransaction.transactionDate
      },
      updatedEMI: {
        monthNumber: emiMonth,
        expected: expectedAmount,
        paid: newPaidAmount,
        pending: newPendingAmount,
        status: newStatus
      }
    });

  } catch (err) {
    console.error("POST /api/collections/loan-collect error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to record loan collection"
      },
      { status: 500 }
    );
  }
}