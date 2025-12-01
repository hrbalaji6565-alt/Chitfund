// app/api/chitgroups/[id]/payments/approve/route.ts
import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import Group from "@/app/models/ChitGroup";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UnknownRecord = Record<string, unknown>;
type Savable = { save?: () => Promise<unknown> };

export async function POST(req: NextRequest, context: RouteContext) {
  await dbConnect();

  try {
    const { id: groupIdRaw } = await context.params;
    const groupId = String(groupIdRaw ?? "");

    const body = (await req.json().catch(() => ({}))) as {
      paymentId?: unknown;
      approve?: unknown;
      adminNote?: unknown;
    };

    const paymentId = body.paymentId !== undefined ? String(body.paymentId) : "";
    const approve = body.approve === true;
    const adminNote =
      typeof body.adminNote === "string" ? body.adminNote : "";

    if (!groupId || !paymentId) {
      return NextResponse.json(
        { success: false, error: "Missing parameters" },
        { status: 400 },
      );
    }

    // find payment document
    const paymentDoc = (await Payment.findById(paymentId)) as unknown;
    if (!paymentDoc) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 },
      );
    }

    // work with a record representation (avoids `any` usage)
    const pRec = paymentDoc as UnknownRecord;

    const currentStatus =
      typeof pRec.status === "string" ? pRec.status : undefined;

    // idempotent responses
    if (currentStatus === "approved" && approve) {
      return NextResponse.json({
        success: true,
        message: "Already approved",
        payment: pRec,
      });
    }
    if (currentStatus === "rejected" && !approve) {
      return NextResponse.json({
        success: true,
        message: "Already rejected",
        payment: pRec,
      });
    }

    const paymentSave = (paymentDoc as Savable).save;

    if (!approve) {
      pRec.status = "rejected";
      pRec.adminNote = adminNote || "Rejected by admin";
      pRec.approvedAt = null;

      if (typeof paymentSave === "function") {
        await paymentSave.call(paymentDoc);
      }

      // eslint-disable-next-line no-console
      console.log("payment rejected:", paymentId, "by admin");

      return NextResponse.json({ success: true, payment: pRec });
    }

    // Approve flow
    pRec.status = "approved";
    pRec.approvedAt = new Date();
    pRec.adminNote = adminNote || "Approved by admin";
    pRec.verified = true; // for UI convenience

    // If client sent allocation summary inside rawMeta, keep it in appliedAllocation
    try {
      const rawMeta =
        pRec.rawMeta && typeof pRec.rawMeta === "object"
          ? (pRec.rawMeta as UnknownRecord)
          : undefined;
      if (rawMeta && pRec.appliedAllocation === undefined) {
        pRec.appliedAllocation = rawMeta.allocationSummary;
      }
    } catch {
      // ignore errors
    }

    if (typeof paymentSave === "function") {
      await paymentSave.call(paymentDoc);
    }

    // Atomic update of group's collected total (prefer payment.groupId if present)
    const amountNum =
      typeof pRec.amount === "number"
        ? pRec.amount
        : Number(pRec.amount ?? 0) || 0;

    if (amountNum > 0) {
      const gid =
        (pRec.groupId !== undefined
          ? String(pRec.groupId)
          : groupId) || groupId;

      await Group.findByIdAndUpdate(
        gid,
        { $inc: { collectedAmount: amountNum } },
        { new: true },
      ).lean();

      // eslint-disable-next-line no-console
      console.log("group updated after approval:", gid, "inc:", amountNum);
    }

    // eslint-disable-next-line no-console
    console.log("payment approved:", paymentId, "amount:", amountNum);

    return NextResponse.json({ success: true, payment: pRec });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("payments/approve error:", err);
    const message =
      err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
