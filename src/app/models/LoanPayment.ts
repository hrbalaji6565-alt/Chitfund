import mongoose, { Schema, Document, Model } from "mongoose";

export type LoanPaymentStatus = "pending" | "submitted" | "approved" | "rejected";

export interface ILoanPayment extends Document {
  loanId: string;
  memberId: string;
  monthIndex: number;
  dueDate: Date;

  baseAmount: number;
  interestAmount: number;
  penaltyAmount: number;
  totalDue: number;

  paidAmount: number;
  paidAt?: Date | null;
  utr?: string | null;
  method?: string | null;

  status: LoanPaymentStatus;
  source: "user" | "collector" | "admin";
  collectedById?: string | null;
  collectorRole?: "collector" | "admin" | null;

  createdAt: Date;
  updatedAt: Date;
}

const LoanPaymentSchema = new Schema<ILoanPayment>(
  {
    loanId: { type: String, required: true, index: true },
    memberId: { type: String, required: true, index: true },
    monthIndex: { type: Number, required: true },
    dueDate: { type: Date, required: true },

    baseAmount: { type: Number, required: true },
    interestAmount: { type: Number, required: true },
    penaltyAmount: { type: Number, required: true, default: 0 },
    totalDue: { type: Number, required: true },

    paidAmount: { type: Number, required: true, default: 0 },
    paidAt: { type: Date },

    utr: { type: String },
    method: { type: String },

    status: {
      type: String,
      enum: ["pending", "submitted", "approved", "rejected"],
      default: "pending",
    },
    source: {
      type: String,
      enum: ["user", "collector", "admin"],
      required: true,
    },
    collectedById: { type: String },
    collectorRole: {
      type: String,
      enum: ["collector", "admin"],
    },
  },
  { timestamps: true },
);

LoanPaymentSchema.index({ loanId: 1, monthIndex: 1 }, { unique: true });

const LoanPayment: Model<ILoanPayment> =
  mongoose.models.LoanPayment ||
  mongoose.model<ILoanPayment>("LoanPayment", LoanPaymentSchema);

export default LoanPayment;
