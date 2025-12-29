import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel.js";
import LoanTransaction from "@/app/models/LoanTransaction";
import { generateTransactionId } from "@/app/lib/loanUtils";

export async function POST(req: Request, { params }: { params: Promise<{ loanId: string }> }) {
  try {
    const { loanId } = await params;
    
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || 
                  req.headers.get("cookie")?.split("memberToken=")[1]?.split(";")[0];

    if (!token) {
      return NextResponse.json({ success: false, message: "No token provided" }, { status: 401 });
    }

    const decoded = verifyToken(token) as { id: string; userId: string };
    if (!decoded?.id) {
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
      userId: decoded.id 
    });

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    // Find the EMI in schedule
    const emiIndex = loan.schedule.findIndex((emi: any) => emi.monthNumber === monthNumber);
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

    // Validate payment date - current date must be >= due date
    const currentDate = new Date();
    const dueDate = new Date(emi.dueDate);
    
    // Reset time to start of day for accurate comparison
    currentDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    if (currentDate < dueDate) {
      const dueDateFormatted = dueDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit", 
        year: "numeric"
      });
      return NextResponse.json({ 
        success: false, 
        message: `Payment not allowed before due date. Payment will be enabled on ${dueDateFormatted}` 
      }, { status: 400 });
    }

    // Validate that this is current month EMI only
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const emiMonth = dueDate.getMonth();
    const emiYear = dueDate.getFullYear();
    
    if (currentMonth !== emiMonth || currentYear !== emiYear) {
      return NextResponse.json({ 
        success: false, 
        message: "Only current month EMI payments are allowed" 
      }, { status: 400 });
    }

    // Generate transaction ID
    const transactionId = generateTransactionId();

    // CRITICAL: Update ONLY specific fields on the existing EMI object
    // DO NOT overwrite the entire object as it removes required fields (dueDate, emiAmount, monthNumber)
    // and causes Mongoose validation errors
    loan.schedule[emiIndex].paidAmount = amount;
    loan.schedule[emiIndex].status = "paid";
    loan.schedule[emiIndex].paymentMode = "UPI"; // Force UPI for user payments
    loan.schedule[emiIndex].paymentDate = new Date();
    loan.schedule[emiIndex].utrNumber = utrNumber;
    loan.schedule[emiIndex].transactionId = transactionId;

    // Update next EMI due date
    const nextUnpaidEmi = loan.schedule.find((e: any) => e.status === "pending");
    loan.nextEMIDueDate = nextUnpaidEmi ? nextUnpaidEmi.dueDate : null;

    // Save loan first
    await loan.save();

    // Create loan transaction record ONLY after successful EMI update
    const loanTransaction = new LoanTransaction({
      userId: decoded.id,
      loanId: loanId,
      loanName: loan.memberName || `Loan ${loanId}`,
      emiMonth: monthNumber,
      amount: amount,
      paymentMethod: "UPI", // Force UPI for user payments
      transactionType: "EMI Payment",
      status: "Paid",
      utr: utrNumber,
      referenceId: transactionId,
      transactionDate: new Date(),
    });

    await loanTransaction.save();

    return NextResponse.json({
      success: true,
      message: "EMI payment recorded successfully",
      transactionId,
      updatedEmi: loan.schedule[emiIndex],
      transaction: {
        id: loanTransaction._id,
        loanName: loanTransaction.loanName,
        emiMonth: loanTransaction.emiMonth,
        amount: loanTransaction.amount,
        paymentMethod: loanTransaction.paymentMethod,
        status: loanTransaction.status,
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