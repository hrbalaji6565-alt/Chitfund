// src/app/lib/auction.ts
import mongoose from "mongoose";
import ChitGroup from "@/app/models/ChitGroup";
import Contribution from "@/app/models/Contribution";
import Auction from "@/app/models/Auction";
import Bid from "@/app/models/Bid";

type BidLean = {
  _id?: unknown;
  memberId?: string | mongoose.Types.ObjectId;
  member?: string | mongoose.Types.ObjectId;
  discountOffered?: number;
  discount?: number;
  bidAmount?: number;
  [k: string]: unknown;
};

type ContributionLean = {
  _id?: unknown;
  memberId?: string | mongoose.Types.ObjectId;
  amount?: number;
  [k: string]: unknown;
};

/**
 * Run auction for chitId + monthIndex if not already run.
 * - selects winner (highest discount) among eligible bidders (not already in chit.winners)
 * - computes winningPayout = totalPot - winningDiscount
 * - distributes winningDiscount pro-rata to contributors of that month
 * - writes Auction doc and updates chit.winners
 */
export async function runAuctionAndDistribute(
  chitId: string,
  monthIndex: number
) {
  // find chit
  const chit = await ChitGroup.findById(chitId);
  if (!chit) throw new Error("Chit not found");

  // avoid duplicate auctions for same chit/month
  const existing = await Auction.findOne({
    chitId: String(chit._id),
    monthIndex,
  });
  if (existing) {
    return existing;
  }

  const totalPot = Number(chit.chitValue || 0);

  // load bids (unsorted) and compute a numeric `discount` for each so we are robust
  // to different Bid schema shapes: discountOffered, discount, or bidAmount.
  const rawBids = (await Bid.find({
    chitId: String(chit._id),
    monthIndex,
  }).lean()) as BidLean[];

  const bidsWithDiscount = rawBids
    .map((b: BidLean) => {
      // priority: b.discountOffered -> b.discount -> compute from bidAmount if present
      const discountOffered = (() => {
        if (!b) return 0;
        if (typeof b.discountOffered === "number")
          return Number(b.discountOffered);
        if (typeof b.discount === "number") return Number(b.discount);
        if (
          typeof b.bidAmount === "number" &&
          typeof totalPot === "number"
        ) {
          return Math.max(0, Number(totalPot) - Number(b.bidAmount));
        }
        // fallback
        return 0;
      })();

      return {
        ...b,
        __computedDiscount: discountOffered,
      } as BidLean & { __computedDiscount: number };
    })
    // sort by computed discount desc (highest discount first)
    .sort(
      (a, z) =>
        Number(z.__computedDiscount || 0) -
        Number(a.__computedDiscount || 0)
    );

  // normalize chit.winners (could be ObjectId[] or string[])
  const rawWinners = (chit.get("winners") as unknown) ?? [];
  const alreadyWon: string[] = Array.isArray(rawWinners)
    ? (rawWinners as unknown[]).map((w) => String(w))
    : [];

  // pick first eligible bid (not already winner)
  let winnerId: string | null = null;
  let winningDiscount = 0;

  for (const b of bidsWithDiscount) {
    const bidderRaw =
      b.memberId ??
      (typeof b.member === "string" || b.member instanceof mongoose.Types.ObjectId
        ? b.member
        : undefined);
    const bidderId = bidderRaw ? String(bidderRaw) : "";
    const discount = Number((b as { __computedDiscount: number }).__computedDiscount || 0);
    if (bidderId && !alreadyWon.includes(bidderId)) {
      winnerId = bidderId;
      winningDiscount = discount;
      break;
    }
  }

  // If no eligible bids: default discount 0 => winnerId stays null
  const winningPayout = Math.max(0, totalPot - winningDiscount);

  // collect contributions for the month
  const contributions = (await Contribution.find({
    chitId: String(chit._id),
    monthIndex,
  }).lean()) as ContributionLean[];

  const totalCollected = contributions.reduce((s, c) => {
    const amt = typeof c.amount === "number" ? c.amount : 0;
    return s + amt;
  }, 0);

  // distribute winningDiscount pro-rata among contributors for that month
  const distributedToMembers: Array<{ memberId: string; amount: number }> = [];

  if (totalCollected > 0 && winningDiscount > 0) {
    const byMember = new Map<string, number>();
    for (const c of contributions) {
      const midRaw = c.memberId;
      const mid = midRaw ? String(midRaw) : "";
      if (!mid) continue;
      const amt = typeof c.amount === "number" ? c.amount : 0;
      byMember.set(mid, (byMember.get(mid) || 0) + amt);
    }

    for (const [mid, paid] of byMember.entries()) {
      const share = Math.round((paid / totalCollected) * winningDiscount);
      if (share > 0) distributedToMembers.push({ memberId: mid, amount: share });
    }

    // fix rounding diff
    const distributedSum = distributedToMembers.reduce(
      (s, x) => s + x.amount,
      0
    );
    const diff = winningDiscount - distributedSum;
    if (diff !== 0 && distributedToMembers.length) {
      distributedToMembers[0].amount += diff;
    }
  }

  // Create auction record
  const auction = await Auction.create({
    chitId: String(chit._id),
    monthIndex,
    totalPot,
    winningMemberId: winnerId ?? "NO_WINNER",
    winningBidAmount: winningDiscount,
    winningPayout,
    distributedToMembers,
  });

  // mark winner as having won (so they won't bid next months)
  if (winnerId) {
    // normalize winners array, append if missing, and save
    const winnersArr = Array.isArray(chit.winners)
      ? (chit.winners as unknown[]).map((w) => String(w))
      : [];
    if (!winnersArr.includes(winnerId)) {
      winnersArr.push(winnerId);
      // assign back (string[] is fine for Mongo)
      chit.set("winners", winnersArr);
      await chit.save();
    }
  }

  return auction;
}
