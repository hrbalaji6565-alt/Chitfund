import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import { verifyToken } from "@/app/lib/jwt";
import Loan from "@/app/models/loanModel";
import Member from "@/app/models/Member";
import mongoose from "mongoose";


function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").forEach((c) => {
    const [k, ...v] = c.split("=");
    const raw = (v || []).join("=").trim();
    try {
      map[k.trim()] = decodeURIComponent(raw);
    } catch {
      map[k.trim()] = raw;
    }
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

    let decoded: { role?: string } | null = null;
    try {
      decoded = verifyToken(token) as { role?: string } | null;
    } catch {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const loans = await Loan.find({})
      .select("userId memberName principal monthlyInterestPercent durationMonths durationType durationValue startDate endDate nextEMIDueDate emiAmount schedule.status createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    const uniqueUserIds = Array.from(
      new Set(
        loans
          .map((loan) => String((loan as unknown as Record<string, unknown>).userId ?? ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      )
    );

    const members = uniqueUserIds.length
      ? await Member.find({ _id: { $in: uniqueUserIds } })
          .select("_id name userId mobile")
          .lean()
      : [];

    const memberMap = new Map(
      members.map((m) => [
        String((m as unknown as Record<string, unknown>)._id ?? ""),
        m as unknown as Record<string, unknown>,
      ])
    );

    const formattedLoans = loans.map((loan) => {
      const loanRec = loan as unknown as Record<string, unknown>;
      const member = memberMap.get(String(loanRec.userId ?? "")) ?? {};
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

