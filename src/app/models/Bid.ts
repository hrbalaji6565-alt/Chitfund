// src/app/models/Bid.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBid extends Document {
  chitId: string;
  memberId: string;
  monthIndex: number;
  discountOffered: number;
  createdAt?: Date;
}

const BidSchema = new Schema<IBid>({
  chitId: { type: String, required: true, index: true },
  memberId: { type: String, required: true, index: true },
  monthIndex: { type: Number, required: true },
  discountOffered: { type: Number, required: true },
}, { timestamps: true });

const Bid: Model<IBid> =
  (mongoose.models.Bid as Model<IBid>) || mongoose.model<IBid>("Bid", BidSchema);

export default Bid;
