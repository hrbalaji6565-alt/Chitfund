"use client";
import React, { useState } from "react";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";

type PaymentResult = {
  success: boolean;
  payment?: {
    _id?: string;
    amount: number;
    allocated?: Array<{ ledgerId?: string; monthIndex?: number; amount?: number }>;
  };
  message?: string;
};

export default function PaymentWidget({ memberId, groupId, onSuccess }: { memberId: string; groupId: string; onSuccess?: (res: PaymentResult) => void; }) {
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  async function submitPayment() {
    setError(null);
    if (!memberId || !groupId) return setError("missing member/group");
    if (!amount || amount <= 0) return setError("enter valid amount");

    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId, groupId, amount }),
      });
      const json = (await res.json()) as PaymentResult;
      if (!res.ok) throw new Error(json?.message ?? "Payment failed");
      setResult(json);
      onSuccess?.(json);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded bg-white">
      <h4 className="font-medium mb-2">Make Payment</h4>
      <div className="flex gap-2 mb-3">
        <Input type="number" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value || 0))} placeholder="Amount (₹)" />
        <Button onClick={submitPayment} disabled={loading || !amount}>{loading ? "Processing..." : "Pay"}</Button>
      </div>

      {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

      {result?.payment && (
        <div className="text-sm text-gray-700">
          <div>Payment saved: ₹{result.payment.amount}</div>
          <div className="mt-2">
            <div className="font-medium">Allocations:</div>
            <ul className="list-disc ml-5">
              {result.payment.allocated?.map((a, idx) => (
                <li key={idx}>Month {a.monthIndex}: ₹{a.amount}</li>
              )) ?? <li>No allocations</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
