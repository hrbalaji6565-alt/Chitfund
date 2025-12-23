// models/Contribution.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IContribution extends Document {
  chitId: string;
  memberId: string;
  amount: number;
  date: Date;
  monthIndex: number;
}

const ContributionSchema = new Schema<IContribution>({
  chitId: { type: String, required: true, index: true },
  memberId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  monthIndex: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.models.Contribution || mongoose.model<IContribution>("Contribution", ContributionSchema);
