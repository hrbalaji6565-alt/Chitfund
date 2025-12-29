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
    const { 
      userId, 
      amount, 
      monthlyInterestPercent, 
      durationType = "MONTHS",
      durationValue,
      durationInMonths, // Keep for backward compatibility
      startDate, 
      endDate, 
      emiAmount, 
      schedule 
    } = body;

    if (!userId || !amount || !monthlyInterestPercent || !durationValue || !startDate) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    await dbConnect();

    // Validate member exists and get member name
    const member = await Member.findById(userId);
    if (!member) {
      return NextResponse.json({ success: false, message: "Member not found" }, { status: 404 });
    }

    // Calculate next EMI due date based on duration type
    const startDateObj = new Date(startDate);
    let nextEMIDueDate;
    
    if (durationType === "MONTHS") {
      // 1 month from start date for monthly loans
      nextEMIDueDate = new Date(startDateObj);
      nextEMIDueDate.setMonth(nextEMIDueDate.getMonth() + 1);
    } else {
      // End date for day-based loans (single payment)
      nextEMIDueDate = new Date(endDate);
    }

    // Use provided schedule or generate default
    let emiSchedule = schedule || [];
    if (!emiSchedule.length) {
      const baseEMIAmount = Number(emiAmount);
      
      if (durationType === "MONTHS") {
        // Generate monthly schedule
        for (let i = 1; i <= durationValue; i++) {
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
      } else {
        // Generate single payment for day-based loan
        emiSchedule.push({
          monthNumber: 1,
          emiAmount: baseEMIAmount,
          dueDate: new Date(endDate),
          penalty: 0,
          paidAmount: 0,
          status: "pending",
        });
      }
    }

    // Create loan document with enhanced fields
    const loan = await Loan.create({
      userId,
      principal: Number(amount),
      monthlyInterestPercent: Number(monthlyInterestPercent),
      durationMonths: durationType === "MONTHS" ? Number(durationValue) : (durationInMonths || 0),
      durationType: durationType,
      durationValue: Number(durationValue),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
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
