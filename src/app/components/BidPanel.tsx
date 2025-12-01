"use client";
import React, { useEffect, useMemo, useState } from "react";
import type { ChitGroup } from "@/app/lib/types";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";

/** Bid shape returned by API */
export interface Bid {
  _id?: string;
  chitId: string;
  memberId: string;
  monthIndex: number; // 1-based
  bidAmount: number;
  discount?: number;
  createdAt?: string;
}

/** Props: chit object and current member id (logged-in) */
export default function BidPanel({ chit, memberId }: { chit: ChitGroup; memberId: string }) {
  const chitId = String(chit._id ?? chit.id ?? "");
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // fetch bids
  useEffect(() => {
    if (!chitId) return;
    let mounted = true;
    setLoading(true);
    fetch(`/api/chits/${chitId}/bids`, { credentials: "include" })
      .then(async (r) => {
        const json = await r.json();
        if (!mounted) return;
        if (!r.ok) throw new Error(json?.message ?? "Failed to load bids");
        setBids(Array.isArray(json.bids) ? json.bids : []);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    return () => { mounted = false; };
  }, [chitId]);

  // computed info
  const monthIndex = useMemo(() => {
    // derive current month index from server-friendly fields if present; fallback to 1
    // prefer: use `chit.currentMonthIndex` if you add it; otherwise use 1
    const maybe = (chit as { currentMonthIndex?: number }).currentMonthIndex as number | undefined;
    return typeof maybe === "number" && maybe > 0 ? maybe : 1;
  }, [chit]);

  async function handlePlaceBid() {
    setError(null);
    if (!memberId) { setError("Member id required"); return; }
    if (!bidAmount || bidAmount <= 0) { setError("Enter valid bid amount"); return; }
    setPlacing(true);
    try {
      const res = await fetch(`/api/chits/${chitId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId, bidAmount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Failed to place bid");
      // prepend the new bid
      setBids((s) => [json.bid as Bid, ...s]);
      setBidAmount(0);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="p-4 border rounded-md bg-white">
      <h4 className="font-semibold mb-2">Monthly Bidding (Month {monthIndex})</h4>

      <div className="flex gap-2 items-center mb-3">
        <Input type="number" value={bidAmount || ""} onChange={(e) => setBidAmount(Number(e.target.value || 0))} placeholder="Bid amount (e.g., 90000)" />
        <Button onClick={handlePlaceBid} disabled={placing || !bidAmount} className="h-10">{placing ? "Placing..." : "Place Bid"}</Button>
      </div>
      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      <div className="text-sm text-gray-600 mb-2">Recent bids</div>
      <div className="space-y-2 max-h-48 overflow-auto">
        {loading && <div className="text-gray-500">Loading...</div>}
        {(!loading && bids.length === 0) && <div className="text-gray-500">No bids yet</div>}
        {bids.map((b) => (
          <div key={b._id} className="flex justify-between items-center p-2 border rounded">
            <div>
              <div className="font-medium">₹{b.bidAmount.toLocaleString()}</div>
              <div className="text-xs text-gray-500">by {b.memberId} • {new Date(b.createdAt ?? "").toLocaleString()}</div>
            </div>
            <div className="text-sm text-gray-700">discount: ₹{(b.discount ?? (Number(chit.chitValue ?? 0) - b.bidAmount)).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
