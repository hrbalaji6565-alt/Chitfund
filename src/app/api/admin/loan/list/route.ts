import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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

export async function GET(req: NextRequest) {
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

    await dbConnect();

    // Fetch all loans with member details - optimized query
    const loans = await Loan.find({})
      .populate("userId", "name userId mobile")
      .select("userId memberName principal monthlyInterestPercent durationMonths startDate nextEMIDueDate emiAmount schedule.status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    // Format loans for response - only send necessary data
    const formattedLoans = loans.map((loan: any) => {
      const member = loan.userId || {};
      // Only send status count, not full schedule details
      const schedule = loan.schedule || [];
      const scheduleWithStatusOnly = schedule.map((item: any) => ({
        status: item.status || "pending"
      }));
      
      return {
        _id: loan._id,
        memberId: loan.userId?._id || loan.userId,
        memberName: loan.memberName || member.name || "Unknown",
        memberUserId: member.userId || "",
        memberMobile: member.mobile || "",
        principal: loan.principal,
        monthlyInterestPercent: loan.monthlyInterestPercent,
        durationMonths: loan.durationMonths,
        startDate: loan.startDate,
        nextEMIDueDate: loan.nextEMIDueDate,
        emiAmount: loan.emiAmount,
        schedule: scheduleWithStatusOnly, // Minimal schedule data
        status: loan.status || "active",
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      loans: formattedLoans,
    });
  } catch (err) {
    console.error("GET /api/admin/loan/list error", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

