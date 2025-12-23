"use client";

import React, { useEffect, useState } from "react";
import { Users, CheckCircle, XCircle, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import Button from "@/app/components/ui/button";

/* ----------------------------- types ----------------------------- */
type GroupStatus = "Active" | "Closed" | "Inactive";

interface ChitGroup {
  _id?: string;
  id?: number | string;
  name: string;
  chitValue: number;
  monthlyInstallment: number;
  totalMonths: number;
  totalMembers: number;
  memberIds?: string[]; // user ids that joined
  members?: Array<string | { _id?: string; id?: string; joinedAt?: string }>; // alternate shape
  startDate: string;
  endDate: string;
  status: GroupStatus;
  remarks?: string;
  penaltyPercent?: number;
}

interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

/* --------------------------- helpers ----------------------------- */
const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const niceDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

/** Safely extract joined member count for a group (handles multiple shapes) */
function joinedCountOf(group: ChitGroup | Record<string, unknown>): number {
  // prefer memberIds array of strings
  const g = group as Record<string, unknown>;

  const maybeMemberIds = g.memberIds ?? g.members ?? g.users ?? g.participants ?? g.memberDetails;
  if (Array.isArray(maybeMemberIds)) {
    // if array of primitives (strings) -> length
    if (maybeMemberIds.length === 0) return 0;
    // count unique string ids or objects with _id
    let count = 0;
    for (const m of maybeMemberIds) {
      if (!m) continue;
      if (typeof m === "string" || typeof m === "number") {
        count++;
        continue;
      }
      if (typeof m === "object") {
        // object shape e.g. { _id, id, joinedAt }
        const rec = m as Record<string, unknown>;
        if (rec._id || rec.id) count++;
      }
    }
    return count;
  }

  // fallback: if group has totalMembers only, return 0 joined (unknown)
  return 0;
}

/* -------------------------- component ---------------------------- */
export default function ChitFundsPage() {
  const [groups, setGroups] = useState<ChitGroup[] | null>(null);
  const [selected, setSelected] = useState<ChitGroup | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAndVerify();
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Client-side hydration + server verification for current user (same as previously)
   */
  async function fetchUserAndVerify() {
    try {
      const raw = localStorage.getItem("member") || localStorage.getItem("user") || localStorage.getItem("auth");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const maybeId = parsed?.id ?? parsed?._id;
          if (maybeId) {
            setUser({
              _id: String(maybeId),
              name: parsed?.name ?? "",
              email: parsed?.email ?? "",
              phone: parsed?.phone ?? undefined,
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch {
      // ignore localStorage access errors
    }

    const getToken = (): string | null => {
      try {
        const direct = localStorage.getItem("memberToken") || localStorage.getItem("token") || localStorage.getItem("adminToken");
        if (direct) return direct;
        const raw = localStorage.getItem("member") || localStorage.getItem("user") || localStorage.getItem("auth");
        if (raw) {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === "object") {
              return (obj as Record<string, unknown>).token as string ?? (obj as Record<string, unknown>).jwt as string ?? null;
            }
          } catch {
            // not JSON
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    const token = getToken();

    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/auth/me", { headers });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      if (data?.success && data.user) {
        const srvUser = data.user as User;
        setUser(srvUser);

        try {
          const store = {
            id: srvUser._id,
            name: srvUser.name,
            email: srvUser.email ?? "",
            token: token ?? localStorage.getItem("memberToken") ?? undefined,
          };
          localStorage.setItem("member", JSON.stringify(store));
        } catch {
          // ignore storage errors
        }
      }
    } catch {
      // network error
    }
  }

  async function loadGroups() {
    setLoadingGroups(true);
    setError(null);
    try {
      const res = await fetch("/api/chitgroups");
      if (!res.ok) throw new Error("Failed to load groups");
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.groups)) throw new Error("Malformed response from server");
      setGroups(data.groups as ChitGroup[]);
    } catch (err) {
      setError((err as Error).message || "Unable to fetch groups");
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }

  function isMember(group: ChitGroup) {
    if (!user) return false;
    const joinCount = joinedCountOf(group as unknown as Record<string, unknown>); // still needed to use memberIds shape
    // If group.memberIds exists as array of ids, check membership
    if (Array.isArray(group.memberIds)) return group.memberIds.includes(user._id);

    // otherwise check members array objects or strings
    const members = (group as unknown as Record<string, unknown>).members;
    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m) continue;
        if (typeof m === "string" && m === user._id) return true;
        if (typeof m === "object") {
          const rec = m as Record<string, unknown>;
          const mid = (rec._id ?? rec.id ?? rec.userId ?? rec.memberId) as string | undefined;
          if (mid && String(mid) === user._id) return true;
        }
      }
    }

    // fallback: unable to determine — return false
    return false;
  }

  /* ---------- UI states ---------- */
  if (loadingGroups) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold" style={{ color: "var(--color-primary)" }}>
          Chit Funds
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Loading available funds…</p>
        <div className="grid gap-3 mt-4 [@media(max-width:640px)]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg shadow animate-pulse bg-[var(--bg-card)] h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-3 sm:p-6 overflow-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight" style={{ color: "var(--color-primary)" }}>
            Chit Funds
          </h1>
        </div>

        <div className="text-right">
          {user ? (
            <div className="text-sm">
              <div style={{ color: "var(--text-secondary)" }}>Signed in as</div>
              <div className="font-medium">{user.name}</div>
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Not signed in
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 md:gap-6 [@media(max-width:640px)]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 capitalize">
        {(groups ?? []).map((group) => {
          const gid = String(group._id ?? group.id ?? group.name);
          const member = isMember(group);

          // compute joined & slots left
          const joined = joinedCountOf(group as unknown as Record<string, unknown>);
          const total = typeof group.totalMembers === "number" ? group.totalMembers : 0;
          const slotsLeft = Math.max(0, total - joined);

          return (
            <Card
              key={gid}
              className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-[var(--bg-card)] text-[var(--text-primary)]"
              role="article"
              aria-labelledby={`group-title-${gid}`}
            >
              <CardHeader
                className="pb-3 pt-3"
                style={{
                  background: "var(--bg-highlight)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle id={`group-title-${gid}`} className="text-sm sm:text-base mb-2 leading-snug">
                      {group.name}
                    </CardTitle>

                    <div className="flex items-center gap-2">
                      <Badge
                        className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs inline-flex items-center gap-1"
                        style={{
                          background: group.status === "Active" ? "var(--color-secondary)" : "var(--color-primary)",
                          color: "var(--text-light)",
                        }}
                        aria-label={`Status: ${group.status}`}
                      >
                        {group.status === "Active" ? <CheckCircle className="w-3 h-3" aria-hidden /> : <XCircle className="w-3 h-3" aria-hidden />}
                        <span>{group.status}</span>
                      </Badge>

                      {/* Member indicator */}
                      {member && (
                        <Badge
                          className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs inline-flex items-center gap-1"
                          style={{
                            background: "var(--color-primary)",
                            color: "var(--text-light)",
                          }}
                          aria-label="You are a member"
                        >
                          <span style={{ fontWeight: 600 }}>You are added</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-3 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>Chit Value</span>
                  <span className="font-semibold">{currency(group.chitValue)}</span>
                </div>

                <div className="flex justify-between text-xs sm:text-sm">
                  <span style={{ color: "var(--text-secondary)" }}>Monthly</span>
                  <span className="font-semibold">{currency(group.monthlyInstallment)}</span>
                </div>

                <div className="flex items-center gap-1 text-xs" title={`${group.totalMembers} members`}>
                  <Users className="w-3 h-3 text-[var(--color-primary)]" aria-hidden />
                  <span style={{ color: "var(--text-secondary)" }}>{group.totalMembers} Members</span>
                </div>

                {/* New member summary line: joined / total + slots left */}
                <div className="flex justify-between items-center text-sm mt-1">
                  <div style={{ color: "var(--text-secondary)" }}>Joined</div>
                  <div className="font-semibold">
                    {joined} / {total}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div style={{ color: "var(--text-secondary)" }}>Slots left</div>
                  <div className={`font-semibold ${slotsLeft === 0 ? "text-red-600" : ""}`}>{slotsLeft}</div>
                </div>

                <div className="text-xs text-[var(--text-secondary)]">
                  <div>Duration: {group.totalMonths} months</div>
                  <div>Start: {niceDate(group.startDate)}</div>
                  <div>End: {niceDate(group.endDate)}</div>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs py-1"
                    onClick={() => setSelected(group)}
                  >
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-sm sm:max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Info className="w-5 h-5 text-[var(--color-primary)]" />
                  {selected.name}
                </DialogTitle>
                <DialogDescription style={{ color: "var(--text-secondary)" }}>
                  Complete chit group details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 mt-3 text-sm">
                {/* Member status line */}
                {user && isMember(selected) && (
                  <div className="p-2 rounded text-sm font-medium bg-[var(--bg-highlight)] border border-[var(--border-color)]">
                    <strong>You are a member of this group.</strong>
                  </div>
                )}

                <p>
                  <strong>Chit Value:</strong> {currency(selected.chitValue)}
                </p>
                <p>
                  <strong>Monthly Installment:</strong> {currency(selected.monthlyInstallment)}
                </p>
                <p>
                  <strong>Total Members:</strong> {selected.totalMembers}
                </p>

                {/* Show joined count here too */}
                <p>
                  <strong>Members joined:</strong> {joinedCountOf(selected as unknown as Record<string, unknown>)}
                </p>

                <p>
                  <strong>Duration:</strong> {selected.totalMonths} months
                </p>
                <p>
                  <strong>Start:</strong> {niceDate(selected.startDate)}
                </p>
                <p>
                  <strong>End:</strong> {niceDate(selected.endDate)}
                </p>
                <p>
                  <strong>Penalty:</strong> {selected.penaltyPercent ?? 0} %
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span style={{ color: selected.status === "Active" ? "var(--color-secondary)" : "var(--color-primary)" }}>
                    {selected.status}
                  </span>
                </p>
                {selected.remarks && (
                  <p>
                    <strong>Remarks:</strong> {selected.remarks}
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(null)}
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
