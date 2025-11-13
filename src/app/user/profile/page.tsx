"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { hydrateMember } from "@/store/memberAuthSlice";
import { fetchMembers, updateMember } from "@/store/memberSlice";
import { fetchGroups } from "@/store/chitGroupSlice";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Edit2, Check, X, Users } from "lucide-react";
import Button from "@/app/components/ui/button";
import type { Member } from "@/app/lib/types";

/* ----- small helpers (unknown -> record casts instead of `any`) ----- */
function getString(obj: unknown, ...keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
function getDateString(obj: unknown, ...keys: string[]): string | undefined {
  const s = getString(obj, ...keys);
  if (!s) return undefined;
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
    return s;
  } catch {
    return s;
  }
}
function niceDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(iso);
  }
}

/* ----- extract joined IDs from member in common shapes ----- */
function extractJoinedIdsFromMember(member: unknown): string[] {
  if (!member || typeof member !== "object") return [];
  const rec = member as Record<string, unknown>;
  const candidates = [rec.groups, rec.joinedGroups, rec.groupIds, rec.joinedGroupIds, rec.memberOf, rec.groupsInfo];

  for (const arr of candidates) {
    if (!Array.isArray(arr)) continue;
    if (arr.length > 0 && typeof arr[0] === "string") return arr.map((s) => String(s));
    const ids: string[] = [];
    for (const e of arr) {
      if (!e) continue;
      if (typeof e === "string") ids.push(e);
      else if (typeof e === "object") {
        const id = getString(e, "_id", "id", "groupId");
        if (id) ids.push(id);
      }
    }
    if (ids.length > 0) return ids;
  }
  return [];
}

/* ----- try find join date per group from member or group object ----- */
function findJoinedAtFromMemberGroups(member: unknown, groupId: string): string | null {
  if (!member || typeof member !== "object") return null;
  const rec = member as Record<string, unknown>;
  const arr = rec.joinedGroups ?? rec.groups ?? rec.groupsInfo ?? null;
  if (!Array.isArray(arr)) return null;
  for (const entry of arr) {
    if (!entry) continue;
    if (typeof entry === "string") continue;
    if (typeof entry === "object") {
      const gid = getString(entry, "_id", "id", "groupId");
      if (gid && String(gid) === String(groupId)) {
        return getDateString(entry, "joinedAt", "joinedOn", "joinDate", "addedAt") ?? null;
      }
    }
  }
  return null;
}
function findJoinedAtFromGroupObject(group: unknown, userId: string): string | null {
  if (!group || typeof group !== "object") return null;
  const rec = group as Record<string, unknown>;
  const members = rec.members ?? rec.participants ?? rec.users ?? rec.memberDetails ?? rec.memberIds;
  if (!Array.isArray(members)) return null;
  for (const m of members) {
    if (!m) continue;
    if (typeof m === "string") {
      if (String(m) === userId) return null;
      continue;
    }
    if (typeof m === "object") {
      const mid = getString(m, "_id", "id", "userId", "memberId");
      if (mid && String(mid) === String(userId)) {
        return getDateString(m, "joinedAt", "joinedOn", "joinDate", "addedAt") ?? null;
      }
    }
  }
  return null;
}

/* ----- component ----- */
export default function UserProfilePage() {
  const dispatch = useDispatch<AppDispatch>();

  // auth may contain partial user (from /api/auth/me) or full member (after hydration)
  const authMember = useSelector((s: RootState) => s.auth?.member ?? null) as Member | null;

  // members slice (we will use fetchMembers to get the full member record)
  const allMembers = useSelector((s: RootState) => (s.members ? (s.members.members as Member[]) : [])) as Member[];
  const groupsInState = useSelector((s: RootState) => (s.chitGroups ? (s.chitGroups as { groups?: unknown }).groups ?? [] : []));
  const groupsStatus = useSelector((s: RootState) => (s.chitGroups ? (s.chitGroups as { status?: string }).status ?? "idle" : "idle"));

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // hydrate from localStorage (fast) and fetch members + groups (server)
  useEffect(() => {
    // 1) hydrate quick local data if any
    try {
      const raw = localStorage.getItem("member");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // parsed could be partial; only hydrate if it has id/_id
          if (parsed && (parsed.id || parsed._id)) {
            // cast to Member (we expect stored object to be a Member-like object)
            dispatch(hydrateMember(parsed as unknown as Member));
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore storage errors
    }

    // 2) fetch members (to get full member data) and groups
    (async () => {
      try {
        const p1 = dispatch(fetchGroups());

        // fetch all members from memberSlice (API: /api/members)
        const fetchMembersAction = await dispatch(fetchMembers());
        // fetchMembersAction may be a fulfilled action with payload Member[]
        // check runtime shape and hydrate auth if we can find a match
        if (fetchMembersAction && typeof fetchMembersAction === "object" && "payload" in fetchMembersAction && Array.isArray(fetchMembersAction.payload)) {
          const membersPayload = fetchMembersAction.payload as Member[];

          // determine candidate id or email from partial authMember (if present)
          const candidateId = getString(authMember, "_id", "id");
          const candidateEmail = getString(authMember, "email");
          let found: Member | null = null;

          if (candidateId) {
            found = membersPayload.find((m) => {
              if (!m || typeof m !== "object") return false;
              const mid = (m as unknown as Record<string, unknown>)._id ?? (m as unknown as Record<string, unknown>).id ?? "";
              return String(mid) === String(candidateId);
            }) ?? null;
          }

          if (!found && candidateEmail) {
            found = membersPayload.find((m) => {
              if (!m || typeof m !== "object") return false;
              const em = (m as unknown as Record<string, unknown>).email ?? "";
              return String(em).toLowerCase() === candidateEmail.toLowerCase();
            }) ?? null;
          }

          // If found, hydrate the auth member with full object so UI has full data
          if (found) {
            dispatch(hydrateMember(found));
            try {
              localStorage.setItem("member", JSON.stringify(found));
            } catch {
              // ignore
            }
          }
        }

        // wait groups as well
        await p1;
      } finally {
        setLoading(false);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // when authMember becomes available, hydrate local edit fields
  useEffect(() => {
    if (!authMember) return;
    setName(getString(authMember, "name") ?? "");
    setAddress(getString(authMember, "address") ?? getString(authMember, "addr") ?? "");
  }, [authMember]);

  // Save handler (name + address only)
  // Save handler (name + address only)
async function handleSave() {
  if (!authMember) {
    setError("No signed-in user found");
    return;
  }
  const userId = getString(authMember, "_id", "id") ?? getString(authMember, "id") ?? "";
  if (!userId) {
    setError("Invalid user id");
    return;
  }

  setSaving(true);
  setError(null);

  const updates: Partial<Member> = {};
  if (name !== (getString(authMember, "name") ?? "")) updates.name = name;
  if (address !== (getString(authMember, "address") ?? getString(authMember, "addr") ?? "")) updates.address = address;

  if (Object.keys(updates).length === 0) {
    setIsEditing(false);
    setSaving(false);
    return;
  }

  try {
    const rawAction = await dispatch(updateMember({ id: userId, updates }));
    // safely view as a record to inspect runtime fields without using `any`
    const action = rawAction as unknown as Record<string, unknown>;

    // If action.type ends with '/fulfilled' we expect a payload
    if (typeof action.type === "string" && action.type.endsWith("/fulfilled") && "payload" in action && action.payload) {
      const updated = action.payload as Member;
      dispatch(hydrateMember(updated));
      try {
        localStorage.setItem("member", JSON.stringify(updated));
      } catch {
        // ignore
      }
      setIsEditing(false);
    } else {
      // Try extract useful error message from payload or error fields (both are unknown at compile time)
      let payloadMsg: string | undefined;
      if ("payload" in action && typeof action.payload === "object" && action.payload !== null) {
        const p = action.payload as Record<string, unknown>;
        if ("message" in p && typeof p.message === "string") payloadMsg = p.message;
      } else if ("payload" in action && typeof action.payload === "string") {
        payloadMsg = String(action.payload);
      }

      let errorMsg: string | undefined;
      if ("error" in action && typeof action.error === "object" && action.error !== null) {
        const e = action.error as Record<string, unknown>;
        if ("message" in e && typeof e.message === "string") errorMsg = e.message;
      }

      const errMsg = payloadMsg ?? errorMsg ?? "Failed to save profile";
      throw new Error(String(errMsg));
    }
  } catch (err) {
    setError((err as Error).message || "Failed to save profile");
  } finally {
    setSaving(false);
  }
}


  // compute joined group ids (from member), then map to group objects in state to get name and join date
  const joinedGroups = useMemo(() => {
    if (!authMember) return [];
    const userId = getString(authMember, "_id", "id") ?? "";
    const joinedIds = extractJoinedIdsFromMember(authMember);

    const idsSet = new Set<string>(joinedIds);

    if (idsSet.size === 0 && Array.isArray(groupsInState)) {
      for (const g of groupsInState) {
        if (!g || typeof g !== "object") continue;
        const gid = getString(g, "_id", "id", "name") ?? "";
        if (!gid) continue;
        const members = (g as Record<string, unknown>).members ?? (g as Record<string, unknown>).memberIds ?? (g as Record<string, unknown>).participants ?? null;
        if (Array.isArray(members)) {
          for (const m of members) {
            if (!m) continue;
            if (typeof m === "string" && String(m) === userId) idsSet.add(gid);
            if (typeof m === "object") {
              const mid = getString(m, "_id", "id", "userId", "memberId");
              if (mid && String(mid) === userId) idsSet.add(gid);
            }
          }
        }
      }
    }

    const out: { id: string; name?: string | null; joinedAt?: string | null }[] = [];
    for (const id of Array.from(idsSet)) {
      const grp = (groupsInState as unknown[]).find((gg) => {
        if (!gg || typeof gg !== "object") return false;
        const gid = getString(gg, "_id", "id", "name") ?? "";
        return gid === id;
      });

      const name = grp ? getString(grp, "name", "fundName", "title") ?? null : null;

      let joinedAt = findJoinedAtFromMemberGroups(authMember, id);
      if (!joinedAt && grp) joinedAt = findJoinedAtFromGroupObject(grp, userId) ?? getDateString(grp, "startDate", "start", "createdAt") ?? null;

      out.push({ id, name, joinedAt });
    }

    if (joinedIds.length > 0) {
      out.sort((a, b) => joinedIds.indexOf(a.id) - joinedIds.indexOf(b.id));
    }

    return out;
  }, [authMember, groupsInState]);

  // UI-level values
  const avatarUrl = getString(authMember, "avatarUrl", "avatar", "photo") ?? "";
  const displayEmail = getString(authMember, "email") ?? "—";
  const displayMobile = getString(authMember, "mobile", "phone", "phoneNumber") ?? "—";
  const displayJoining = niceDate(getDateString(authMember, "joiningDate", "joinedAt", "createdAt") ?? undefined);
  const displayStatus = getString(authMember, "status") ?? "—";
  const displayBalance = (() => {
    if (!authMember || typeof authMember !== "object") return "—";
    const rec = authMember as unknown as Record<string, unknown>;
    const totalPaid = typeof rec.totalPaid === "number" ? rec.totalPaid : undefined;
    if (typeof totalPaid === "number") return `₹${totalPaid}`;
    const pending = typeof rec.pendingAmount === "number" ? rec.pendingAmount : undefined;
    if (typeof pending === "number" && pending > 0) return `Pending ₹${pending}`;
    return "—";
  })();

  // loading skeleton
  if (loading || (!authMember && groupsStatus === "loading")) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold" style={{ color: "var(--color-primary)" }}>
          Profile
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Loading profile…</p>
        <div className="mt-4 grid gap-3">
          <div className="p-6 rounded-lg shadow animate-pulse bg-[var(--bg-card)] h-60" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] bg-[var(--bg-main)] px-4 py-0 md:py-6 sm:p-8">
      <Card className="w-full max-w-md border-0 shadow-lg rounded-2xl bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardContent className="p-0 md:p-6 sm:p-8 flex flex-col gap-5">
          {/* header + avatar */}
          <div className="text-center flex flex-col items-center gap-3">
            {avatarUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-4" style={{ borderColor: "var(--color-primary)" }}>
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold bg-[var(--bg-highlight)] border-4" style={{ borderColor: "var(--color-primary)" }}>
                {(getString(authMember, "name") || "").split(" ").map((s) => s[0]).slice(0, 2).join("") || "U"}
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--color-primary)" }}>
                Profile
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Your account details & joined groups</p>
            </div>
          </div>

          {/* fields */}
          <div className="w-full space-y-4">
            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Full Name</Label>
              <Input
                type="text"
                value={name}
                disabled={!isEditing}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${isEditing ? "border-[var(--color-primary)]" : "border-transparent"} bg-[var(--bg-input)] text-[var(--text-primary)]`}
              />
            </div>

            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Email</Label>
              <Input type="email" value={displayEmail} disabled className="mt-1 border-transparent bg-[var(--bg-input)] text-[var(--text-primary)]" />
            </div>

            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Mobile</Label>
              <Input type="text" value={displayMobile} disabled className="mt-1 border-transparent bg-[var(--bg-input)] text-[var(--text-primary)]" />
            </div>

            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Address</Label>
              <Input
                type="text"
                value={address}
                disabled={!isEditing}
                onChange={(e) => setAddress(e.target.value)}
                className={`mt-1 ${isEditing ? "border-[var(--color-primary)]" : "border-transparent"} bg-[var(--bg-input)] text-[var(--text-primary)]`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
              <div>
                <Label className="text-sm text-[var(--text-secondary)]">Member Since</Label>
                <div className="mt-1 font-medium">{displayJoining}</div>
              </div>
              <div>
                <Label className="text-sm text-[var(--text-secondary)]">Status</Label>
                <div className="mt-1 font-medium">{displayStatus}</div>
              </div>
            </div>

            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Balance / Payments</Label>
              <div className="mt-1 font-medium">{displayBalance}</div>
            </div>

            <div>
              <Label className="text-sm text-[var(--text-secondary)]">Joined Groups</Label>
              <div className="mt-2 space-y-2">
                {joinedGroups.length === 0 ? (
                  <div className="text-sm text-[var(--text-secondary)]">You have not joined any groups yet.</div>
                ) : (
                  joinedGroups.map((g) => (
                    <div key={g.id} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-highlight)] text-[var(--text-primary)] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 text-[var(--color-primary)]" />
                        <div className="text-sm">{g.name ? <div className="capitalize text-medium text-[var(--text-secondary)]">Name: {g.name}</div> : null}</div>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">{niceDate(g.joinedAt ?? undefined)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex justify-center gap-3 pt-2">
            {isEditing ? (
              <>
                <Button size="sm" className="px-5 bg-[var(--color-secondary)] text-[var(--text-light)]" onClick={handleSave} disabled={saving}>
                  <Check className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-5 border-[var(--border-color)] text-[var(--text-primary)]"
                  onClick={() => {
                    setIsEditing(false);
                    setName(getString(authMember, "name") ?? "");
                    setAddress(getString(authMember, "address") ?? "");
                  }}
                  disabled={saving}
                >
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" className="px-5 bg-[var(--color-primary)] text-[var(--text-light)]" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-1" /> Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
