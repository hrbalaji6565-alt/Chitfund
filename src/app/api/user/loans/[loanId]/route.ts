import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel.js";
import { isCurrentMonth, isPastMonth, isFutureMonth } from "@/app/lib/loanUtils";

export async function GET(req: Request, { params }: { params: Promise<{ loanId: string }> }) {
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

    await dbConnect();

    const loan = await Loan.findOne({ 
      _id: loanId, 
      userId: decoded.id 
    }).lean();

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    // Add current month info to each EMI
    const enhancedSchedule = loan.schedule.map((emi: any) => {
      const emiDate = new Date(emi.dueDate);
      const isCurrentMonthEMI = isCurrentMonth(emiDate);
      const isPastMonthEMI = isPastMonth(emiDate);
      const isFutureMonthEMI = isFutureMonth(emiDate);

      return {
        ...emi,
        monthNumber: emi.monthNumber,
        isCurrentMonth: isCurrentMonthEMI,
        isPastMonth: isPastMonthEMI,
        isFutureMonth: isFutureMonthEMI,
        canPay: isCurrentMonthEMI && emi.status === "pending"
      };
    });

    return NextResponse.json({
      success: true,
      loan: {
        ...loan,
        schedule: enhancedSchedule
      }
    });

  } catch (error) {
    console.error("Error fetching loan details:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch loan details" },
      { status: 500 }
    );
  }
}