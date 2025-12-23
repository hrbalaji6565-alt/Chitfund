import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Loan from "@/app/models/loanModel";
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

export async function PATCH(req: Request) {
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
    const { loanId, monthNumber } = body;

    if (!loanId || monthNumber === undefined) {
      return NextResponse.json(
        { success: false, message: "loanId and monthNumber are required" },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find loan and update the specific EMI schedule item
    const loan = await Loan.findById(loanId);

    if (!loan) {
      return NextResponse.json({ success: false, message: "Loan not found" }, { status: 404 });
    }

    // Find and update the schedule item
    const scheduleItem = loan.schedule.find((item: any) => item.monthNumber === monthNumber);

    if (!scheduleItem) {
      return NextResponse.json(
        { success: false, message: "EMI schedule item not found" },
        { status: 404 }
      );
    }

    scheduleItem.status = "paid";
    await loan.save();

    return NextResponse.json({
      success: true,
      message: "EMI marked as paid",
      schedule: loan.schedule,
    });
  } catch (err) {
    console.error("PATCH /api/admin/loan/emi/mark-paid error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
