import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILedgerEntry extends Document {
  memberId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  monthIndex: number; // 0..totalMonths-1 (relative to group start)
  dueAmount: number;
  paidAmount: number;
  penaltyAmount: number;
  status: "Pending" | "Paid" | "PartiallyPaid" | "Overdue";
  dueDate?: Date; // exact due date for that month
  payments?: mongoose.Types.ObjectId[]; // references to Payment docs that applied here
  createdAt?: Date;
  updatedAt?: Date;
}

const LedgerSchema = new Schema<ILedgerEntry>({
  memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
  groupId: { type: Schema.Types.ObjectId, ref: "ChitGroup", required: true },
  monthIndex: { type: Number, required: true },
  dueAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  penaltyAmount: { type: Number, default: 0 },
  status: { type: String, enum: ["Pending","Paid","PartiallyPaid","Overdue"], default: "Pending" },
  dueDate: { type: Date },
  payments: [{ type: Schema.Types.ObjectId, ref: "Payment" }],
}, { timestamps: true });

const MemberLedger: Model<ILedgerEntry> =
  (mongoose.models.MemberLedger as Model<ILedgerEntry>) ||
  mongoose.model<ILedgerEntry>("MemberLedger", LedgerSchema);

export default MemberLedger;
