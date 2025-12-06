import mongoose, { Schema, Document, Model } from "mongoose";

export type CollectionRole = "collector" | "admin";

export interface ICollectionUser extends Document {
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  role: CollectionRole; // "collector" for employee
  active: boolean;
  assignedGroupIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CollectionUserSchema = new Schema<ICollectionUser>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["collector", "admin"],
      default: "collector",
    },
    active: { type: Boolean, default: true },
    assignedGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "ChitGroup",
      },
    ],
  },
  { timestamps: true },
);

const CollectionUserModel: Model<ICollectionUser> =
  (mongoose.models.CollectionUser as Model<ICollectionUser>) ??
  mongoose.model<ICollectionUser>("CollectionUser", CollectionUserSchema);

export default CollectionUserModel;
