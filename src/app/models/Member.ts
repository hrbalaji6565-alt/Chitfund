import mongoose, { Document, Model, Schema } from "mongoose";

export type MemberStatus = "Active" | "Inactive";

export interface IMember extends Document {
  name: string;
  mobile: string;
  email: string;
  password: string;
  joiningDate?: Date;
  address?: string;
  status: MemberStatus;
  totalPaid: number;
  pendingAmount: number;
  aadhaarUrl?: string;
  aadhaarPublicId?: string;
  govIdUrl?: string;
  govIdPublicId?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  role: "user";
  // Preferred: multiple groups
  groups?: mongoose.Types.ObjectId[];  // NEW: multiple groups
  // Backwards compatibility: single group
  group?: mongoose.Types.ObjectId;
  groupName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    joiningDate: { type: Date },
    address: { type: String },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    totalPaid: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },

    aadhaarUrl: { type: String },
    aadhaarPublicId: { type: String },
    govIdUrl: { type: String },
    govIdPublicId: { type: String },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },

    role: { type: String, enum: ["user"], default: "user" },

    // Membership fields:
    // new preferred field (multiple groups)
    groups: [{ type: Schema.Types.ObjectId, ref: "ChitGroup" }],
    // backward-compat single group field (kept for older records)
    group: { type: Schema.Types.ObjectId, ref: "ChitGroup" },
    groupName: { type: String },
  },
  { timestamps: true }
);

const Member: Model<IMember> = (mongoose.models.Member as Model<IMember>) || mongoose.model<IMember>("Member", MemberSchema);

export default Member;
