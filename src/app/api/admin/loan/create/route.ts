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

    const decoded = verifyToken(token) as { role?: string } | null;
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

    const principalNum = Number(amount);
    const interestNum = Number(monthlyInterestPercent);
    const durationNum = Number(durationValue);
    const emiNum = Number(emiAmount);
    if (!userId || !startDate || !Number.isFinite(principalNum) || principalNum <= 0 || !Number.isFinite(interestNum) || interestNum < 0 || !Number.isFinite(durationNum) || durationNum <= 0 || !Number.isFinite(emiNum) || emiNum <= 0) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }
    if (durationType === "DAYS" && !endDate) {
      return NextResponse.json({ success: false, message: "End date is required for day-based loans" }, { status: 400 });
    }

    await dbConnect();

    // Validate member exists and get member name
    const member = await Member.findById(userId);
    if (!member) {
      return NextResponse.json({ success: false, message: "Member not found" }, { status: 404 });
    }

    // Calculate next EMI due date based on duration type
    const startDateObj = new Date(startDate);
    if (Number.isNaN(startDateObj.getTime())) {
      return NextResponse.json({ success: false, message: "Invalid start date" }, { status: 400 });
    }
    const endDateObj = endDate ? new Date(endDate) : null;
    if (durationType === "DAYS" && (!endDateObj || Number.isNaN(endDateObj.getTime()))) {
      return NextResponse.json({ success: false, message: "Invalid end date" }, { status: 400 });
    }
    let nextEMIDueDate;
    
    if (durationType === "MONTHS") {
      // 1 month from start date for monthly loans
      nextEMIDueDate = new Date(startDateObj);
      nextEMIDueDate.setMonth(nextEMIDueDate.getMonth() + 1);
    } else {
      // End date for day-based loans (single payment)
      nextEMIDueDate = new Date(endDateObj as Date);
    }

    // Use provided schedule or generate default
    const emiSchedule = Array.isArray(schedule) ? [...schedule] : [];
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
            dueDate: new Date(endDateObj as Date),
          penalty: 0,
          paidAmount: 0,
          status: "pending",
        });
      }
    }

    // Create loan document with enhanced fields
    await Loan.create({
      userId,
      principal: principalNum,
      monthlyInterestPercent: interestNum,
      durationMonths: durationType === "MONTHS" ? durationNum : (durationInMonths || 0),
      durationType: durationType,
      durationValue: durationNum,
      startDate: new Date(startDate),
      endDate: endDateObj ?? new Date(startDateObj),
      emiAmount: emiNum,
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
