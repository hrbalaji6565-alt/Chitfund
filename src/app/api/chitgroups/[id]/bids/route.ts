// src/app/api/chits/[id]/bids/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Bid from "@/app/models/Bid";
import ChitGroup from "@/app/models/ChitGroup";
import mongoose from "mongoose";

async function resolveParams(context: unknown): Promise<{ id: string }> {
  const ctx = context as Record<string, unknown>;
  const raw = ctx?.params as unknown;
  const p = raw instanceof Promise ? (await raw) : raw;
  if (!p || typeof p !== "object" || !("id" in (p as Record<string, unknown>))) {
    throw new Error("Missing params.id");
  }
  return { id: String((p as Record<string, unknown>).id) };
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

export async function POST(req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Invalid chit id" }, { status: 400 });

    const body = await req.json();
    const { memberId, monthIndex, discountOffered } = body as { memberId?: string; monthIndex?: number; discountOffered?: number };

    if (!memberId || typeof monthIndex !== "number" || typeof discountOffered !== "number") {
      return NextResponse.json({ success: false, error: "memberId, monthIndex and discountOffered required" }, { status: 400 });
    }

    await dbConnect();
    const chit = await ChitGroup.findById(id).lean();
    if (!chit) return NextResponse.json({ success: false, error: "Chit not found" }, { status: 404 });

    // ensure member is part of chit
    const members = Array.isArray(chit.members) ? chit.members.map(String) : [];
    if (!members.includes(String(memberId))) {
      return NextResponse.json({ success: false, error: "Member not part of this chit" }, { status: 403 });
    }

    // create or update existing bid for member+month (one bid per member per month)
    const existing = await Bid.findOne({ chitId: String(chit._id), memberId: String(memberId), monthIndex });
    if (existing) {
      existing.discountOffered = Number(discountOffered);
      await existing.save();
      return NextResponse.json({ success: true, bid: existing });
    }

    const bid = await Bid.create({
      chitId: String(chit._id),
      memberId: String(memberId),
      monthIndex,
      discountOffered: Number(discountOffered),
    });

    return NextResponse.json({ success: true, bid }, { status: 201 });
  } catch (err) {
    console.error("POST /api/chits/[id]/bids error:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
