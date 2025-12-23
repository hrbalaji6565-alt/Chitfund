import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import LoanTransaction from "@/app/models/LoanTransaction";
import Member from "@/app/models/Member";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || 
                  req.headers.get("cookie")?.split("adminToken=")[1]?.split(";")[0];

    if (!token) {
      return NextResponse.json({ success: false, message: "No admin token provided" }, { status: 401 });
    }

    // Verify admin token (you may need to adjust this based on your admin auth logic)
    const decoded = verifyToken(token) as { id: string; role?: string };
    if (!decoded?.id) {
      return NextResponse.json({ success: false, message: "Invalid admin token" }, { status: 401 });
    }

    await dbConnect();

    const transactions = await LoanTransaction.find({})
      .populate('userId', 'name userId')
      .sort({ transactionDate: -1 })
      .lean();

    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      userName: (transaction.userId as any)?.name || "Unknown User",
      userIdField: (transaction.userId as any)?.userId || "Unknown",
      loanId: transaction.loanId,
      loanName: transaction.loanName || `Loan ${transaction.loanId}`,
      emiMonth: transaction.emiMonth,
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      utr: transaction.utr || transaction.referenceId || "-",
      date: transaction.transactionDate,
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions
    });

  } catch (error) {
    console.error("Error fetching admin loan transactions:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loan transactions" },
      { status: 500 }
    );
  }
}