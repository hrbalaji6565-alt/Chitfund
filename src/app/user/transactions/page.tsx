// src/app/user/transactions/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Search, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchMembers } from "@/store/memberSlice";

type Raw = Record<string, unknown> & {
  _id?: unknown;
  id?: unknown;
  txId?: unknown;
  amount?: unknown;
  amt?: unknown;
  payAmount?: unknown;
  total?: unknown;
  createdAt?: unknown;
  date?: unknown;
  method?: unknown;
  type?: unknown;
  status?: unknown;
  state?: unknown;
  verified?: unknown;
  approvedAt?: unknown;
  note?: unknown;
  adminNote?: unknown;
  remarks?: unknown;
  groupId?: unknown;
  chitGroupId?: unknown;
  group?: unknown;
  groupName?: unknown;
  utr?: unknown;
  txnId?: unknown;
  memberId?: unknown;
  member?: unknown;
  memberName?: unknown;
};

type TxStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "failed"
  | "unknown";

type Tx = {
  id: string;
  date?: string;
  amount: number;
  method?: string;
  status: TxStatus;
  remarks?: string;
  groupId?: string;
  groupName?: string;
  utr?: string;
  raw?: Raw;
};

const formatAmount = (n = 0) => `₹${Number(n).toLocaleString()}`;

const statusClass = (s: TxStatus) =>
  s === "approved"
    ? "bg-green-100 text-green-800"
    : s === "pending"
    ? "bg-yellow-100 text-yellow-800"
    : s === "rejected" || s === "failed"
    ? "bg-red-100 text-red-800"
    : "bg-gray-100 text-gray-800";

/* helpers */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getString(
  obj: unknown,
  ...keys: string[]
): string | undefined {
  if (!isObject(obj)) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim() !== "") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body: unknown = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/* deep-scan for payment-like objects */
function findPaymentObjects(body: unknown): Raw[] {
  const out: Raw[] = [];
  const visited = new WeakSet<object>();

  const hasAmountAndMember = (rec: Record<string, unknown>): boolean => {
    const hasAmount =
      typeof rec.amount === "number" ||
      typeof rec.amount === "string" ||
      typeof rec.amt === "number" ||
      typeof rec.amt === "string";

    const memberId =
      typeof rec.memberId === "string"
        ? rec.memberId
        : getString(rec.member, "_id", "id");

    return hasAmount && Boolean(memberId);
  };

  function walk(node: unknown) {
    if (!isObject(node) || visited.has(node)) return;
    visited.add(node);

    const rec = node as Raw;
    if (hasAmountAndMember(rec)) out.push(rec);

    for (const v of Object.values(rec)) {
      if (Array.isArray(v)) {
        for (const it of v) {
          if (isObject(it)) {
            const itRec = it as Raw;
            if (hasAmountAndMember(itRec)) out.push(itRec);
            walk(it);
          }
        }
      } else if (isObject(v)) {
        walk(v);
      }
    }
  }

  walk(body);
  return out;
}

/* match payment raw to memberId */
function matchesMember(p: Raw, memberId: string): boolean {
  try {
    const direct =
      getString(p, "memberId") ??
      getString(p.member, "_id", "id");
    if (direct && direct === memberId) return true;

    const name = getString(p, "memberName");
    if (
      name &&
      name.toLowerCase().trim() === memberId.toLowerCase().trim()
    )
      return true;

    if (JSON.stringify(p).includes(memberId)) return true;
  } catch {
    // ignore
  }
  return false;
}

/* safe helpers to get arrays from unknown shapes */
function toUnknownArray(v: unknown): unknown[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (isObject(v)) {
    const rec = v as Record<string, unknown>;
    if (Array.isArray(rec.list)) return rec.list;
    if (Array.isArray(rec.items)) return rec.items;
    if (Array.isArray(rec.members)) return rec.members;
  }
  return [];
}

/* normalize server shapes -> Tx */
function normalize(
  raw: Raw,
  groupLookup?: Record<string, string>,
): Tx {
  const id =
    getString(raw, "_id", "id", "txId") ??
    Math.random().toString(36).slice(2);

  const amount =
    Number(
      raw.amount ??
        raw.amt ??
        raw.payAmount ??
        raw.total ??
        0,
    ) || 0;

  const date =
    (typeof raw.createdAt === "string" && raw.createdAt) ||
    (typeof raw.date === "string" && raw.date) ||
    undefined;

  const method =
    (typeof raw.method === "string" && raw.method) ||
    (typeof raw.type === "string" && raw.type) ||
    undefined;

  const rawStatus =
    raw.status ?? raw.state ?? raw.verified ?? raw.approvedAt;

  const statusStr = String(rawStatus ?? "").toLowerCase();

  const status: TxStatus =
    rawStatus === true ||
    statusStr === "approved" ||
    Boolean(raw.approvedAt)
      ? "approved"
      : statusStr === "rejected"
      ? "rejected"
      : statusStr === "failed"
      ? "failed"
      : statusStr === "pending"
      ? "pending"
      : "unknown";

  const remarks =
    (typeof raw.note === "string" && raw.note) ||
    (typeof raw.adminNote === "string" && raw.adminNote) ||
    (typeof raw.remarks === "string" && raw.remarks) ||
    undefined;

  const gid =
    getString(raw, "groupId", "chitGroupId") ??
    getString(raw.group, "_id", "id");

  const groupNameFromRaw =
    getString(raw.group, "name", "groupName", "title") ??
    (typeof raw.groupName === "string" ? raw.groupName : undefined);

  const groupName =
    groupNameFromRaw ??
    (gid && groupLookup ? groupLookup[gid] : undefined);

  const utr =
    getString(raw, "utr") ?? getString(raw, "txnId");

  return {
    id,
    amount,
    date,
    method,
    status,
    remarks,
    groupId: gid,
    groupName,
    utr,
    raw,
  };
}

export default function UserTransactions() {
  const dispatch = useDispatch<AppDispatch>();
  const authMember = useSelector(
    (s: RootState) => s.auth?.member ?? null,
  );
  const membersSlice = useSelector(
    (s: RootState) =>
      (s as unknown as Record<string, unknown>).members ?? null,
  );

  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [debug, setDebug] = useState<string | null>(null);
  const [groupMap, setGroupMap] = useState<Record<string, string>>(
    {},
  );

  // ensure members loaded
  useEffect(() => {
    const arr = toUnknownArray(membersSlice);
    if (arr.length === 0) {
      try {
        dispatch(fetchMembers());
      } catch {
        // ignore
      }
    }
  }, [dispatch, membersSlice]);

  function resolveMemberId(): string | undefined {
    const idFromAuth =
      getString(authMember, "_id", "id") ??
      getString(authMember, "memberId");
    if (idFromAuth) return idFromAuth;

    try {
      const raw = localStorage.getItem("member");
      if (raw) {
        const parsed = JSON.parse(raw) as
          | Record<string, unknown>
          | null;
        const fromLocal =
          parsed?._id ?? parsed?.id ?? parsed?.memberId;
        if (fromLocal !== undefined) return String(fromLocal);
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  // fetch single group name by id
  async function fetchGroupNameById(
    id: string,
  ): Promise<string | undefined> {
    try {
      const r = await fetch(
        `/api/chitgroups/${encodeURIComponent(id)}`,
        { credentials: "include" },
      );
      if (!r.ok) return undefined;
      const body: unknown = await r.json().catch(() => ({}));
      if (isObject(body)) {
        const direct =
          getString(body, "name", "groupName", "title") ??
          (isObject(body.group)
            ? getString(
                body.group,
                "name",
                "groupName",
                "title",
              )
            : undefined);
        if (direct) return direct;
      }
    } catch {
      // ignore
    }
    return undefined;
  }

   const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTxs([]);
    setDebug(null);

    // current snapshot se local copy
    let localGroupMap = { ...groupMap };

    try {
      const memberId = resolveMemberId();
      if (!memberId) {
        setDebug(
          "No memberId resolved (auth/localStorage) - trying generic endpoints",
        );
      }

      // preload groups -> map id->name
      try {
        const gres = await fetch("/api/chitgroups", {
          credentials: "include",
        });
        const gbody: unknown = await gres
          .json()
          .catch(() => ({}));
        const groupsArr = toUnknownArray(
          isObject(gbody) && "groups" in gbody
            ? (gbody as Record<string, unknown>).groups
            : gbody,
        );
        if (groupsArr.length > 0) {
          const gm: Record<string, string> = {};
          for (const gg of groupsArr) {
            if (!isObject(gg)) continue;
            const gid = getString(gg, "_id", "id");
            const name = getString(
              gg,
              "name",
              "groupName",
              "title",
            );
            if (gid && name) gm[gid] = name;
          }
          if (Object.keys(gm).length > 0) {
            localGroupMap = { ...localGroupMap, ...gm };
            setGroupMap(localGroupMap);
          }
        }
      } catch {
        // ignore
      }

      // candidate urls
      const candidates: string[] = [];
      if (memberId) {
        const m = encodeURIComponent(memberId);
        candidates.push(`/api/user/transactions?memberId=${m}`);
        candidates.push(`/api/transactions?memberId=${m}`);
        candidates.push(`/api/transactions/me?memberId=${m}`);
        candidates.push(
          `/api/user/transactions?mine=true&memberId=${m}`,
        );
        candidates.push(`/api/payments?memberId=${m}`);
      }
      candidates.push("/api/user/transactions");
      candidates.push("/api/transactions");
      candidates.push("/api/transactions/me");
      candidates.push("/api/payments");
      candidates.push("/api/admin/transactions");

      let found: Raw[] = [];
      let source: string | null = null;

      async function tryUrl(url: string): Promise<boolean> {
        try {
          let r = await fetch(url, { credentials: "include" });
          if (r.status === 405) {
            r = await fetch(url, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                all: true,
                memberId: memberId ?? undefined,
              }),
            });
          }
          const body: unknown = await r.json().catch(() => ({}));

          const txListCandidate = isObject(body)
            ? (body as Record<string, unknown>).transactions ??
              (body as Record<string, unknown>).payments ??
              body
            : body;

          const arr = toUnknownArray(txListCandidate);
          if (arr.length >= 0) {
            const casted = arr.filter(isObject) as Raw[];
            const filtered =
              memberId !== undefined
                ? casted.filter((p) =>
                    matchesMember(p, memberId),
                  )
                : casted;

            found = filtered.length > 0 ? filtered : casted;
            source = `${url} (status ${r.status})`;
            return true;
          }

          const deep = findPaymentObjects(body);
          if (deep.length > 0) {
            const filteredDeep =
              memberId !== undefined
                ? deep.filter((d) => matchesMember(d, memberId))
                : deep;
            found =
              filteredDeep.length > 0 ? filteredDeep : deep;
            source = `${url} (deep-scan status ${r.status})`;
            return true;
          }
        } catch {
          // ignore
        }
        return false;
      }

      // try primary endpoints
      // eslint-disable-next-line no-restricted-syntax
      for (const url of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await tryUrl(url);
        if (ok) {
          setDebug(
            `loaded ${found.length} items from ${source}`,
          );
          break;
        }
      }

      // fallback: iterate groups and call /payments on each
      if (found.length === 0) {
        const groupsResp = await fetchJson("/api/chitgroups");
        if (groupsResp.ok) {
          const groups = toUnknownArray(
            isObject(groupsResp.body) &&
              "groups" in (groupsResp.body as Record<
                string,
                unknown
              >)
              ? (groupsResp.body as Record<string, unknown>)
                  .groups
              : groupsResp.body,
          );
          const accum: Raw[] = [];
          const concurrency = 6;

          for (let i = 0; i < groups.length; i += concurrency) {
            const slice = groups.slice(i, i + concurrency);
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(
              slice.map(async (g) => {
                try {
                  if (!isObject(g)) return;
                  const gid = getString(g, "_id", "id");
                  if (!gid) return;
                  const url = `/api/chitgroups/${encodeURIComponent(
                    gid,
                  )}/payments?all=true`;
                  let r1 = await fetch(url, {
                    credentials: "include",
                  });
                  if (!r1.ok && r1.status === 405) {
                    r1 = await fetch(url, {
                      method: "POST",
                      credentials: "include",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ all: true }),
                    });
                  }
                  const body: unknown = await r1
                    .json()
                    .catch(() => ({}));
                  const arr = toUnknownArray(
                    isObject(body)
                      ? (body as Record<string, unknown>).payments ??
                          body
                      : body,
                  );
                  if (arr.length === 0) return;
                  const byMember =
                    memberId !== undefined
                      ? (arr.filter(isObject) as Raw[]).filter(
                          (p) => matchesMember(p, memberId),
                        )
                      : (arr.filter(isObject) as Raw[]);
                  accum.push(...byMember);
                } catch {
                  // ignore per-group failure
                }
              }),
            );
          }

          if (accum.length > 0) {
            found = accum;
            source = `/api/chitgroups/*/payments`;
            setDebug(
              `found ${accum.length} payments across groups`,
            );
          }
        }
      }

      if (found.length === 0) {
        setError(
          "No transactions found for this account (server returned no matching records).",
        );
        setLoading(false);
        return;
      }

      // ensure we have group names for all groupIds
      const seenGroupIds = new Set<string>();
      for (const p of found) {
        const gid =
          getString(p, "groupId", "chitGroupId") ??
          getString(p.group, "_id", "id");
        if (gid) seenGroupIds.add(gid);
      }

      const missing = Array.from(seenGroupIds).filter(
        (gid) => !localGroupMap[gid],
      );

      if (missing.length > 0) {
        const fetched: Record<string, string> = {};
        await Promise.all(
          missing.map(async (gid) => {
            const name = await fetchGroupNameById(gid);
            if (name) fetched[gid] = name;
          }),
        );
        if (Object.keys(fetched).length > 0) {
          localGroupMap = { ...localGroupMap, ...fetched };
          setGroupMap(localGroupMap);
        }
      }

      const normalized = found
        .map((r) => normalize(r, localGroupMap))
        .sort((a, b) =>
          (b.date ?? "").localeCompare(a.date ?? ""),
        );

      setTxs(normalized);
      setDebug((d) => `${d ?? ""} • source: ${source ?? "unknown"}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, [authMember]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = filter.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      txs.filter((t) => {
        if (!q) return true;
        return (
          String(t.method ?? "")
            .toLowerCase()
            .includes(q) ||
          String(t.remarks ?? "")
            .toLowerCase()
            .includes(q) ||
          String(t.groupName ?? t.groupId ?? "")
            .toLowerCase()
            .includes(q) ||
          String(t.utr ?? "")
            .toLowerCase()
            .includes(q) ||
          String(t.id ?? "")
            .toLowerCase()
            .includes(q) ||
          String(t.amount ?? "")
            .toLowerCase()
            .includes(q)
        );
      }),
    [txs, q],
  );

  return (
    <div className="space-y-6 p-4 bg-[var(--bg-main)] min-h-screen">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-[var(--color-primary)]">
          Your Transactions
        </h2>
        <div className="ml-auto max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="Search amount / method / remarks / group / UTR / id"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10 pr-10 h-12 rounded-lg"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-2 px-3 py-2 rounded bg-[var(--color-primary)] text-white"
        >
          Refresh
        </button>
      </div>

      {error && <div className="text-red-600">{error}</div>}
      {loading && (
        <div className="text-sm text-gray-500">
          Loading transactions…
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-left bg-[var(--bg-card)] rounded-lg overflow-hidden shadow">
          <thead className="bg-[var(--color-primary)] text-white">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">UTR / ID</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr
                key={tx.id}
                className="border-b last:border-b-0"
              >
                <td className="px-4 py-3">
                  {tx.date
                    ? new Date(tx.date).toLocaleString()
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  {formatAmount(tx.amount)}
                </td>
                <td className="px-4 py-3">
                  {tx.method ?? "-"}
                </td>
                <td className="px-4 py-3">
                  {tx.groupName ?? tx.groupId ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <Badge className={statusClass(tx.status)}>
                    {tx.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs">
                    {tx.utr ?? tx.id}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {tx.remarks ?? "-"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-sm text-gray-500"
                >
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        <AnimatePresence>
          {filtered.map((tx, idx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card className="shadow-lg">
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">
                        {formatAmount(tx.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tx.groupName ?? tx.groupId ?? "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {tx.date
                          ? new Date(
                              tx.date,
                            ).toLocaleString()
                          : "-"}
                      </div>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <div className="mb-2">
                        <Badge
                          className={statusClass(tx.status)}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {tx.method ?? "-"}
                      </div>
                      <div className="font-mono text-xs">
                        {tx.utr ?? tx.id}
                      </div>
                    </div>
                  </div>
                  {tx.remarks && (
                    <div className="mt-3 text-sm text-gray-700">
                      Remarks: {tx.remarks}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && !loading && (
          <div className="text-center text-sm text-gray-500">
            No transactions found
          </div>
        )}
      </div>

      
    </div>
  );
}
