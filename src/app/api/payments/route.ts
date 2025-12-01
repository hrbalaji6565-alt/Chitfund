// src/app/api/payments/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/app/lib/mongodb";

// Payment schema (add recordedBy to know which admin created it)
const PaymentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "ChitGroup", required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["PAYMENT", "CONTRIBUTION", "ADMIN"], default: "PAYMENT" },
  reference: { type: String },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // optional admin who recorded
  createdAt: { type: Date, default: () => new Date() },
});

const Payment =
  mongoose.models.Payment ?? mongoose.model("Payment", PaymentSchema);

// If your app already defines Member/ChitGroup/Admin models, import them rather than relying on these fallback models:
const Member =
  mongoose.models.Member ??
  mongoose.model(
    "Member",
    new mongoose.Schema({ name: String, email: String })
  );
const ChitGroup =
  mongoose.models.ChitGroup ??
  mongoose.model("ChitGroup", new mongoose.Schema({ name: String }));
const Admin =
  mongoose.models.Admin ??
  mongoose.model(
    "Admin",
    new mongoose.Schema({ name: String, email: String })
  );

// mark as used to satisfy eslint (models are still registered with mongoose)
void Member;
void ChitGroup;
void Admin;

type RefUser = {
  _id?: unknown;
  name?: string;
  email?: string;
};

type RefGroup = {
  _id?: unknown;
  name?: string;
};

type RefAdmin = {
  _id?: unknown;
  name?: string;
  email?: string;
};

type PopulatedPayment = {
  _id?: unknown;
  amount?: number;
  reference?: string;
  createdAt?: string | Date;
  memberId?:
    | RefUser
    | string
    | mongoose.Types.ObjectId;
  groupId?:
    | RefGroup
    | string
    | mongoose.Types.ObjectId;
  recordedBy?:
    | RefAdmin
    | string
    | mongoose.Types.ObjectId;
  [k: string]: unknown;
};

type NormalizedRef = {
  _id?: string;
  name?: string;
  email?: string;
};

const normalizeRef = (val: unknown): NormalizedRef | undefined => {
  if (!val) return undefined;
  if (typeof val === "string" || val instanceof mongoose.Types.ObjectId) {
    return { _id: String(val) };
  }
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    const idVal = o._id ?? o.id;
    const nameVal = o.name;
    const emailVal = o.email;
    return {
      _id: idVal !== undefined ? String(idVal) : undefined,
      name: typeof nameVal === "string" ? nameVal : undefined,
      email: typeof emailVal === "string" ? emailVal : undefined,
    };
  }
  return undefined;
};

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body: unknown = await req.json().catch(() => ({}));
    const {
      memberId,
      groupId,
      amount,
      type,
      reference,
      adminId,
    } = (body || {}) as Record<string, unknown>;

    if (!memberId || !groupId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "memberId, groupId and amount (>0) are required" },
        { status: 400 }
      );
    }

    // Accept adminId optionally as recordedBy
    const paymentDoc = await Payment.create({
      memberId,
      groupId,
      amount: Number(amount),
      type: typeof type === "string" ? type.toUpperCase() : "PAYMENT",
      reference: typeof reference === "string" ? reference : "admin-recorded",
      recordedBy: adminId ?? undefined,
    });

    // populate member, group and recordedBy so frontend receives names
    const populatedRaw = await Payment.findById(paymentDoc._id)
      .populate({ path: "memberId", select: "name email" })
      .populate({ path: "groupId", select: "name" })
      .populate({ path: "recordedBy", select: "name email" })
      .lean();

    const populated = (populatedRaw as unknown) as PopulatedPayment | null;

    const member = normalizeRef(populated?.memberId);
    const group = normalizeRef(populated?.groupId);
    const recordedBy = normalizeRef(populated?.recordedBy);

    const resp = {
      ...populated,
      member: member
        ? {
            _id: member._id,
            name: member.name,
            email: member.email,
          }
        : undefined,
      group: group
        ? {
            _id: group._id,
            name: group.name,
          }
        : undefined,
      recordedBy: recordedBy
        ? {
            _id: recordedBy._id,
            name: recordedBy.name,
            email: recordedBy.email,
          }
        : undefined,
    };

    return NextResponse.json({ payment: resp }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/payments error:", err);
    const msg =
      err && typeof err === "object" && "message" in err
        ? (err as { message: unknown }).message
        : String(err);
    return NextResponse.json(
      { error: msg ?? String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get("memberId") ?? undefined;

    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }
    const payments = db.collection("payments");

    const q: Record<string, unknown> = {};
    if (memberId) {
      // keep existing behavior – store raw memberId string
      q.memberId = memberId;
    }

    const items = await payments
      .find(q)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(items);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
