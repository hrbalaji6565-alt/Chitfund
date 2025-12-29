import mongoose from "mongoose";

const LoanScheduleSchema = new mongoose.Schema(
  {
    monthNumber: { type: Number, required: true },
    emiAmount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    penalty: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, default: "pending" },
    paymentMode: { type: String, enum: ["UPI", "CASH"], default: null },
    paymentDate: { type: Date, default: null },
    transactionId: { type: String, default: null },
    utrNumber: { type: String, default: null },
  },
  { _id: false }
);

const LoanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, required: true, ref: "Member" },
    memberName: { type: String, default: "" },
    principal: { type: Number, required: true },
    monthlyInterestPercent: { type: Number, required: true },
    durationMonths: { type: Number, required: true },
    durationType: { type: String, enum: ["MONTHS", "DAYS"], default: "MONTHS" },
    durationValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    nextEMIDueDate: { type: Date, default: null },
    emiAmount: { type: Number, required: true },
    schedule: { type: [LoanScheduleSchema], default: [] },
  },
  { timestamps: true }
);

const Loan = mongoose.models.Loan || mongoose.model("Loan", LoanSchema);

export default Loan;
