"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { FC } from "react";

type UnknownRecord = Record<string, unknown>;

type BidPanelProps = {
  chitId: string;
  memberId: string;
  chitValue: number;
  isBiddingOpen: boolean;
  currentMonthIndex: number;
};

type BidRow = {
  id: string;
  memberId: string;
  memberName?: string;
  discount: number;
  bidAmount: number;
  createdAt?: string;
};

type AuctionInfo = {
  monthIndex: number;
  winningMemberId: string;
  winningDiscount: number;
  winningPayout: number;
  winningBidAmount?: number;
};

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

const fmtMoney = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const BidPanel: FC<BidPanelProps> = ({
  chitId,
  memberId,
  chitValue,
  isBiddingOpen,
  currentMonthIndex,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [bids, setBids] = useState<BidRow[]>([]);
  const [myBidAmount, setMyBidAmount] = useState<number | "">("");

  const [metaPot, setMetaPot] = useState<number | null>(null);
  const [adminCommissionAmount, setAdminCommissionAmount] =
    useState<number>(0);
  const [metaTotalMembers, setMetaTotalMembers] =
    useState<number | null>(null);

  const [apiBiddingOpen, setApiBiddingOpen] = useState(false);
  const [apiBiddingMonth, setApiBiddingMonth] = useState<number | null>(
    null,
  );

  const [blockedWinners, setBlockedWinners] = useState<string[]>([]);
  const [auctionInfo, setAuctionInfo] = useState<AuctionInfo | null>(null);

  const [memberNames, setMemberNames] = useState<Record<string, string>>(
    {},
  );

  const monthLabel = useMemo(
    () => `Month #${currentMonthIndex}`,
    [currentMonthIndex],
  );

  const basePot = useMemo(
    () => (metaPot && metaPot > 0 ? metaPot : chitValue || 0),
    [metaPot, chitValue],
  );

  const minAllowedBid = useMemo(
    () => basePot + adminCommissionAmount,
    [basePot, adminCommissionAmount],
  );

  const effectiveBiddingOpen = useMemo(() => {
    if (isBiddingOpen) return true;
    if (
      apiBiddingOpen &&
      (apiBiddingMonth === null || apiBiddingMonth === currentMonthIndex)
    ) {
      return true;
    }
    return false;
  }, [isBiddingOpen, apiBiddingOpen, apiBiddingMonth, currentMonthIndex]);

  const topBid = useMemo(() => {
    if (!bids.length) return null;
    return bids.reduce((best, b) =>
      b.bidAmount > best.bidAmount ? b : best,
    );
  }, [bids]);

  const isWinnerThisMonth = useMemo(() => {
    if (!auctionInfo) return false;
    if (auctionInfo.monthIndex !== currentMonthIndex) return false;
    return auctionInfo.winningMemberId === memberId;
  }, [auctionInfo, currentMonthIndex, memberId]);

  const isBlockedFromBidding = useMemo(() => {
    if (!memberId) return false;
    if (isWinnerThisMonth) return true;
    return blockedWinners.includes(memberId);
  }, [blockedWinners, memberId, isWinnerThisMonth]);

  const canPlaceBid = useMemo(
    () =>
      effectiveBiddingOpen &&
      !isBlockedFromBidding &&
      !loading &&
      !submitting,
    [effectiveBiddingOpen, isBlockedFromBidding, loading, submitting],
  );

  const getMemberLabel = (row: { memberId: string; memberName?: string }) => {
    const mapped = memberNames[row.memberId];
    if (mapped && mapped.trim() !== "") return mapped;
    if (row.memberName && row.memberName.trim() !== "") return row.memberName;
    return row.memberId;
  };

  // MAIN DATA LOAD
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!chitId) return;
      setLoading(true);
      setErrorText(null);
      try {
        const bidsUrl = `/api/chitgroups/${encodeURIComponent(
          chitId,
        )}/bids?monthIndex=${encodeURIComponent(currentMonthIndex)}`;
        const [bidsRes, auctionRes] = await Promise.all([
          fetch(bidsUrl, { credentials: "include" }),
          fetch(
            `/api/chitgroups/${encodeURIComponent(
              chitId,
            )}/auction?monthIndex=${encodeURIComponent(currentMonthIndex)}`,
            { credentials: "include" },
          ),
        ]);

        const bidsJson: unknown = await bidsRes.json().catch(() => ({}));
        if (!alive) return;

        if (!bidsRes.ok) {
          const msg =
            typeof bidsJson === "object" && bidsJson !== null
              ? String(
                  (bidsJson as {
                    error?: unknown;
                    message?: unknown;
                  }).error ??
                    (bidsJson as {
                      error?: unknown;
                      message?: unknown;
                    }).message ??
                    bidsRes.statusText,
                )
              : bidsRes.statusText;
          setErrorText(msg);
          setBids([]);
        } else {
          const obj =
            bidsJson && typeof bidsJson === "object" && !Array.isArray(bidsJson)
              ? (bidsJson as UnknownRecord)
              : ({} as UnknownRecord);

          const metaRaw = obj.meta as UnknownRecord | undefined;
          const expectedMonthlyTotal = metaRaw
            ? toNum(metaRaw.expectedMonthlyTotal)
            : 0;
          setMetaPot(expectedMonthlyTotal || null);

          const adminFromMeta = metaRaw
            ? toNum(
                metaRaw.adminCommissionAmount ??
                  (metaRaw as { adminCommission?: unknown }).adminCommission,
              )
            : 0;
          const admin =
            adminFromMeta > 0
              ? adminFromMeta
              : Math.round(expectedMonthlyTotal * 0.04);
          setAdminCommissionAmount(admin);

          const totalMembersFromMeta = metaRaw
            ? toNum(metaRaw.totalMembers)
            : 0;
          setMetaTotalMembers(
            totalMembersFromMeta > 0 ? totalMembersFromMeta : null,
          );

          const bArrRaw = Array.isArray(obj.bids) ? obj.bids : [];
          const rows: BidRow[] = bArrRaw.map((raw) => {
            const r = raw as UnknownRecord;
            const id = toStr(
              r._id ?? r.id ?? Math.random().toString(36).slice(2),
            );
            const mId = toStr(r.memberId ?? "");
            const memberName =
              typeof r.memberName === "string" && r.memberName.trim()
                ? r.memberName.trim()
                : undefined;
            const discount = toNum(
              r.discount ?? r.discountOffered ?? r.amount ?? 0,
            );
            const bidAmountRaw = toNum(r.bidAmount ?? 0);
            const bidAmount =
              bidAmountRaw > 0
                ? bidAmountRaw
                : expectedMonthlyTotal + admin + discount;
            const createdAt =
              typeof r.createdAt === "string"
                ? r.createdAt
                : typeof r.date === "string"
                ? r.date
                : undefined;
            return {
              id,
              memberId: mId,
              memberName,
              discount,
              bidAmount,
              createdAt,
            };
          });

          setBids(rows);

          const apiFlag =
            obj.biddingOpen === true ||
            (obj as { bidding_open?: unknown }).bidding_open === true ||
            (obj as { isBiddingOpen?: unknown }).isBiddingOpen === true;
          setApiBiddingOpen(apiFlag);

          const apiMonth = toNum(
            (obj.biddingMonthIndex ??
              (obj as { bidding_month_index?: unknown })
                .bidding_month_index) ?? null,
          );
          setApiBiddingMonth(
            Number.isFinite(apiMonth) && apiMonth > 0 ? apiMonth : null,
          );

          const bwRaw = (obj as { blockedWinners?: unknown }).blockedWinners;
          const bw: string[] = Array.isArray(bwRaw)
            ? (bwRaw as unknown[]).map(toStr).filter((x) => x !== "")
            : [];
          setBlockedWinners(bw);
        }

        // AUCTION INFO
        const auctionJson: unknown = await auctionRes.json().catch(() => ({}));
        if (!alive) return;

        if (auctionRes.ok && auctionJson && typeof auctionJson === "object") {
          const root = auctionJson as UnknownRecord;
          const rawAuction =
            (root.auction && typeof root.auction === "object"
              ? (root.auction as UnknownRecord)
              : null) ??
            (root.data && typeof root.data === "object"
              ? (root.data as UnknownRecord)
              : null);

          if (rawAuction) {
            const winningMemberId = toStr(
              rawAuction.winningMemberId ??
                (rawAuction as { winner?: unknown }).winner ??
                "",
            );

            let winningDiscount = toNum(
              rawAuction.winningDiscount ??
                (rawAuction as { discountOffered?: unknown })
                  .discountOffered ??
                0,
            );

            const totalPotFromState =
              metaPot && metaPot > 0 ? metaPot : 0;
            const totalPot =
              totalPotFromState > 0 ? totalPotFromState : chitValue || 0;
            const adminFromState = adminCommissionAmount || Math.round(totalPot * 0.04);

            let winningBidAmount = toNum(
              (rawAuction as { winningBidAmount?: unknown })
                .winningBidAmount ??
                (rawAuction as { totalBidAmount?: unknown })
                  .totalBidAmount ??
                (rawAuction as { bidAmount?: unknown }).bidAmount ??
                0,
            );

            if (!winningDiscount && winningBidAmount > 0 && totalPot > 0) {
              const basePlusAdmin = totalPot + adminFromState;
              const diff = winningBidAmount - basePlusAdmin;
              winningDiscount = diff > 0 ? diff : 0;
            }

            if (!winningBidAmount && totalPot > 0) {
              winningBidAmount = totalPot + adminFromState + winningDiscount;
            }

            let winningPayout = toNum(
              rawAuction.winningPayout ?? rawAuction.payoutToWinner ?? 0,
            );
            if (!winningPayout && totalPot > 0) {
              winningPayout = Math.max(
                0,
                totalPot - winningDiscount - adminFromState,
              );
            }

            const monthIndex = toNum(
              rawAuction.monthIndex ??
                (rawAuction as { biddingMonthIndex?: unknown })
                  .biddingMonthIndex ??
                currentMonthIndex,
            );

            if (winningMemberId) {
              setAuctionInfo({
                monthIndex:
                  Number.isFinite(monthIndex) && monthIndex > 0
                    ? monthIndex
                    : currentMonthIndex,
                winningMemberId,
                winningDiscount,
                winningPayout,
                winningBidAmount,
              });
            } else {
              setAuctionInfo(null);
            }

            const bwFromAuction = (rawAuction as {
              blockedWinners?: unknown;
            }).blockedWinners;
            if (Array.isArray(bwFromAuction)) {
              const bwExtra = (bwFromAuction as unknown[])
                .map(toStr)
                .filter((x) => x !== "");
              if (bwExtra.length) {
                setBlockedWinners((prev) => {
                  const all = new Set<string>([...prev, ...bwExtra]);
                  return Array.from(all);
                });
              }
            }
          } else {
            setAuctionInfo(null);
          }
        } else {
          setAuctionInfo(null);
        }
      } catch (err) {
        if (!alive) return;
        setErrorText(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chitId, currentMonthIndex, chitValue]);

  // MEMBER NAMES
  useEffect(() => {
    if (!bids.length) return;

    const controller = new AbortController();
    const { signal } = controller;

    const uniqueIds = Array.from(
      new Set(bids.map((b) => b.memberId).filter((id) => id !== "")),
    ).filter((id) => !memberNames[id]);

    if (!uniqueIds.length) return;

    uniqueIds.forEach((id) => {
      (async () => {
        try {
          const res = await fetch(
            `/api/members/${encodeURIComponent(id)}`,
            { credentials: "include", signal },
          );
          const json: unknown = await res.json().catch(() => ({}));

          if (!res.ok || !json || typeof json !== "object") return;

          const root = json as UnknownRecord;
          const obj =
            (root.member && typeof root.member === "object"
              ? (root.member as UnknownRecord)
              : root);

          const name = toStr(
            (obj as { name?: unknown }).name ??
              (obj as { fullName?: unknown }).fullName ??
              (obj as { memberName?: unknown }).memberName ??
              (obj as { displayName?: unknown }).displayName ??
              "",
          );

          if (!name) return;

          setMemberNames((prev) =>
            prev[id] && prev[id].trim() !== "" ? prev : { ...prev, [id]: name },
          );
        } catch (err) {
          if (signal.aborted) return;
        }
      })();
    });

    return () => {
      controller.abort();
    };
  }, [bids, memberNames]);

  async function submitBid() {
    setErrorText(null);

    if (!canPlaceBid) {
      if (!effectiveBiddingOpen) {
        setErrorText("Bidding is not open right now.");
      } else if (isBlockedFromBidding) {
        setErrorText(
          "You have already won an auction in this chit. You cannot bid again.",
        );
      }
      return;
    }

    if (!memberId) {
      setErrorText("Member not identified.");
      return;
    }

    if (typeof myBidAmount !== "number" || myBidAmount <= 0) {
      setErrorText("Enter a valid bid amount.");
      return;
    }

    if (myBidAmount < minAllowedBid) {
      setErrorText(
        `Minimum allowed bid for this month is ${fmtMoney(
          minAllowedBid,
        )} (base pot + admin commission).`,
      );
      return;
    }

    const currentTop = topBid ? topBid.bidAmount : minAllowedBid;
    if (myBidAmount <= currentTop) {
      setErrorText(
        `Your bid must be higher than the current top bid ${fmtMoney(currentTop)}.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/chitgroups/${encodeURIComponent(chitId)}/bids`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            memberId,
            bidAmount: myBidAmount,
            monthIndex: currentMonthIndex,
          }),
        },
      );

      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof json === "object" && json !== null
            ? String(
                (json as { error?: unknown; message?: unknown }).error ??
                  (json as { error?: unknown; message?: unknown }).message ??
                  res.statusText,
              )
            : res.statusText;
        throw new Error(msg);
      }

      const refUrl = `/api/chitgroups/${encodeURIComponent(
        chitId,
      )}/bids?monthIndex=${encodeURIComponent(currentMonthIndex)}`;
      const refRes = await fetch(refUrl, { credentials: "include" });
      const refJson: unknown = await refRes.json().catch(() => ({}));

      if (refRes.ok && refJson && typeof refJson === "object") {
        const obj = refJson as UnknownRecord;
        const metaRaw = obj.meta as UnknownRecord | undefined;
        const expectedMonthlyTotal = metaRaw
          ? toNum(metaRaw.expectedMonthlyTotal)
          : 0;
        const adminFromMeta = metaRaw
          ? toNum(
              metaRaw.adminCommissionAmount ??
                (metaRaw as { adminCommission?: unknown }).adminCommission,
            )
          : adminCommissionAmount;
        const admin =
          adminFromMeta > 0
            ? adminFromMeta
            : Math.round(expectedMonthlyTotal * 0.04);

        const bArrRaw = Array.isArray(obj.bids) ? obj.bids : [];
        const rows: BidRow[] = bArrRaw.map((raw) => {
          const r = raw as UnknownRecord;
          const id = toStr(
            r._id ?? r.id ?? Math.random().toString(36).slice(2),
          );
          const mId = toStr(r.memberId ?? "");
          const memberName =
            typeof r.memberName === "string" && r.memberName.trim()
              ? r.memberName.trim()
              : undefined;
          const discount = toNum(
            r.discount ?? r.discountOffered ?? r.amount ?? 0,
          );
          const bidAmountRaw = toNum(r.bidAmount ?? 0);
          const bidAmount =
            bidAmountRaw > 0
              ? bidAmountRaw
              : expectedMonthlyTotal + admin + discount;
          const createdAt =
            typeof r.createdAt === "string"
              ? r.createdAt
              : typeof r.date === "string"
              ? r.date
              : undefined;
          return {
            id,
            memberId: mId,
            memberName,
            discount,
            bidAmount,
            createdAt,
          };
        });
        setBids(rows);
      }

      setMyBidAmount("");
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const myCurrentBid = useMemo(() => {
    if (!memberId || !bids.length) return null;
    return bids.find((b) => b.memberId === memberId) ?? null;
  }, [bids, memberId]);

  const winnerBanner = useMemo(() => {
    if (!auctionInfo) return null;
    if (auctionInfo.monthIndex !== currentMonthIndex) return null;
    const isMe = auctionInfo.winningMemberId === memberId;

    const rowForWinner =
      bids.find((b) => b.memberId === auctionInfo.winningMemberId) ?? null;

    const labelName = rowForWinner
      ? getMemberLabel(rowForWinner)
      : memberNames[auctionInfo.winningMemberId] ??
        auctionInfo.winningMemberId;

    const totalMembers =
      metaTotalMembers && metaTotalMembers > 0
        ? metaTotalMembers
        : undefined;

    const perMemberDiscount =
      totalMembers && auctionInfo.winningDiscount > 0
        ? Math.round(auctionInfo.winningDiscount / totalMembers)
        : null;

    const pot = basePot;
    const admin = adminCommissionAmount;

    return (
      <div className="mb-2 text-[11px] sm:text-xs rounded border border-emerald-400 bg-emerald-50 px-2 py-1">
        <div className="font-semibold text-emerald-700">
          Auction completed for this month.
        </div>
        <div className="text-emerald-700">
          Winner: <span className="font-semibold">{labelName}</span>{" "}
          {isMe ? "(you)" : null} • Discount for members:{" "}
          <span className="font-semibold">
            {fmtMoney(auctionInfo.winningDiscount)}
          </span>{" "}
          • Payout to winner:{" "}
          <span className="font-semibold">
            {fmtMoney(auctionInfo.winningPayout)}
          </span>
        </div>
        <div className="text-[10px] sm:text-[11px] text-emerald-800 mt-1">
          Pot this month {fmtMoney(pot)}, admin commission approx{" "}
          {fmtMoney(admin)}. Members share discount{" "}
          {fmtMoney(auctionInfo.winningDiscount)}
          {perMemberDiscount && totalMembers
            ? ` ≈ ${fmtMoney(perMemberDiscount)} per member (${totalMembers} members).`
            : "."}
        </div>
        {isMe && (
          <div className="text-[10px] sm:text-[11px] text-emerald-800 mt-1">
            You have won this chit month. You cannot place further bids in this
            chit.
          </div>
        )}
      </div>
    );
  }, [
    auctionInfo,
    currentMonthIndex,
    memberId,
    bids,
    memberNames,
    basePot,
    adminCommissionAmount,
    metaTotalMembers,
  ]);

  return (
    <div className="border rounded-lg p-1 sm:p-4 bg-white text-xs sm:text-sm space-y-2 w-70 sm:w-auto">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="font-semibold">Bids</div>
        <div className="text-[11px] text-gray-500">{monthLabel}</div>
      </div>

      <div className="text-[11px] sm:text-xs mb-2">
        {effectiveBiddingOpen ? (
          <span className="text-green-600 font-medium">
            Bidding is OPEN. Enter your bid below.
          </span>
        ) : (
          <span className="text-red-600">
            Bidding is CLOSED. Wait for admin to start next round.
          </span>
        )}
      </div>

      {isBlockedFromBidding && (
        <div className="mb-2 text-[10px] sm:text-[11px] text-amber-700">
          You have already won an auction in this chit. You can view bids but
          cannot place new ones.
        </div>
      )}

      {winnerBanner}

      {topBid ? (
        <div className="mb-2 text-[11px] sm:text-xs">
          <div>
            Top bid:{" "}
            <span className="font-semibold">
              {fmtMoney(topBid.bidAmount)} (discount{" "}
              {fmtMoney(topBid.discount)})
            </span>
          </div>
          <div>
            by{" "}
            {topBid.memberId === memberId
              ? `${getMemberLabel(topBid)} (you)`
              : getMemberLabel(topBid)}
          </div>
        </div>
      ) : (
        <div className="mb-2 text-[11px] text-gray-500">
          No bids for this month yet.
        </div>
      )}

      <div className="mb-1 text-[11px] text-gray-500">
        Base pot (expected this month):{" "}
        <span className="font-semibold">{fmtMoney(basePot)}</span>
      </div>
      <div className="mb-3 text-[11px] text-gray-500 space-y-0.5">
        <div>
          Admin commission:{" "}
          <span className="font-semibold">
            {fmtMoney(adminCommissionAmount)} (~4% of pot)
          </span>
        </div>
        <div>
          Minimum bid (base + admin):{" "}
          <span className="font-semibold">{fmtMoney(minAllowedBid)}</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <label className="block text-[11px] text-gray-600 mb-1">
            Enter total bid amount (base pot + admin commission + discount for
            members)
          </label>
          <input
            type="number"
            min={minAllowedBid || 0}
            value={myBidAmount === "" ? "" : myBidAmount}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (!v) {
                setMyBidAmount("");
                return;
              }
              const n = Number(v);
              if (Number.isNaN(n)) return;
              setMyBidAmount(n);
            }}
            disabled={!canPlaceBid}
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder={
              minAllowedBid
                ? `min ${fmtMoney(minAllowedBid)} • e.g. ${fmtMoney(
                    minAllowedBid + 5000,
                  )}`
                : "Enter bid"
            }
          />
        </div>
        {myCurrentBid && (
          <div className="text-[11px] text-gray-600">
            Your current bid:{" "}
            <span className="font-semibold">
              {fmtMoney(myCurrentBid.bidAmount)} (discount{" "}
              {fmtMoney(myCurrentBid.discount)})
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={submitBid}
          disabled={
            !canPlaceBid ||
            typeof myBidAmount !== "number" ||
            myBidAmount <= 0
          }
          className="w-full sm:w-auto px-3 py-1.5 rounded bg-indigo-600 text-white text-[11px] sm:text-xs disabled:opacity-60"
        >
          {submitting ? "Placing bid…" : "Place Bid"}
        </button>
      </div>

      <div className="mt-2">
        <div className="font-medium text-[11px] sm:text-xs mb-1">
          All bids for this month
        </div>
        {bids.length === 0 ? (
          <div className="text-[11px] text-gray-500">No bids yet.</div>
        ) : (
          <div className="max-h-48 overflow-y-auto overflow-x-auto">
            <table className="w-full min-w-[410px] text-left text-[11px]">
              <thead>
                <tr className="text-gray-500">
                  <th className="p-1">Member</th>
                  <th className="p-1">Bid</th>
                  <th className="p-1">Discount</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-1">
                      {b.memberId === memberId
                        ? `${getMemberLabel(b)} (you)`
                        : getMemberLabel(b)}
                    </td>
                    <td className="p-1">{fmtMoney(b.bidAmount)}</td>
                    <td className="p-1">{fmtMoney(b.discount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {errorText && (
        <div className="mt-2 text-[11px] text-red-600">
          {errorText}
        </div>
      )}
      {loading && (
        <div className="mt-1 text-[11px] text-gray-500">
          Loading bids…
        </div>
      )}
    </div>
  );
};

export default BidPanel;
