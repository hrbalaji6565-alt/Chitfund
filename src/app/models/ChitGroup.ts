// src/app/models/ChitGroup.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChitGroup extends Document {
  name: string;
  chitValue: number;
  monthlyInstallment: number;
  totalMonths: number;
  totalMembers: number;
  startDate: string;
  endDate: string;
  status: "Active" | "Closed" | "Inactive";
  remarks: string;
  penaltyPercent: number;
  biddingOpen: boolean;
  biddingMonthIndex: number;
  members?: mongoose.Types.ObjectId[]; // list of member ids
  winners?: mongoose.Types.ObjectId[];
}

const chitGroupSchema = new Schema<IChitGroup>(
  {
    name: { type: String, required: true },
    chitValue: { type: Number, required: true },
    monthlyInstallment: { type: Number, required: true },
    totalMonths: { type: Number, required: true },
    totalMembers: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["Active", "Closed", "Inactive"],
      default: "Active",
    },
    remarks: { type: String, default: "" },
    penaltyPercent: { type: Number, default: 0 },
    biddingOpen: {
      type: Boolean,
      default: false,
    },
    biddingMonthIndex: {
      type: Number,
      default: 1,
    },
    members: [{ type: Schema.Types.ObjectId, ref: "Member" }], // members array
    // NEW: winners array (members who already received disbursement)
    winners: [{ type: Schema.Types.ObjectId, ref: "Member", default: [] }],
  },
  { timestamps: true }
);

const ChitGroup: Model<IChitGroup> =
  (mongoose.models.ChitGroup as Model<IChitGroup>) ||
  mongoose.model<IChitGroup>("ChitGroup", chitGroupSchema);

export default ChitGroup;
