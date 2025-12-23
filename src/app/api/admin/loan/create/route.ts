import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
import Member from "@/app/models/Member";
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

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { userId, amount, monthlyInterestPercent, durationInMonths, startDate, endDate, emiAmount, schedule } = body;

    if (!userId || !amount || !monthlyInterestPercent || !durationInMonths || !startDate) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();

    // Validate member exists and get member name
    const member = await Member.findById(userId);
    if (!member) {
      return NextResponse.json({ success: false, message: "Member not found" }, { status: 404 });
    }

    // Calculate next EMI due date (1 month from start date)
    const startDateObj = new Date(startDate);
    const nextEMIDueDate = new Date(startDateObj);
    nextEMIDueDate.setMonth(nextEMIDueDate.getMonth() + 1);

    // Generate EMI schedule with due dates
    // First EMI due: 1 month after loan approval date (same day of month)
    const emiSchedule = [];
    const baseEMIAmount = Number(emiAmount);
    const duration = Number(durationInMonths);
    
    for (let i = 1; i <= duration; i++) {
      const dueDate = new Date(startDateObj);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      emiSchedule.push({
        monthNumber: i,
        emiAmount: baseEMIAmount,
        dueDate: dueDate,
        penalty: 0,
        paidAmount: 0,
        status: "pending",
      });
    }

    // Create loan document with all required fields
    const loan = await Loan.create({
      userId,
      principal: Number(amount),
      monthlyInterestPercent: Number(monthlyInterestPercent),
      durationMonths: Number(durationInMonths),
      startDate: new Date(startDate),
      emiAmount: Number(emiAmount),
      nextEMIDueDate: nextEMIDueDate,
      memberName: member.name || "",
      schedule: emiSchedule,
    });

    return NextResponse.json({
      success: true,
      message: "Loan created successfully",
    }, { status: 200 });
  } catch (err) {
    console.error("POST /api/admin/loan/create error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
