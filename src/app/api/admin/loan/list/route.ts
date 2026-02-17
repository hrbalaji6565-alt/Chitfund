import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import { verifyToken } from "@/app/lib/jwt";
import Loan from "@/app/models/loanModel";


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

    const decoded = verifyToken(token) as { role?: string } | null;
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Fetch all loans with member details - optimized query
    const loans = await Loan.find({})
      .populate("userId", "name userId mobile")
      .select("userId memberName principal monthlyInterestPercent durationMonths durationType durationValue startDate endDate nextEMIDueDate emiAmount schedule.status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    // Format loans for response - only send necessary data
    const formattedLoans = loans.map((loan) => {
      const loanRec = loan as unknown as Record<string, unknown>;
      const member =
        loanRec.userId && typeof loanRec.userId === "object"
          ? (loanRec.userId as Record<string, unknown>)
          : {};
      // Only send status count, not full schedule details
      const schedule = Array.isArray(loanRec.schedule) ? loanRec.schedule : [];
      const scheduleWithStatusOnly = schedule.map((item) => ({
        status:
          item && typeof item === "object" && "status" in (item as Record<string, unknown>)
            ? String((item as Record<string, unknown>).status ?? "pending")
            : "pending",
      }));
      
      return {
        _id: loanRec._id,
        memberId: member._id ?? loanRec.userId,
        memberName: String(loanRec.memberName ?? member.name ?? "Unknown"),
        memberUserId: String(member.userId ?? ""),
        memberMobile: String(member.mobile ?? ""),
        principal: Number(loanRec.principal ?? 0),
        monthlyInterestPercent: Number(loanRec.monthlyInterestPercent ?? 0),
        durationMonths: Number(loanRec.durationMonths ?? 0),
        durationType: String(loanRec.durationType ?? "MONTHS"),
        durationValue: Number(loanRec.durationValue ?? loanRec.durationMonths ?? 0),
        startDate: loanRec.startDate,
        endDate: loanRec.endDate,
        nextEMIDueDate: loanRec.nextEMIDueDate,
        emiAmount: Number(loanRec.emiAmount ?? 0),
        schedule: scheduleWithStatusOnly, // Minimal schedule data
        status: String(loanRec.status ?? "active"),
        createdAt: loanRec.createdAt,
        updatedAt: loanRec.updatedAt,
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

