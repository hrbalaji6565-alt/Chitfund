// src/app/api/chits/[id]/run-auction/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import { runAuctionAndDistribute } from "@/app/lib/auction";
import mongoose from "mongoose";

async function resolveParams(context: unknown): Promise<{ id: string; month?: string }> {
  const ctx = context as Record<string, unknown>;
  const raw = ctx?.params as unknown;
  const p = raw instanceof Promise ? (await raw) : raw;
  if (!p || typeof p !== "object" || !("id" in (p as Record<string, unknown>))) {
    throw new Error("Missing params.id");
  }
  return { id: String((p as Record<string, unknown>).id) };
}

export async function POST(_req: Request, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    await dbConnect();
    // body { monthIndex: number }
    const body = await _req.json().catch(() => ({}));
    const monthIndex = Number(body.monthIndex || 1);
    const auction = await runAuctionAndDistribute(id, monthIndex);
    return NextResponse.json({ success: true, auction });
  } catch (err) {
    console.error("POST /api/chits/[id]/run-auction error:", err);
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
