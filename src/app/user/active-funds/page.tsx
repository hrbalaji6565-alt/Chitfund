// src/app/components/UserActiveFunds.tsx
"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Search as SearchIcon } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

interface ChitFundView {
  id: string;
  fundName: string;
  groupName: string;
  totalAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  startDate: string;
  maturityDate: string;
  status: "Active" | "Completed" | "Pending" | string;
  interestRate: number;
  numberOfInstallments: number;
  completedInstallments: number;
}

/** Type helpers **/
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function toStringSafe(x: unknown, fallback = "—"): string {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (x instanceof Date) return x.toISOString();
  return fallback;
}

function toNumberSafe(x: unknown, fallback = 0): number {
  if (typeof x === "number" && !Number.isNaN(x)) return x;
  if (typeof x === "string" && x.trim() !== "") {
    const n = Number(x);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

function getMaybeArray(x: unknown): unknown[] | null {
  if (Array.isArray(x)) return x;
  return null;
}

/** Field extraction helpers for a backend group object (unknown shape) **/
function extractId(g: unknown): string {
  if (!isRecord(g)) return Math.random().toString(36).slice(2);
  return (
    toStringSafe(g._id ?? g.id ?? g.name ?? "", "") ||
    Math.random().toString(36).slice(2)
  );
}

function extractFundName(g: unknown, fallbackId: string): string {
  if (!isRecord(g)) return fallbackId;
  return (
    toStringSafe(g.fundName ?? g.name ?? g.title ?? fallbackId, fallbackId)
  );
}

function extractGroupName(g: unknown, fallbackId: string): string {
  if (!isRecord(g)) return fallbackId;
  return toStringSafe(g.groupName ?? g.group ?? g.name ?? fallbackId, fallbackId);
}

function extractTotalAmount(g: unknown): number {
  if (!isRecord(g)) return 0;
  return toNumberSafe(g.totalAmount ?? g.chitValue ?? 0, 0);
}

function extractCollectedAmount(g: unknown): number {
  if (!isRecord(g)) return 0;
  return toNumberSafe(g.collectedAmount ?? g.collected ?? 0, 0);
}

function extractPendingAmount(g: unknown): number {
  const total = extractTotalAmount(g);
  const collected = extractCollectedAmount(g);
  // If pendingAmount explicitly provided, prefer it
  if (isRecord(g) && (g.pendingAmount !== undefined)) {
    return toNumberSafe(g.pendingAmount, Math.max(total - collected, 0));
  }
  return Math.max(total - collected, 0);
}

function extractStartDate(g: unknown): string {
  if (!isRecord(g)) return "—";
  return toStringSafe(g.startDate ?? g.start ?? g.createdAt ?? "—", "—");
}

function extractMaturityDate(g: unknown): string {
  if (!isRecord(g)) return "—";
  return toStringSafe(g.maturityDate ?? g.endDate ?? g.end ?? "—", "—");
}

function extractStatus(g: unknown): string {
  if (!isRecord(g)) return "Active";
  if (g.status) return toStringSafe(g.status, "Active");
  if (typeof g.completed === "boolean") return g.completed ? "Completed" : "Active";
  return "Active";
}

function extractInterestRate(g: unknown): number {
  if (!isRecord(g)) return 0;
  return toNumberSafe(g.interestRate ?? g.interest ?? 0, 0);
}

function extractNumberOfInstallments(g: unknown): number {
  if (!isRecord(g)) return 0;
  return toNumberSafe(g.numberOfInstallments ?? g.totalMonths ?? 0, 0);
}

function extractCompletedInstallments(g: unknown): number {
  if (!isRecord(g)) return 0;
  return toNumberSafe(g.completedInstallments ?? g.paidInstallments ?? 0, 0);
}

/** Helpers for membership detection (no explicit any) **/
function idToString(x: unknown): string {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (isRecord(x)) return toStringSafe(x._id ?? x.id ?? "", "");
  return "";
}

export default function UserActiveFunds() {
  const [searchTerm, setSearchTerm] = useState("");

  // We rely on RootState typing from your store. If your RootState already has proper types
  // these selectors will infer them. We keep the values as unknown when shape is uncertain.
  const groups = useSelector((state: RootState) => state.chitGroups.groups) as unknown[] | undefined;
  const joinedIds = useSelector((state: RootState) => state.userChit?.joinedIds) as unknown[] | undefined;
  const authMember = useSelector((state: RootState) => state.auth?.member) as unknown | undefined;

  const safeGroups = Array.isArray(groups) ? groups : [];

  // Map backend group -> UI fund shape safely (no 'any')
  const allFunds = useMemo<ChitFundView[]>(() => {
    return safeGroups.map((g) => {
      const id = extractId(g);
      const totalAmount = extractTotalAmount(g);
      const collectedAmount = extractCollectedAmount(g);
      const pendingAmount = extractPendingAmount(g);

      return {
        id,
        fundName: extractFundName(g, id),
        groupName: extractGroupName(g, id),
        totalAmount,
        collectedAmount,
        pendingAmount,
        startDate: extractStartDate(g),
        maturityDate: extractMaturityDate(g),
        status: extractStatus(g) as ChitFundView["status"],
        interestRate: extractInterestRate(g),
        numberOfInstallments: extractNumberOfInstallments(g),
        completedInstallments: extractCompletedInstallments(g),
      };
    });
  }, [safeGroups]);

  // Determine which groups this user is in:
  const userFundList = useMemo(() => {
    // Prefer explicit joinedIds slice if it's an array
    if (Array.isArray(joinedIds) && joinedIds.length > 0) {
      const setJoined = new Set(joinedIds.map((id) => idToString(id)));
      return allFunds.filter((f) => setJoined.has(String(f.id)));
    }

    // Fallback: use auth member fields if present
    let memberJoinedIds: unknown[] | null = null;
    if (isRecord(authMember)) {
      const candidate = authMember.joinedGroupIds ?? authMember.joinedGroups ?? authMember.groups;
      if (Array.isArray(candidate)) memberJoinedIds = candidate;
    }

    if (Array.isArray(memberJoinedIds) && memberJoinedIds.length > 0) {
      const setJoined = new Set(memberJoinedIds.map((x) => idToString(x)));
      return allFunds.filter((f) => setJoined.has(String(f.id)));
    }

    // Fallback: try membership included in group object itself (memberIds / users)
    return allFunds.filter((f) => {
      const groupObj = safeGroups.find((g) => {
        const gid = extractId(g);
        return String(gid) === String(f.id);
      });
      if (!groupObj || !isRecord(groupObj)) return false;
      const membersRaw = groupObj.memberIds ?? groupObj.members ?? groupObj.users ?? [];
      const members = getMaybeArray(membersRaw);
      if (!members || members.length === 0) return false;
      const uid = isRecord(authMember) ? idToString(authMember._id ?? authMember.id ?? "") : "";

      return members.some((m) => {
        if (typeof m === "string") return m === uid;
        if (isRecord(m)) return idToString(m._id ?? m.id ?? "") === uid;
        return false;
      });
    });
  }, [joinedIds, authMember, allFunds, safeGroups]);

  const filteredFunds = userFundList.filter(
    (fund) =>
      fund.fundName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalFunds = userFundList.reduce((sum, fund) => sum + fund.totalAmount, 0);
  const totalCollected = userFundList.reduce((sum, fund) => sum + fund.collectedAmount, 0);
  const totalPending = userFundList.reduce((sum, fund) => sum + fund.pendingAmount, 0);

  const getProgressPercentage = (fund: ChitFundView) =>
    Math.min((fund.collectedAmount / (fund.totalAmount || 1)) * 100, 100);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Completed":
        return "bg-blue-100 text-blue-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6 p-4 bg-[var(--bg-main)] min-h-screen">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="shadow-lg p-4 ">
          <CardContent>
            <p className="text-sm text-gray-500">Total Funds</p>
            <h3 className="text-2xl font-bold">₹{totalFunds.toLocaleString()}</h3>
          </CardContent>
        </Card>
        <Card className="shadow-lg p-4">
          <CardContent>
            <p className="text-sm text-gray-500">Collected Amount</p>
            <h3 className="text-2xl font-bold text-green-600">₹{totalCollected.toLocaleString()}</h3>
          </CardContent>
        </Card>
        <Card className="shadow-lg p-4">
          <CardContent>
            <p className="text-sm text-gray-500">Pending Amount</p>
            <h3 className="text-2xl font-bold text-red-600">₹{totalPending.toLocaleString()}</h3>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input placeholder="Search funds or groups..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-12 rounded-lg" />
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {filteredFunds.map((fund, index) => (
            <motion.div key={fund.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.05, duration: 0.3 }}>
              <Card className="shadow-lg p-4">
                <CardContent>
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">{fund.fundName}</h3>
                        <Badge className={getStatusColor(fund.status)}>{fund.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">{fund.groupName}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        <div>
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="font-semibold">₹{fund.totalAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Collected</p>
                          <p className="font-semibold text-green-600">₹{fund.collectedAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pending</p>
                          <p className="font-semibold text-red-600">₹{fund.pendingAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Interest</p>
                          <p className="font-semibold">{fund.interestRate}%</p>
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-semibold">{getProgressPercentage(fund).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${getProgressPercentage(fund)}%` }} transition={{ duration: 1, delay: index * 0.1 }} className="h-full bg-green-500 rounded-full" />
                        </div>
                      </div>

                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {fund.startDate} - {fund.maturityDate}
                          </span>
                        </div>
                        <div>
                          {fund.completedInstallments}/{fund.numberOfInstallments} Installments
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredFunds.length === 0 && <div className="text-center text-gray-500 mt-4">You have no active chit funds joined.</div>}
      </div>
    </div>
  );
}
