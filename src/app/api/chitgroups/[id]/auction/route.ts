import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Auction from "@/app/models/Auction";
import mongoose from "mongoose";

const isValidObjectId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // Next 15: params is a Promise, so await it
    const { id: chitId } = await context.params;

    if (!isValidObjectId(chitId)) {
      return NextResponse.json(
        { success: false, error: "Invalid chit id" },
        { status: 400 },
      );
    }

    await dbConnect();

    const url = new URL(req.url);
    const rawMonth = url.searchParams.get("monthIndex");
    const monthIndex = rawMonth ? Number(rawMonth) : undefined;

    const query: Record<string, unknown> = { chitId };
    if (monthIndex && Number.isFinite(monthIndex)) {
      query.monthIndex = Math.max(1, Math.round(monthIndex));
    }

    const auction = await Auction.findOne(query)
      .sort({ monthIndex: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      auction,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("GET /api/chitgroups/[id]/auction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch auction" },
      { status: 500 },
    );
  }
}
