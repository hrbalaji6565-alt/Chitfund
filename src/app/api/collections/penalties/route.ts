import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import MemberLedger from "@/app/models/MemberLedger";
import { verifyToken } from "@/app/lib/jwt";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";
import mongoose from "mongoose";

type UnknownRecord = Record<string, unknown>;

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

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

function isAdminReq(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies.adminToken;
  if (!token) return false;
  try {
    const decoded = verifyToken(token) as { role?: string } | null;
    return Boolean(decoded && decoded.role === "admin");
  } catch {
    return false;
  }
}

function computePerMemberInstallment(group: UnknownRecord): number {
  const monthlyFromModel = toNum(group.monthlyInstallment);
  if (monthlyFromModel > 0) return Math.round(monthlyFromModel);

  const totalMembers = Math.max(
    1,
    toNum(group.totalMembers ?? (Array.isArray(group.members) ? group.members.length : 0)),
  );
  const chitValue = toNum(group.chitValue);
  const totalMonths = Math.max(1, toNum(group.totalMonths));
  if (!chitValue || !totalMonths || totalMembers <= 0) return 0;

  const monthlyTotal = Math.round(chitValue / totalMonths);
  return Math.round(monthlyTotal / totalMembers);
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const groupId = toStr(searchParams.get("groupId"));
    const memberId = toStr(searchParams.get("memberId"));

    if (!groupId || !memberId) {
      return NextResponse.json(
        { success: false, message: "groupId and memberId are required" },
        { status: 400 },
      );
    }

    const rows = (await MemberLedger.find({
      groupId,
      memberId,
      penaltyAmount: { $gt: 0 },
    })
      .select("monthIndex dueAmount paidAmount penaltyAmount status")
      .sort({ monthIndex: 1 })
      .lean()) as Array<Record<string, unknown>>;

    const penalties = rows.map((r) => ({
      monthIndex: Math.max(1, Math.round(toNum(r.monthIndex) + 1)),
      penaltyAmount: Math.max(0, Math.round(toNum(r.penaltyAmount))),
      dueAmount: Math.max(0, Math.round(toNum(r.dueAmount))),
      paidAmount: Math.max(0, Math.round(toNum(r.paidAmount))),
      status: toStr(r.status) || "Pending",
    }));

    return NextResponse.json({
      success: true,
      penalties,
      totalPenalty: penalties.reduce((sum, p) => sum + p.penaltyAmount, 0),
    });
  } catch (error) {
    console.error("GET /api/collections/penalties error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminReq(req)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const groupId = toStr(body.groupId);
    let memberId = toStr(body.memberId);
    const memberSlotId = toStr(body.memberSlotId);
    const monthIndex = Math.max(1, Math.round(toNum(body.monthIndex)));
    const penaltyAmount = Math.max(0, Math.round(toNum(body.penaltyAmount)));

    if (!groupId || monthIndex <= 0 || penaltyAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "groupId, monthIndex and penaltyAmount are required" },
        { status: 400 },
      );
    }

    if (!memberId && !memberSlotId) {
      return NextResponse.json(
        { success: false, message: "memberId or memberSlotId is required" },
        { status: 400 },
      );
    }

    const group = (await Group.findById(groupId).lean()) as UnknownRecord | null;
    if (!group) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    if (memberSlotId && !memberId) {
      const slots = normalizeGroupMemberSlots(group.members);
      const slot = slots.find((s) => String(s.slotId) === memberSlotId);
      memberId = slot ? String(slot.memberId) : "";
    }

    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return NextResponse.json({ success: false, message: "Invalid member" }, { status: 400 });
    }

    const ledgerMonthIdx = Math.max(0, monthIndex - 1);
    const perMemberInstallment = computePerMemberInstallment(group);
    const groupStartDate = new Date(
      typeof group.startDate === "string" ? group.startDate : new Date(),
    );
    const dueDate = new Date(groupStartDate);
    dueDate.setMonth(groupStartDate.getMonth() + ledgerMonthIdx);

    let ledger = await MemberLedger.findOne({
      groupId,
      memberId,
      monthIndex: ledgerMonthIdx,
    });

    if (!ledger) {
      ledger = await MemberLedger.create({
        groupId: new mongoose.Types.ObjectId(groupId),
        memberId: new mongoose.Types.ObjectId(memberId),
        monthIndex: ledgerMonthIdx,
        dueAmount: perMemberInstallment,
        paidAmount: 0,
        penaltyAmount: 0,
        status: "Pending",
        dueDate,
      });
    }

    ledger.penaltyAmount = Math.max(0, Number(ledger.penaltyAmount || 0) + penaltyAmount);
    const dueTotal = Number(ledger.dueAmount || 0) + Number(ledger.penaltyAmount || 0);
    const paid = Number(ledger.paidAmount || 0);
    ledger.status = paid >= dueTotal ? "Paid" : paid > 0 ? "PartiallyPaid" : "Pending";
    await ledger.save();

    return NextResponse.json({
      success: true,
      message: "Penalty applied successfully",
      data: {
        groupId,
        memberId,
        monthIndex,
        penaltyAmount: Number(ledger.penaltyAmount || 0),
      },
    });
  } catch (error) {
    console.error("POST /api/collections/penalties error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
