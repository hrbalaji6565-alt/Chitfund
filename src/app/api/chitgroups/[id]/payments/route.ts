import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment"; // adjust path

async function resolveParams(context: unknown) {
  const ctx = context as Record<string, unknown>;
  const params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
  return { id: String((params as Record<string, unknown>).id) };
}

export async function GET(_req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    await dbConnect();
    // accept ?all=true or ?monthIndex=2
    // URLSearchParams is available if you use request.nextUrl
    const url = new URL(_req.url);
    const all = url.searchParams.get("all") === "true";
    const monthIndex = url.searchParams.has("monthIndex") ? Number(url.searchParams.get("monthIndex")) : undefined;

    const query: Record<string, unknown> = { groupId: id };
    if (!all && typeof monthIndex === "number") query["allocation.monthIndex"] = monthIndex; // adapt to your model shape

    const payments = await Payment.find(query).lean();
    return NextResponse.json({ success: true, payments });
  } catch (err) {
    console.error("GET payments error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    const body = await req.json().catch(() => ({}));
    // support body: { all: true } or { monthIndex: 2 }
    await dbConnect();
    const all = body.all === true;
    const monthIndex = typeof body.monthIndex === "number" ? body.monthIndex : undefined;
    const q: Record<string, unknown> = { groupId: id };
    if (!all && typeof monthIndex === "number") q["allocation.monthIndex"] = monthIndex;
    const payments = await Payment.find(q).lean();
    return NextResponse.json({ success: true, payments });
  } catch (err) {
    console.error("POST payments error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
