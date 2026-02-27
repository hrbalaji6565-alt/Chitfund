"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCcw, Plus, Trash2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store/store";
import { fetchGroups } from "@/store/chitGroupSlice";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

type UnknownRecord = Record<string, unknown>;

type GroupLite = {
  id: string;
  name: string;
  totalMonths: number;
};

type SlotOption = {
  memberId: string;
  memberName: string;
  slotId: string;
  slotLabel: string;
  slotIndex: number;
};

type AllocationRow = {
  id: string;
  monthIndex: string;
  amount: string;
};

type SlotProgress = {
  slotId: string;
  memberName: string;
  paidTillMonth: number;
  nextMonth: number;
  monthAmounts: Array<{ monthIndex: number; amount: number }>;
  monthPenalties: Array<{ monthIndex: number; penaltyAmount: number }>;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const makeRowId = () =>
  `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default function AdminChitAdjustmentsPage() {
  const dispatch = useDispatch<AppDispatch>();

  const groupsSlice = useSelector(
    (s: RootState) =>
      (s as unknown as Record<string, unknown>).chitGroups as
        | Record<string, unknown>
        | undefined,
  );

  const groups = useMemo<GroupLite[]>(() => {
    const raw = Array.isArray(groupsSlice?.groups) ? groupsSlice?.groups : [];
    return raw
      .filter(isRecord)
      .map((g) => ({
        id: toStr(g._id ?? g.id),
        name: toStr(g.name ?? g.groupName ?? g._id ?? g.id),
        totalMonths: Math.max(1, Math.round(toNum(g.totalMonths) || 1)),
      }))
      .filter((g) => !!g.id);
  }, [groupsSlice]);

  const [groupId, setGroupId] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotProgress, setSlotProgress] = useState<SlotProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const [rows, setRows] = useState<AllocationRow[]>([
    { id: makeRowId(), monthIndex: "1", amount: "0" },
  ]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [forceLedgerDueAmount, setForceLedgerDueAmount] = useState(true);
  const [penaltyMonthIndex, setPenaltyMonthIndex] = useState("1");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [applyingPenalty, setApplyingPenalty] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId),
    [groups, groupId],
  );

  const membersForGroup = useMemo(() => {
    const map = new Map<string, { memberId: string; memberName: string; slots: SlotOption[] }>();
    for (const slot of slots) {
      const existing = map.get(slot.memberId);
      if (existing) {
        existing.slots.push(slot);
      } else {
        map.set(slot.memberId, {
          memberId: slot.memberId,
          memberName: slot.memberName,
          slots: [slot],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.memberName.toLowerCase().localeCompare(b.memberName.toLowerCase()),
    );
  }, [slots]);

  useEffect(() => {
    dispatch(fetchGroups());
  }, [dispatch]);

  useEffect(() => {
    if (!groupId) {
      setSlots([]);
      setSelectedSlotIds([]);
      return;
    }

    let cancelled = false;
    const loadGroupSlots = async () => {
      setLoadingSlots(true);
      setErrorText(null);
      setSuccessText(null);
      try {
        const res = await fetch(`/api/chitgroups/${encodeURIComponent(groupId)}`, {
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as UnknownRecord;
        if (!res.ok || !isRecord(json)) {
          throw new Error(toStr(json.error || json.message || "Failed to load group members"));
        }

        const groupObj = isRecord(json.group) ? json.group : {};
        const membersRaw = Array.isArray(groupObj.members) ? groupObj.members : [];
        const nextSlots: SlotOption[] = [];

        for (let i = 0; i < membersRaw.length; i += 1) {
          const rec = membersRaw[i];
          if (!isRecord(rec)) continue;
          const mId = toStr(rec.memberId ?? rec._id ?? rec.id);
          const slotId = toStr(rec.slotId ?? rec.memberSlotId);
          if (!mId || !slotId) continue;
          const mName = toStr(rec.name || mId);
          const slotIndex = i + 1;
          nextSlots.push({
            memberId: mId,
            memberName: mName,
            slotId,
            slotIndex,
            slotLabel: `${mName} (Slot ${slotIndex})`,
          });
        }

        if (!cancelled) {
          setSlots(nextSlots);
          setSelectedSlotIds([]);
        }
      } catch (err) {
        if (!cancelled) {
          setSlots([]);
          setSelectedSlotIds([]);
          setErrorText(err instanceof Error ? err.message : "Failed to load slots");
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };

    void loadGroupSlots();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const suggestedNextMonth = useMemo(() => {
    const maxNext = slotProgress.reduce((acc, item) => Math.max(acc, item.nextMonth), 1);
    const upperBound = selectedGroup?.totalMonths ?? 1;
    return Math.max(1, Math.min(upperBound, maxNext));
  }, [slotProgress, selectedGroup]);

  useEffect(() => {
    if (!groupId || !selectedSlotIds.length) {
      setSlotProgress([]);
      return;
    }

    let cancelled = false;
    const loadProgress = async () => {
      setLoadingProgress(true);
      try {
        const params = new URLSearchParams({
          groupId,
          slotIds: selectedSlotIds.join(","),
        });
        const res = await fetch(`/api/collections/member-month-progress?${params.toString()}`, {
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as UnknownRecord;
        if (!res.ok) {
          throw new Error(toStr(json.message || json.error || "Failed to load month progress"));
        }
        const rowsRaw = Array.isArray(json.rows) ? json.rows : [];
        const rows: SlotProgress[] = rowsRaw
          .filter(isRecord)
          .map((r) => ({
            slotId: toStr(r.slotId),
            memberName: toStr(r.memberName || r.memberId || r.slotId),
            paidTillMonth: Math.max(0, Math.round(toNum(r.paidTillMonth))),
            nextMonth: Math.max(1, Math.round(toNum(r.nextMonth))),
            monthAmounts: (Array.isArray(r.monthAmounts) ? r.monthAmounts : [])
              .filter(isRecord)
              .map((x) => ({
                monthIndex: Math.max(1, Math.round(toNum(x.monthIndex))),
                amount: Math.max(0, Math.round(toNum(x.amount))),
              }))
              .sort((a, b) => a.monthIndex - b.monthIndex),
            monthPenalties: (Array.isArray(r.monthPenalties) ? r.monthPenalties : [])
              .filter(isRecord)
              .map((x) => ({
                monthIndex: Math.max(1, Math.round(toNum(x.monthIndex))),
                penaltyAmount: Math.max(0, Math.round(toNum(x.penaltyAmount))),
              }))
              .sort((a, b) => a.monthIndex - b.monthIndex),
          }))
          .filter((r) => !!r.slotId);

        if (cancelled) return;
        setSlotProgress(rows);
        const suggestedFromRows = rows.reduce(
          (acc, item) => Math.max(acc, item.nextMonth),
          1,
        );

        setRows((prev) => {
          if (prev.length !== 1) return prev;
          if (toNum(prev[0].amount) !== 0 || toNum(prev[0].monthIndex) !== 1) return prev;
          return [{ ...prev[0], monthIndex: String(Math.max(1, suggestedFromRows)) }];
        });
      } catch (err) {
        if (!cancelled) {
          setSlotProgress([]);
          setErrorText(err instanceof Error ? err.message : "Failed to load progress");
        }
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    };

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [groupId, selectedSlotIds]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: makeRowId(), monthIndex: String(suggestedNextMonth), amount: "0" },
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length
        ? next
        : [{ id: makeRowId(), monthIndex: String(suggestedNextMonth), amount: "0" }];
    });
  };

  const updateRow = (id: string, patch: Partial<AllocationRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const toggleSlot = (slotId: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId],
    );
  };

  const setMemberSlotsSelection = (memberId: string, selected: boolean) => {
    const memberSlotIds = slots
      .filter((s) => s.memberId === memberId)
      .map((s) => s.slotId);
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      for (const sid of memberSlotIds) {
        if (selected) next.add(sid);
        else next.delete(sid);
      }
      return Array.from(next);
    });
  };

  const selectAllSlots = () => setSelectedSlotIds(slots.map((s) => s.slotId));
  const clearAllSlots = () => setSelectedSlotIds([]);

  const onSubmit = async () => {
    setErrorText(null);
    setSuccessText(null);

    if (!groupId) return setErrorText("Please select a chit group.");
    if (!selectedSlotIds.length) return setErrorText("Please select at least one slot.");

    const allocations = rows
      .map((r) => ({
        monthIndex: Math.max(1, Math.round(toNum(r.monthIndex || ""))),
        amount: Math.max(0, Math.round(toNum(r.amount || ""))),
      }))
      .filter((r) => r.amount > 0);

    if (!allocations.length) {
      return setErrorText("At least one valid month/amount row is required.");
    }

    try {
      setSubmitting(true);
      const payload = {
        groupId,
        memberSlotIds: selectedSlotIds,
        allocations,
        skipExisting,
        forceLedgerDueAmount,
      };

      const res = await fetch("/api/collections/fill-member-months", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as UnknownRecord;
      if (!res.ok) {
        throw new Error(toStr(json.error || json.message || "Backfill failed"));
      }
      setSuccessText(
        `Done. Slots: ${selectedSlotIds.length} | Created: ${toNum(
          json.totalCreated,
        )} | Skipped existing: ${toNum(json.skippedExisting)}`,
      );
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const applyPenalty = async () => {
    setErrorText(null);
    setSuccessText(null);
    if (!groupId) return setErrorText("Please select a chit group.");
    if (!selectedSlotIds.length) return setErrorText("Please select at least one slot.");
    const parsedPenaltyAmount = Math.max(0, Math.round(toNum(penaltyAmount)));
    if (!parsedPenaltyAmount || parsedPenaltyAmount <= 0) {
      return setErrorText("Penalty amount should be greater than 0.");
    }

    try {
      setApplyingPenalty(true);
      const monthIndex = Math.max(1, Math.round(toNum(penaltyMonthIndex)));
      const memberIdsToApply = Array.from(
        new Set(
          selectedSlotIds
            .map((sid) => slots.find((s) => s.slotId === sid)?.memberId)
            .filter((mid): mid is string => Boolean(mid)),
        ),
      );
      const targets =
        memberIdsToApply.length > 0
          ? memberIdsToApply.map((memberId) => ({ memberId }))
          : selectedSlotIds.map((memberSlotId) => ({ memberSlotId }));

      const results = await Promise.all(
        targets.map(async (target) => {
          const res = await fetch("/api/collections/penalties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              groupId,
              ...target,
              monthIndex,
              penaltyAmount: parsedPenaltyAmount,
            }),
          });
          const json = (await res.json().catch(() => ({}))) as UnknownRecord;
          if (!res.ok) {
            throw new Error(toStr(json.message || json.error || "Failed to apply penalty"));
          }
          return json;
        }),
      );

      setSuccessText(
        `Penalty applied. Members: ${targets.length} | Month: ${monthIndex} | Amount: ₹${Math.round(
          parsedPenaltyAmount,
        ).toLocaleString("en-IN")}`,
      );

      if (results.length) {
        const params = new URLSearchParams({
          groupId,
          slotIds: selectedSlotIds.join(","),
        });
        const res = await fetch(`/api/collections/member-month-progress?${params.toString()}`, {
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as UnknownRecord;
        if (res.ok) {
          const rowsRaw = Array.isArray(json.rows) ? json.rows : [];
          const rows: SlotProgress[] = rowsRaw
            .filter(isRecord)
            .map((r) => ({
              slotId: toStr(r.slotId),
              memberName: toStr(r.memberName || r.memberId || r.slotId),
              paidTillMonth: Math.max(0, Math.round(toNum(r.paidTillMonth))),
              nextMonth: Math.max(1, Math.round(toNum(r.nextMonth))),
              monthAmounts: (Array.isArray(r.monthAmounts) ? r.monthAmounts : [])
                .filter(isRecord)
                .map((x) => ({
                  monthIndex: Math.max(1, Math.round(toNum(x.monthIndex))),
                  amount: Math.max(0, Math.round(toNum(x.amount))),
                }))
                .sort((a, b) => a.monthIndex - b.monthIndex),
              monthPenalties: (Array.isArray(r.monthPenalties) ? r.monthPenalties : [])
                .filter(isRecord)
                .map((x) => ({
                  monthIndex: Math.max(1, Math.round(toNum(x.monthIndex))),
                  penaltyAmount: Math.max(0, Math.round(toNum(x.penaltyAmount))),
                }))
                .sort((a, b) => a.monthIndex - b.monthIndex),
            }))
            .filter((r) => !!r.slotId);
          setSlotProgress(rows);
        }
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : "Failed to apply penalty");
    } finally {
      setApplyingPenalty(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5"
      >
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Adjust Chit Payments
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Custom month entry with multi-member, multi-slot backfill.
        </p>
      </motion.div>

      <Card className="border border-[var(--border-color)] bg-[var(--bg-card)]">
        <CardHeader>
          <CardTitle className="text-[var(--text-primary)]">
            Slot Payment Backfill
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)]">Chit Group</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm"
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end text-xs text-[var(--text-secondary)]">
              {selectedGroup
                ? `Total months: ${selectedGroup.totalMonths}`
                : "Select group to load members/slots"}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-[var(--text-primary)]">
                Select Members/Slots
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllSlots}
                  disabled={!slots.length || loadingSlots}
                >
                  Select All Slots
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllSlots}
                  disabled={!selectedSlotIds.length}
                >
                  Clear
                </Button>
              </div>
            </div>

            {loadingSlots ? (
              <div className="text-sm text-[var(--text-secondary)]">Loading slots...</div>
            ) : !membersForGroup.length ? (
              <div className="text-sm text-[var(--text-secondary)]">
                No slots found for this group.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {membersForGroup.map((member) => {
                  const memberSlotIds = member.slots.map((s) => s.slotId);
                  const selectedCount = memberSlotIds.filter((sid) =>
                    selectedSlotIds.includes(sid),
                  ).length;
                  const allSelected =
                    memberSlotIds.length > 0 && selectedCount === memberSlotIds.length;
                  return (
                    <div
                      key={member.memberId}
                      className="rounded-md border border-[var(--border-color)] p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-[var(--text-primary)] text-sm">
                          {member.memberName}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) =>
                              setMemberSlotsSelection(member.memberId, e.target.checked)
                            }
                          />
                          Select all slots ({member.slots.length})
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {member.slots
                          .sort((a, b) => a.slotIndex - b.slotIndex)
                          .map((slot) => (
                            <label
                              key={slot.slotId}
                              className="flex items-center gap-2 text-sm text-[var(--text-primary)]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSlotIds.includes(slot.slotId)}
                                onChange={() => toggleSlot(slot.slotId)}
                              />
                              {slot.slotLabel}
                            </label>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="text-xs text-[var(--text-secondary)]">
              Selected slots: {selectedSlotIds.length}
            </div>
            {selectedSlotIds.length > 0 ? (
              <div className="text-xs text-[var(--text-secondary)] rounded-md border border-[var(--border-color)] p-2">
                {loadingProgress ? (
                  <span>Checking previous month payments...</span>
                ) : slotProgress.length ? (
                  <div className="space-y-1">
                    {slotProgress.map((sp) => (
                      <div key={sp.slotId}>
                        <div>
                          {sp.memberName}: paid till month {sp.paidTillMonth || 0}, next month{" "}
                          <strong>{sp.nextMonth}</strong>
                        </div>
                        {sp.monthAmounts.length ? (
                          <div className="pl-3">
                            {sp.monthAmounts.map((m) => (
                              <div key={`${sp.slotId}_${m.monthIndex}`}>
                                Month {m.monthIndex}: ₹{m.amount.toLocaleString("en-IN")}
                              </div>
                            ))}
                            {sp.monthPenalties.map((p) => (
                              <div
                                key={`${sp.slotId}_pen_${p.monthIndex}`}
                                className="text-red-600"
                              >
                                Month {p.monthIndex} penalty: ₹
                                {p.penaltyAmount.toLocaleString("en-IN")}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="pl-3">
                            {sp.monthPenalties.length ? (
                              sp.monthPenalties.map((p) => (
                                <div
                                  key={`${sp.slotId}_pen_only_${p.monthIndex}`}
                                  className="text-red-600"
                                >
                                  Month {p.monthIndex} penalty: ₹
                                  {p.penaltyAmount.toLocaleString("en-IN")}
                                </div>
                              ))
                            ) : (
                              "No month-wise payments found yet."
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>No approved month history found for selected slots.</span>
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[var(--text-primary)]">Month Allocations</h3>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus size={14} />
                Add Row
              </Button>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Month Index</label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedGroup?.totalMonths ?? 1}
                    value={row.monthIndex}
                    onChange={(e) => updateRow(row.id, { monthIndex: e.target.value })}
                    onBlur={() =>
                      updateRow(row.id, {
                        monthIndex: String(Math.max(1, Math.round(toNum(row.monthIndex || "1")))),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)]">Amount</label>
                  <Input
                    type="number"
                    min={0}
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                    onBlur={() =>
                      updateRow(row.id, {
                        amount: String(Math.max(0, Math.round(toNum(row.amount || "0")))),
                      })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-5 pt-2">
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                />
                Skip existing approved month
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={forceLedgerDueAmount}
                  onChange={(e) => setForceLedgerDueAmount(e.target.checked)}
                />
                Force ledger due amount
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border-color)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-[var(--text-primary)]">Manual Penalty (Admin)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Month Index</label>
                <Input
                  type="number"
                  min={1}
                  max={selectedGroup?.totalMonths ?? 1}
                  value={penaltyMonthIndex}
                  onChange={(e) => setPenaltyMonthIndex(e.target.value)}
                  onBlur={() =>
                    setPenaltyMonthIndex(
                      String(Math.max(1, Math.round(toNum(penaltyMonthIndex || "1")))),
                    )
                  }
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)]">Penalty Amount</label>
                <Input
                  type="number"
                  min={1}
                  value={penaltyAmount}
                  placeholder="Enter penalty amount"
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  onBlur={() =>
                    setPenaltyAmount(
                      penaltyAmount.trim()
                        ? String(Math.max(0, Math.round(toNum(penaltyAmount || "0"))))
                        : "",
                    )
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyPenalty}
                  disabled={
                    applyingPenalty ||
                    !groupId ||
                    !selectedSlotIds.length ||
                    Math.max(0, Math.round(toNum(penaltyAmount))) <= 0
                  }
                >
                  {applyingPenalty ? "Applying..." : "Apply Penalty"}
                </Button>
              </div>
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              Enter month + penalty amount, then click Apply Penalty. Penalty will show for that member/month.
            </div>
          </div>

          {errorText ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorText}
            </div>
          ) : null}
          {successText ? (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successText}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !groupId || !selectedSlotIds.length}
            >
              {submitting ? (
                <>
                  <RefreshCcw size={14} className="animate-spin" />
                  Processing...
                </>
              ) : (
                "Submit Backfill"
              )}
            </Button>
            <span className="text-xs text-[var(--text-secondary)]">
              Endpoint: /api/collections/fill-member-months
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


