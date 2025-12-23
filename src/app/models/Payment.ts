// app/models/Payment.ts
import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * PaymentType union
 */
export type PaymentType = "UPI" | "CASH" | "BANK" | "OTHER";

/**
 * IPayment - server-side TypeScript interface for a Payment document.
 * Keep fields optional where Mongoose timestamps or defaults populate them.
 */
export interface IPayment extends Document {
  memberId: mongoose.Types.ObjectId | string;
  groupId: mongoose.Types.ObjectId | string;
  amount: number;
  type: PaymentType,
  reference?: string; // txn id / collector note / UTR
  collectorId?: mongoose.Types.ObjectId | string;
  allocated?: Array<{
    ledgerId?: mongoose.Types.ObjectId | string;
    monthIndex?: number;
    amount?: number;
    penaltyApplied?: number;
  }>;
  rawMeta?: Record<string, unknown>;
  verified?: boolean; // for UPI/online: set true after webhook/confirmation
  status: "pending" | "approved" | "rejected";
  approvedAt?: Date | null;
  utr?: string;
  adminNote?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Mongoose schema
 */
const PaymentSchema = new Schema<IPayment>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    groupId: { type: Schema.Types.ObjectId, ref: "ChitGroup", required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["UPI", "CASH", "BANK", "OTHER"],
      default: "UPI",
    },
    reference: { type: String },
    collectorId: { type: Schema.Types.ObjectId, ref: "Admin" },
    allocated: [
      {
        ledgerId: { type: Schema.Types.ObjectId, ref: "MemberLedger" },
        monthIndex: Number,
        amount: Number,
        penaltyApplied: { type: Number, default: 0 },
      },
    ],
    rawMeta: { type: Schema.Types.Mixed },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedAt: { type: Date, default: null },
    utr: { type: String },
    adminNote: { type: String, default: "" },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);


/**
 * Model export
 */
const Payment: Model<IPayment> = (mongoose.models.Payment as Model<IPayment>) || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
