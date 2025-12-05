// models/Auction.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IAuction extends Document {
  chitId: string;
  monthIndex: number;
  totalPot: number;
  winningMemberId: string;
  winningBidAmount: number; // yahan hum "winning discount" rakhenge
  winningPayout: number;
  distributedToMembers: Array<{ memberId: string; amount: number }>;
  createdAt?: Date;
}

const AuctionSchema = new Schema<IAuction>(
  {
    chitId: { type: String, required: true, index: true },
    monthIndex: { type: Number, required: true },
    totalPot: { type: Number, required: true },
    winningMemberId: { type: String, required: true },
    winningBidAmount: { type: Number, required: true }, // = winningDiscount
    winningPayout: { type: Number, required: true },
    distributedToMembers: {
      type: [{ memberId: String, amount: Number }],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Auction ||
  mongoose.model<IAuction>("Auction", AuctionSchema);
