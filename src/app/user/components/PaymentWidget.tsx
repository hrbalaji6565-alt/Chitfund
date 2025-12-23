// src/app/user/components/PaymentWidget.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Props = { memberId: string; groupId: string };

type GroupRecord = Record<string, unknown> & {
  monthlyInstallment?: unknown;
  monthly?: unknown;
  totalMembers?: unknown;
  members?: unknown;
  chitValue?: unknown;
  totalAmount?: unknown;
  totalMonths?: unknown;
  numberOfInstallments?: unknown;
  startDate?: unknown;
  penaltyPercent?: unknown;
  penalty?: unknown;
  penalty_rate?: unknown;
  upiId?: unknown;
  merchantUpi?: unknown;
  name?: unknown;
  groupName?: unknown;
};

type PaymentRecord = Record<string, unknown> & {
  amount?: unknown;
  monthIndex?: unknown;
  allocated?: unknown;
  allocation?: unknown;
  date?: unknown;
  createdAt?: unknown;
};

type OverdueInfo = {
  remainingPerMonth: Map<number, number>;
  totalOverdueRemaining: number;
  penaltyToApplyIfPaidNow: number;
};

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isGroupRecord(x: unknown): x is GroupRecord {
  return isRecord(x);
}

function isPaymentRecord(x: unknown): x is PaymentRecord {
  return isRecord(x);
}

function monthsElapsedSinceStart(startIso?: string) {
  if (!startIso) return 1;
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return 1;
  const n = new Date();
  let months =
    (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(1, months + 1);
}

function getPaymentMonthIndex(
  p: PaymentRecord,
  groupStartDate: unknown,
  currentMonthIndex: number,
): number {
  if (typeof p.monthIndex === "number") return p.monthIndex;

  if (Array.isArray(p.allocated) && p.allocated.length > 0) {
    const first = p.allocated[0];
    if (isRecord(first) && typeof first.monthIndex === "number") {
      return first.monthIndex + 1;
    }
  }

  if (isRecord(p.allocation) && typeof p.allocation.monthIndex === "number") {
    return p.allocation.monthIndex;
  }

  const dateRaw =
    typeof p.date === "string"
      ? p.date
      : typeof p.createdAt === "string"
      ? p.createdAt
      : undefined;

  if (typeof groupStartDate === "string" && dateRaw) {
    const start = new Date(groupStartDate);
    const d = new Date(dateRaw);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(d.getTime())) {
      return (
        (d.getFullYear() - start.getFullYear()) * 12 +
        (d.getMonth() - start.getMonth()) +
        1
      );
    }
  }

  return currentMonthIndex;
}

export default function PaymentWidget({ memberId, groupId }: Props) {
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [amountInput, setAmountInput] = useState(""); // string, parsed to number via memo
  const [note, setNote] = useState("");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  // fetch group and member payments
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const groupUrl = `/api/chitgroups/${encodeURIComponent(groupId)}`;
        const paymentsUrl = `/api/chitgroups/${encodeURIComponent(
          groupId,
        )}/payments?memberId=${encodeURIComponent(memberId)}&all=true`;

        const [gRes, pRes] = await Promise.all([
          fetch(groupUrl, { credentials: "include" }),
          fetch(paymentsUrl, { credentials: "include" }),
        ]);

        const gJson: unknown = await gRes.json().catch(() => ({}));
        const pJson: unknown = await pRes.json().catch(() => []);

        if (!mounted) return;

        // group can be object or { data: object }
        let groupCandidate: unknown = gJson;
        if (
          isRecord(groupCandidate) &&
          groupCandidate.data &&
          isRecord(groupCandidate.data)
        ) {
          groupCandidate = groupCandidate.data;
        }
        setGroup(isGroupRecord(groupCandidate) ? groupCandidate : null);

        // payments: [], { payments: [] }, { data: [] }
        let payArr: unknown[] = [];
        if (Array.isArray(pJson)) {
          payArr = pJson;
        } else if (isRecord(pJson) && Array.isArray(pJson.payments)) {
          payArr = pJson.payments;
        } else if (isRecord(pJson) && Array.isArray(pJson.data)) {
          payArr = pJson.data;
        }
        setPayments(payArr.filter(isPaymentRecord));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [groupId, memberId]);

  // per-member installment for this group
  const perMemberInstallment = useMemo(() => {
    if (!group) return 0;
    const monthlyFromModel = safeNum(
      group.monthlyInstallment ?? group.monthly ?? 0,
    );
    const chitValue = safeNum(group.chitValue ?? group.totalAmount ?? 0);
    const totalMonths = Math.max(
      1,
      safeNum(group.totalMonths ?? group.numberOfInstallments ?? 1),
    );

    if (monthlyFromModel > 0) return Math.round(monthlyFromModel);
    if (chitValue > 0 && totalMonths > 0) {
      return Math.round(chitValue / totalMonths);
    }
    return 0;
  }, [group]);

  // month index based on group start date
  const currentMonthIndex = useMemo(
    () =>
      monthsElapsedSinceStart(
        typeof group?.startDate === "string"
          ? group.startDate
          : undefined,
      ),
    [group],
  );

  // numeric parsed amount from input
  const amountNumber = useMemo(() => {
    const n = Number(amountInput.trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountInput]);

  // how much already paid this month
  const alreadyPaidThisMonth = useMemo(() => {
    if (!Array.isArray(payments) || !group) return 0;
    let sum = 0;
    for (const p of payments) {
      const idx = getPaymentMonthIndex(
        p,
        group.startDate,
        currentMonthIndex,
      );
      if (idx === currentMonthIndex) {
        sum += safeNum(p.amount);
      }
    }
    return sum;
  }, [payments, group, currentMonthIndex]);

  // overdue previous months & penalty
  const overdueInfo = useMemo<OverdueInfo>(() => {
    const res: OverdueInfo = {
      remainingPerMonth: new Map(),
      totalOverdueRemaining: 0,
      penaltyToApplyIfPaidNow: 0,
    };
    if (!Array.isArray(payments) || !group) return res;

    const per = perMemberInstallment;
    const penaltyPercent = safeNum(
      group.penaltyPercent ?? group.penalty ?? group.penalty_rate ?? 0,
    );

    // paid per month
    const paidMap = new Map<number, number>();
    for (const p of payments) {
      const idx = getPaymentMonthIndex(
        p,
        group.startDate,
        currentMonthIndex,
      );
      paidMap.set(idx, (paidMap.get(idx) ?? 0) + safeNum(p.amount));
    }

    for (let mi = 1; mi < currentMonthIndex; mi += 1) {
      const paid = paidMap.get(mi) ?? 0;
      const remaining = Math.max(0, per - paid);
      if (remaining <= 0) continue;

      const monthsOverdue = currentMonthIndex - mi;
      let remWithPenalty = remaining;
      for (let k = 0; k < monthsOverdue; k += 1) {
        remWithPenalty *= 1 + penaltyPercent / 100;
      }
      const penaltyNow = Math.round(remWithPenalty - remaining);

      res.remainingPerMonth.set(mi, remaining);
      res.totalOverdueRemaining += remaining;
      res.penaltyToApplyIfPaidNow += penaltyNow;
    }

    return res;
  }, [payments, group, perMemberInstallment, currentMonthIndex]);

  const monthlyRemaining = useMemo(() => {
    const per = perMemberInstallment;
    return Math.max(0, per - alreadyPaidThisMonth);
  }, [perMemberInstallment, alreadyPaidThisMonth]);

  // UPI + QR
  const upiId =
    (group && typeof group.upiId === "string" ? group.upiId : undefined) ??
    (group && typeof group.merchantUpi === "string"
      ? group.merchantUpi
      : undefined) ??
    process.env.NEXT_PUBLIC_DEFAULT_UPI ??
    "";

  const payeeName =
    (group && typeof group.name === "string"
      ? group.name
      : undefined) ??
    (group && typeof group.groupName === "string"
      ? group.groupName
      : undefined) ??
    "ChitFund";

  const upiString = useMemo(() => {
    const amt = amountNumber > 0 ? String(amountNumber) : "";
    const base = `upi://pay?pa=${encodeURIComponent(
      upiId,
    )}&pn=${encodeURIComponent(payeeName)}${
      amt ? `&am=${encodeURIComponent(amt)}` : ""
    }&cu=INR`;
    const notePart = note ? `&tn=${encodeURIComponent(note)}` : "";
    return base + notePart;
  }, [amountNumber, upiId, payeeName, note]);

  const qrSrc = useMemo(() => {
    if (!upiString) return "";
    return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(
      upiString,
    )}&chld=M|0`;
  }, [upiString]);

  function onFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files && ev.target.files[0];
    setFile(f ?? null);
  }

  async function submitPaymentRequest() {
    setError(null);
    if (!memberId) {
      setError("Member not available");
      return;
    }
    if (!group) {
      setError("Group data not loaded");
      return;
    }
    if (amountNumber <= 0) {
      setError("Enter an amount to pay");
      return;
    }

    const cap = monthlyRemaining;
    if (amountNumber > cap) {
      setError(
        `You may only pay up to ₹${cap.toLocaleString()} for this month (remaining).`,
      );
      return;
    }

    const monthIndex = currentMonthIndex;

    setSubmitting(true);
    try {
      const url = `/api/chitgroups/${encodeURIComponent(
        groupId,
      )}/payments/request`;
      const fd = new FormData();
      fd.append("memberId", memberId);
      fd.append("amount", String(amountNumber));
      fd.append("monthIndex", String(monthIndex));
      if (note) fd.append("note", note);
      if (utr) fd.append("utr", utr);
      if (file) fd.append("file", file);

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          isRecord(j) && typeof j.error === "string"
            ? j.error
            : isRecord(j) && typeof j.message === "string"
            ? j.message
            : res.statusText;
        throw new Error(msg || "Failed to submit payment request");
      }

      // clear fields
      setAmountInput("");
      setNote("");
      setUtr("");
      setFile(null);
      setQrVisible(false);

      // refresh payments
      const paymentsUrl = `/api/chitgroups/${encodeURIComponent(
        groupId,
      )}/payments?memberId=${encodeURIComponent(memberId)}&all=true`;
      const pRes = await fetch(paymentsUrl, { credentials: "include" });
      const pJson: unknown = await pRes.json().catch(() => []);

      let payArr: unknown[] = [];
      if (Array.isArray(pJson)) {
        payArr = pJson;
      } else if (isRecord(pJson) && Array.isArray(pJson.payments)) {
        payArr = pJson.payments;
      } else if (isRecord(pJson) && Array.isArray(pJson.data)) {
        payArr = pJson.data;
      }
      setPayments(payArr.filter(isPaymentRecord));

      // eslint-disable-next-line no-alert
      alert("Payment submitted as pending. Admin will approve to credit.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function payFullMonth() {
    setAmountInput(monthlyRemaining.toString());
    setQrVisible(true);
  }

  return (
    <div className="bg-[var(--bg-main)] p-3 rounded-md border">
      <div className="text-sm text-gray-600 mb-2">Your due this month</div>

      <div className="flex flex-wrap items-baseline gap-4">
        <div>
          <div className="text-xs text-gray-500">Installment</div>
          <div className="text-lg font-semibold">
            ₹{perMemberInstallment.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Already paid this month</div>
          <div className="text-lg">
            ₹{alreadyPaidThisMonth.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">Remaining (this month)</div>
          <div className="text-lg font-semibold">
            ₹{monthlyRemaining.toLocaleString()}
          </div>
        </div>
      </div>

      {overdueInfo.totalOverdueRemaining > 0 && (
        <div className="mt-3 p-2 rounded bg-yellow-50 border border-yellow-200 text-sm">
          <div className="font-medium">Overdue amount</div>
          <div>
            Unpaid from previous months: ₹
            {overdueInfo.totalOverdueRemaining.toLocaleString()}
          </div>
          <div className="text-xs text-gray-600">
            Penalty to apply now (approx): ₹
            {Math.round(
              overdueInfo.penaltyToApplyIfPaidNow,
            ).toLocaleString()}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">Amount to pay (₹)</label>
          <input
            value={amountInput}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (!v) {
                setAmountInput("");
                setQrVisible(false);
                return;
              }
              const n = Number(v);
              if (Number.isNaN(n)) return;
              setAmountInput(v);
            }}
            type="number"
            min={0}
            step="1"
            className="w-full p-2 rounded border"
            placeholder={`Max ₹${monthlyRemaining}`}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">UTR / Ref (optional)</label>
          <input
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            className="w-full p-2 rounded border"
            placeholder="Enter UTR or reference"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-2 rounded border"
            placeholder="Description (appears in UPI note)"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">
            Upload screenshot / receipt (optional)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={onFileChange}
            className="w-full p-1"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={payFullMonth}
          disabled={monthlyRemaining <= 0}
          className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Pay full month
        </button>

        <button
          type="button"
          onClick={() => setQrVisible((s) => !s)}
          disabled={amountNumber <= 0}
          className="px-3 py-2 bg-gray-200 rounded"
        >
          Generate UPI QR
        </button>

        <button
          type="button"
          onClick={submitPaymentRequest}
          disabled={submitting || amountNumber <= 0}
          className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit payment (pending approval)"}
        </button>
      </div>

      {qrVisible && amountNumber > 0 && (
        <div className="mt-3 border rounded p-3">
          <div className="mb-2 text-sm text-gray-600">Scan to pay via UPI</div>
          {upiId ? (
            <div className="flex flex-wrap gap-4 items-center">
              {qrSrc ? (
                <Image
                  src={qrSrc}
                  alt="UPI QR"
                  width={180}
                  height={180}
                  className="rounded"
                />
              ) : (
                <div className="w-[180px] h-[180px] grid place-items-center text-xs">
                  Generating QR…
                </div>
              )}
              <div className="text-sm">
                <div className="font-medium">UPI ID</div>
                <div className="text-xs text-gray-700 mb-2">{upiId}</div>
                <div className="font-medium">UPI String</div>
                <div className="text-xs break-all">{upiString}</div>
                <div className="mt-2 text-xs text-gray-500">
                  After paying, paste UTR or upload screenshot and press Submit
                  (payment will remain pending until admin approves it).
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-red-600">
              No UPI ID configured for this group. Please contact admin.
            </div>
          )}
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      {loading && (
        <div className="mt-2 text-sm text-gray-600">Loading account data…</div>
      )}
    </div>
  );
}
