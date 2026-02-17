import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel.js";
import { getLoanStatus } from "@/app/lib/loanUtils";

export async function GET(req: Request) {
  try {
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

    await dbConnect();

    const loans = await Loan.find({ userId: memberId })
      .select("memberName principal emiAmount startDate durationMonths schedule")
      .lean();

    const formattedLoans = loans.map(loan => ({
      _id: loan._id,
      loanName: loan.memberName || "Personal Loan",
      principal: loan.principal,
      emiAmount: loan.emiAmount,
      status: getLoanStatus(loan.schedule),
      startDate: loan.startDate,
      durationMonths: loan.durationMonths
    }));

    return NextResponse.json({
      success: true,
      loans: formattedLoans
    });

  } catch (error) {
    console.error("Error fetching user loans:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}
