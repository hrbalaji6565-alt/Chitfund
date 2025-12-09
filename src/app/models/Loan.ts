import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILoan extends Document {
  memberId: string;
  principal: number;
  monthlyInterestRate: number; // % per month
  tenureMonths: number;
  dueDayOfMonth: number; // e.g. 10
  penaltyRate: number; // % per month on EMI
  installmentAmount: number; // EMI per month
  status: "active" | "closed";
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<ILoan>(
  {
    memberId: { type: String, required: true, index: true },
    principal: { type: Number, required: true },
    monthlyInterestRate: { type: Number, required: true },
    tenureMonths: { type: Number, required: true },
    dueDayOfMonth: { type: Number, required: true },
    penaltyRate: { type: Number, required: true },
    installmentAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
    startDate: { type: Date, required: true },
  },
  { timestamps: true },
);

const Loan: Model<ILoan> =
  mongoose.models.Loan || mongoose.model<ILoan>("Loan", LoanSchema);

export default Loan;
