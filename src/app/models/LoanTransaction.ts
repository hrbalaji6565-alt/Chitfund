import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILoanTransaction extends Document {
  userId: mongoose.Types.ObjectId | string;
  loanId: mongoose.Types.ObjectId | string;
  loanName?: string;
  emiMonth: number;
  amount: number;
  paymentMethod: "UPI" | "CASH";
  transactionType: "EMI Payment";
  status: "Paid" | "Pending" | "Failed";
  utr?: string;
  referenceId?: string;
  transactionDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const LoanTransactionSchema = new Schema<ILoanTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    loanId: { type: Schema.Types.ObjectId, ref: "Loan", required: true },
    loanName: { type: String },
    emiMonth: { type: Number, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["UPI", "CASH"], required: true },
    transactionType: { type: String, enum: ["EMI Payment"], default: "EMI Payment" },
    status: { type: String, enum: ["Paid", "Pending", "Failed"], default: "Paid" },
    utr: { type: String },
    referenceId: { type: String },
    transactionDate: { type: Date, required: true },
  },
  { timestamps: true }
);

const LoanTransaction: Model<ILoanTransaction> =
  (mongoose.models.LoanTransaction as Model<ILoanTransaction>) ||
  mongoose.model<ILoanTransaction>("LoanTransaction", LoanTransactionSchema);

export default LoanTransaction;