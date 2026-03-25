import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel.js";
import LoanTransaction from "@/app/models/LoanTransaction";
import { generateTransactionId } from "@/app/lib/loanUtils";
import mongoose from "mongoose";

export async function POST(req: Request, { params }: { params: Promise<{ loanId: string }> }) {
  try {
    const { loanId } = await params;
    
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || 
                  req.headers.get("cookie")?.split("memberToken=")[1]?.split(";")[0];

    if (!token) {
      return NextResponse.json({ success: false, message: "No token provided" }, { status: 401 });
    }

    const decoded = verifyToken(token) as { id?: string; userId?: string };
    const memberId = decoded?.id || decoded?.userId;
    if (!memberId) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const { monthNumber, paymentMode, amount, utrNumber } = await req.json();

    if (!monthNumber || !paymentMode || !amount) {
      return NextResponse.json({ 
        success: false, 
        message: "Month number, payment mode, and amount are required" 
      }, { status: 400 });
    }

    // Force UPI payment mode for user-side payments
    if (paymentMode !== "UPI") {
      return NextResponse.json({ 
        success: false, 
        message: "Only UPI payments are allowed for user-side EMI payments" 
      }, { status: 400 });
    }

    // Validate UTR number for UPI payments
    if (!utrNumber || !utrNumber.trim()) {
      return NextResponse.json({ 
        success: false, 
        message: "UTR number is required for UPI payments" 
      }, { status: 400 });
    }

    await dbConnect();

    const loan = await Loan.findOne({ 
      _id: loanId, 
      userId: memberId 
    });

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    // Find the EMI in schedule
    const emiIndex = loan.schedule.findIndex((emi) => {
      const rec = emi as unknown as Record<string, unknown>;
      return Number(rec.monthNumber ?? 0) === Number(monthNumber);
    });
    if (emiIndex === -1) {
      return NextResponse.json({ success: false, message: "EMI not found" }, { status: 404 });
    }

    const emi = loan.schedule[emiIndex];

    // Validate EMI object has required fields
    if (!emi.dueDate || !emi.emiAmount || typeof emi.monthNumber !== 'number') {
      return NextResponse.json({ 
        success: false, 
        message: "EMI data is incomplete. Missing required fields." 
      }, { status: 400 });
    }

    // Check if EMI is already paid
    if (emi.status === "paid") {
      return NextResponse.json({ success: false, message: "EMI already paid" }, { status: 400 });
    }

    // Allow early payment; due date and current-month restrictions removed

    const pendingAmount = Math.max(0, Number(emi.emiAmount ?? 0) - Number(emi.paidAmount ?? 0));
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > pendingAmount) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid amount. Pending amount is ${pendingAmount}`,
        },
        { status: 400 }
      );
    }

    const loanObjectId = mongoose.Types.ObjectId.isValid(String(loanId))
      ? new mongoose.Types.ObjectId(String(loanId))
      : null;

    const existingPending = await LoanTransaction.findOne({
      userId: memberId,
      emiMonth: Number(monthNumber),
      status: "Pending",
      $or: loanObjectId ? [{ loanId }, { loanId: loanObjectId }] : [{ loanId }],
    }).lean();

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          message: "This EMI payment is already pending for admin approval",
        },
        { status: 409 }
      );
    }

    // Generate transaction ID for pending request
    const transactionId = generateTransactionId();

    // Create loan transaction record ONLY after successful EMI update
    const loanTransaction = new LoanTransaction({
      userId: memberId,
      loanId: loanId,
      loanName: loan.memberName || `Loan ${loanId}`,
      emiMonth: monthNumber,
      amount: amount,
      paymentMethod: "UPI", // Force UPI for user payments
      transactionType: "EMI Payment",
      status: "Pending",
      utr: utrNumber,
      referenceId: transactionId,
      transactionDate: new Date(),
    });

    await loanTransaction.save();

    return NextResponse.json({
      success: true,
      message: "EMI payment submitted and pending admin approval",
      transactionId,
      transaction: {
        id: loanTransaction._id,
        loanName: loanTransaction.loanName,
        emiMonth: loanTransaction.emiMonth,
        amount: loanTransaction.amount,
        paymentMethod: loanTransaction.paymentMethod,
        status: "Pending",
        utr: loanTransaction.utr,
        transactionDate: loanTransaction.transactionDate,
      }
    });

  } catch (error) {
    console.error("Error processing EMI payment:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process EMI payment" },
      { status: 500 }
    );
  }
}
