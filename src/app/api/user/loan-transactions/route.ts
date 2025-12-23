import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import LoanTransaction from "@/app/models/LoanTransaction";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || 
                  req.headers.get("cookie")?.split("memberToken=")[1]?.split(";")[0];

    if (!token) {
      return NextResponse.json({ success: false, message: "No token provided" }, { status: 401 });
    }

    const decoded = verifyToken(token) as { id: string; userId: string };
    if (!decoded?.id) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    await dbConnect();

    const transactions = await LoanTransaction.find({ userId: decoded.id })
      .sort({ transactionDate: -1 })
      .lean();

    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      loan: transaction.loanName || transaction.loanId,
      month: transaction.emiMonth,
      total: transaction.amount,
      paid: transaction.amount,
      status: transaction.status,
      utr: transaction.utr || transaction.referenceId || "-",
      date: transaction.transactionDate,
      paymentMethod: transaction.paymentMethod,
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions
    });

  } catch (error) {
    console.error("Error fetching loan transactions:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loan transactions" },
      { status: 500 }
    );
  }
}