"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { User, Check, X } from "lucide-react";
import { fetchMembers } from "@/store/memberSlice";
import type { RootState, AppDispatch } from "@/store/store";
import { Badge } from "@/app/components/ui/badge";

type UnknownRecord = Record<string, unknown>;

type AllocationDetail = {
  monthIndex: number;
  principalPaid: number;
  penaltyPaid: number;
};

type PendingPayment = {
  _id: string;
  memberId?: string | null;
  memberName?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  amount: number;
  utr?: string | null;
  note?: string | null;
  fileUrl?: string | null;
  createdAt?: string;
  allocationSummary?: unknown;
  allocationDetails?: AllocationDetail[];
  verified?: boolean;
  status?: string | null;
  method?: string | null;
  collectedVia?: string | null;
  collectorRole?: string | null;
  collectedById?: string | null;
  collectorName?: string | null;
  _source?: string;
};

type FetchJsonResult = { ok: boolean; status: number; body: unknown };

type CollectionUser = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asOptString = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  try {
    return String(v);
  } catch {
    return undefined;
  }
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatDate = (iso?: string): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = (n: number) => String(n).toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatMonthYear = (iso?: string): string => {
  if (!iso) return "N/A";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "N/A";
  return new Date(t).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

/**
 * Penalty priority:
 * 1) allocationDetails[].penaltyPaid sum (if > 0)
 * 2) allocationSummary fields (penalty / lateFee / fine / penaltyAmount / charges)
 */
const getPenaltyForPayment = (p: PendingPayment): number => {
  let fromDetails = 0;

  if (p.allocationDetails && p.allocationDetails.length) {
    fromDetails = p.allocationDetails.reduce((sum, d) => {
      const val =
        typeof d.penaltyPaid === "number"
          ? d.penaltyPaid
          : toNumber(d.penaltyPaid);
      return sum + (val || 0);
    }, 0);
  }

  if (fromDetails > 0) return fromDetails;

  if (isRecord(p.allocationSummary)) {
    const a = p.allocationSummary as UnknownRecord;
    const penaltyCandidate =
      a.penalty ?? a.lateFee ?? a.fine ?? a.penaltyAmount ?? a.charges;
    if (penaltyCandidate !== undefined) {
      return toNumber(penaltyCandidate);
    }
  }

  return 0;
};

const parseAllocationArray = (
  input: unknown,
): AllocationDetail[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const out: AllocationDetail[] = [];

  for (const item of input) {
    if (!isRecord(item)) continue;

    const rawMonth = item.monthIndex ?? item.idx ?? item.month ?? item.mindex;
    let monthIndex = typeof rawMonth === "number" ? rawMonth : 1;
    if (monthIndex >= 0 && monthIndex < 1) monthIndex += 1;

    const principalPaid = toNumber(
      item.principalPaid ??
        item.principal ??
        item.prc ??
        item.pr ??
        item.amount ??
        item.apply ??
        0,
    );

    const penaltyPaid = toNumber(
      item.penaltyPaid ??
        item.penalty ??
        item.pen ??
        item.penaltyApplied ??
        0,
    );

    out.push({
      monthIndex: Math.max(1, Math.round(monthIndex)),
      principalPaid,
      penaltyPaid,
    });
  }

  return out.length ? out : undefined;
};

const parseAllocationsFromRecord = (
  raw: UnknownRecord,
): AllocationDetail[] | undefined => {
  const candidates: unknown[] = [
    raw.allocation,
    raw.allocated,
    raw.allocationSummary,
    raw.allocationDetails,
  ];

  if (isRecord(raw.rawMeta)) {
    const rm = raw.rawMeta;
    candidates.push(
      rm.allocation,
      rm.allocated,
      rm.allocationSummary,
      rm.allocationDetails,
      rm.appliedAllocation,
    );
  }

  for (const c of candidates) {
    if (typeof c === "string") {
      try {
        const parsed = JSON.parse(c) as unknown;
        const arr = parseAllocationArray(parsed);
        if (arr && arr.length) return arr;
      } catch {
        // ignore
      }
    } else {
      const arr = parseAllocationArray(c);
      if (arr && arr.length) return arr;
    }
  }

  return undefined;
};

function normalizePayment(
  raw: unknown,
  fallbackGroupId?: string,
  fallbackGroupName?: string,
  src?: string,
): PendingPayment {
  const r: UnknownRecord = isRecord(raw) ? raw : {};

  const memberFromMeta = isRecord(r.member) ? r.member : undefined;
  const groupFromMeta = isRecord(r.group) ? r.group : undefined;

  const memberId = asOptString(
    r.memberId ??
      (memberFromMeta ? memberFromMeta._id : undefined) ??
      r.userId,
  );
  const memberName = asOptString(
    r.memberName ??
      (memberFromMeta ? memberFromMeta.name : undefined) ??
      r.name,
  );
  const groupId = asOptString(
    r.groupId ??
      (groupFromMeta ? groupFromMeta._id : undefined) ??
      fallbackGroupId,
  );
  const groupName = asOptString(
    r.groupName ??
      (groupFromMeta ? groupFromMeta.name : undefined) ??
      fallbackGroupName,
  );
  const amount = Number(r.amount ?? r.amt ?? 0) || 0;
  const createdAt = asOptString(r.createdAt ?? r.date);
  const status = asOptString(r.status);

  const rawMeta = isRecord(r.rawMeta) ? r.rawMeta : undefined;

  const rawMode = asOptString(
    r.method ??
      r.paymentMode ??
      r.mode ??
      r.type ??
      (rawMeta
        ? (rawMeta as UnknownRecord).method ??
          (rawMeta as UnknownRecord).paymentMode ??
          (rawMeta as UnknownRecord).mode
        : undefined),
  );

  // normalize to 'cash' / 'upi' / null
  let method: string | null = null;
  if (rawMode) {
    const m = rawMode.toLowerCase();
    if (m.includes("cash")) {
      method = "cash";
    } else if (
      m.includes("upi") ||
      m.includes("gpay") ||
      m.includes("phonepe") ||
      m.includes("paytm") ||
      m.includes("bank") ||
      m.includes("online") ||
      m.includes("neft") ||
      m.includes("rtgs") ||
      m.includes("imps")
    ) {
      method = "upi";
    }
  }

  const allocationSummary: unknown =
    (rawMeta && rawMeta.allocationSummary !== undefined
      ? rawMeta.allocationSummary
      : undefined) ??
    (rawMeta && rawMeta.appliedAllocation !== undefined
      ? rawMeta.appliedAllocation
      : undefined) ??
    (rawMeta && rawMeta.allocation !== undefined
      ? rawMeta.allocation
      : undefined) ??
    r.allocationSummary ??
    r.allocation ??
    undefined;
  const allocationDetails = parseAllocationsFromRecord(r);

  const utrValue =
    r.utr !== undefined
      ? r.utr
      : r.txnId !== undefined
      ? r.txnId
      : r.reference !== undefined
      ? r.reference
      : undefined;
  const noteValue =
    r.note !== undefined
      ? r.note
      : r.adminNote !== undefined
      ? r.adminNote
      : undefined;
  const fileValue =
    r.fileUrl !== undefined
      ? r.fileUrl
      : r.attachment !== undefined
      ? r.attachment
      : undefined;

  const statusLower = (status ?? "").toLowerCase();
  const verified = statusLower === "approved" || Boolean(r.verified ?? false);

  const collectedVia = rawMeta ? asOptString(rawMeta.collectedVia) : undefined;
  const collectorRole = rawMeta ? asOptString(rawMeta.collectorRole) : undefined;
  const collectedById = rawMeta ? asOptString(rawMeta.collectedById) : undefined;
  const collectorName = rawMeta
    ? asOptString(
        rawMeta.collectorName ??
          (rawMeta as UnknownRecord).collectedByName,
      )
    : undefined;

  return {
    _id:
      asOptString(r._id ?? r.id ?? Math.random().toString(36).slice(2)) ??
      "",
    memberId: memberId ?? null,
    memberName: memberName ?? null,
    groupId: groupId ?? null,
    groupName: groupName ?? null,
    amount,
    utr: asOptString(utrValue) ?? null,
    note: asOptString(noteValue) ?? null,
    fileUrl: asOptString(fileValue) ?? null,
    createdAt,
    allocationSummary,
    allocationDetails,
    verified,
    status: status ?? null,
    method: method ?? null,
    collectedVia: collectedVia ?? null,
    collectorRole: collectorRole ?? null,
    collectedById: collectedById ?? null,
    collectorName: collectorName ?? null,
    _source: src,
  };
}

export default function AdminTransactionsPage(): React.ReactElement {
  const dispatch = useDispatch<AppDispatch>();

  const membersFromStore = useSelector((s: RootState) => {
    const ms = (s as unknown as Record<string, unknown>)["members"] as
      | Record<string, unknown>
      | undefined;
    const arr = Array.isArray(ms?.list)
      ? ms.list
      : Array.isArray(ms?.items)
      ? ms.items
      : Array.isArray(ms?.members)
      ? ms.members
      : [];
    return (arr as unknown[]).map((it) =>
      isRecord(it)
        ? {
            id: String(it._id ?? it.id ?? ""),
            name: typeof it.name === "string" ? it.name : undefined,
          }
        : { id: String(it ?? ""), name: undefined },
    );
  });

  useEffect(() => {
    if (!membersFromStore.length) dispatch(fetchMembers());
  }, [dispatch, membersFromStore.length]);

  const memberNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mm of membersFromStore) {
      if (mm.id) m[mm.id] = mm.name ?? mm.id;
    }
    return m;
  }, [membersFromStore]);

  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {},
  );

  // collection users list (for "Collected By" name)
  const [collectionUsers, setCollectionUsers] = useState<CollectionUser[]>([]);

  const log = (msg: string) => {
    console.debug("[admin/transactions]", msg);
  };

  async function fetchJson(
    url: string,
    init?: RequestInit,
  ): Promise<FetchJsonResult> {
    const res = await fetch(url, {
      credentials: "include",
      ...init,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }

  // load collection users list
  useEffect(() => {
    const loadCollectionUsers = async () => {
      try {
        const resp = await fetchJson("/api/admin/collection-users");
        if (!resp.ok) {
          log(
            `/api/admin/collection-users returned ${resp.status}`,
          );
          return;
        }

                const body = resp.body;
        let arr: unknown[] = [];

        if (Array.isArray(body)) {
          arr = body as unknown[];
        } else if (isRecord(body) && Array.isArray(body.users)) {
          arr = body.users as unknown[];
        } else if (isRecord(body) && Array.isArray(body.items)) {
          arr = body.items as unknown[];
        }

        const normalized: CollectionUser[] = [];

        for (const u of arr) {
          const r = isRecord(u) ? u : {};

          const id = asOptString(r._id ?? r.id);
          if (!id) continue;

          const name =
            asOptString(
              r.name ??
                r.fullName ??
                r.displayName ??
                r.username,
            ) ?? undefined;

          const email =
            asOptString(
              r.email ?? r.mail ?? r.userEmail,
            ) ?? undefined;

          const phone =
            asOptString(
              r.phone ??
                r.mobile ??
                r.contactNumber ??
                r.number,
            ) ?? undefined;

          normalized.push({
            id,
            name,
            email,
            phone,
          });
        }

        setCollectionUsers(normalized);

      } catch (err) {
        log(
          `error loading collection users: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    };

    loadCollectionUsers();
  }, []);

  const collectionUserNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of collectionUsers) {
      if (!u.id) continue;
      map[u.id] = u.name ?? u.phone ?? u.email ?? u.id;
    }
    return map;
  }, [collectionUsers]);

  async function load() {
    setLoading(true);
    setError(null);
    setPayments([]);
    try {
      log("Trying /api/admin/transactions");
      const adminResp = await fetchJson(
        "/api/admin/transactions?status=all",
      );

      if (adminResp.ok) {
        let listUnknown: unknown[] = [];
        if (
          isRecord(adminResp.body) &&
          Array.isArray(adminResp.body.payments)
        ) {
          listUnknown = adminResp.body.payments as unknown[];
        } else if (Array.isArray(adminResp.body)) {
          listUnknown = adminResp.body as unknown[];
        }

        if (listUnknown.length > 0) {
          setPayments(
            listUnknown.map((r) =>
              normalizePayment(
                r,
                undefined,
                undefined,
                "/api/admin/transactions",
              ),
            ),
          );
          setLoading(false);
          return;
        }
        log("/api/admin/transactions returned empty list");
      } else {
        log(
          `/api/admin/transactions returned ${adminResp.status}`,
        );
      }

      // Fallback: chitgroups + per-group payments
      log("Fetching /api/chitgroups for fallback");
      const gResp = await fetchJson("/api/chitgroups");
      if (!gResp.ok) {
        log(`/api/chitgroups returned ${gResp.status}`);
        setError(
          "No pending transactions and fallback failed. Ensure admin session is active.",
        );
        setLoading(false);
        return;
      }

      const bodyGroups = gResp.body;
      let groupsArr: unknown[] = [];
      if (
        isRecord(bodyGroups) &&
        Array.isArray(bodyGroups.groups)
      ) {
        groupsArr = bodyGroups.groups as unknown[];
      } else if (Array.isArray(bodyGroups)) {
        groupsArr = bodyGroups as unknown[];
      }

      const concurrency = 6;
      const pending: PendingPayment[] = [];

      async function fetchGroupPayments(g: UnknownRecord) {
        const gid = asOptString(g._id ?? g.id) ?? "";
        if (!gid) return;
        const pUrl = `/api/chitgroups/${encodeURIComponent(
          gid,
        )}/payments?all=true`;
        log(`Fetching ${pUrl}`);
        const pRes = await fetchJson(pUrl);
        if (!pRes.ok) {
          log(` -> ${pUrl} returned ${pRes.status}`);
          return;
        }

        const bodyPayments = pRes.body;
        let arr: unknown[] = [];
        if (Array.isArray(bodyPayments)) {
          arr = bodyPayments as unknown[];
        } else if (
          isRecord(bodyPayments) &&
          Array.isArray(bodyPayments.payments)
        ) {
          arr = bodyPayments.payments as unknown[];
        }

        const fallbackName = asOptString(
          g.name ?? g.groupName,
        );
        for (const item of arr) {
          pending.push(
            normalizePayment(
              item,
              gid,
              fallbackName || undefined,
              "fallback",
            ),
          );
        }
      }

      for (let i = 0; i < groupsArr.length; i += concurrency) {
        const slice = groupsArr.slice(i, i + concurrency);
        await Promise.all(
          slice.map((gg) =>
            isRecord(gg)
              ? fetchGroupPayments(gg)
              : Promise.resolve(),
          ),
        );
      }

      log(`Fallback found ${pending.length} payments across groups`);
      setPayments(pending);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAction(paymentId: string, approve: boolean) {
    setError(null);
    setActionLoading((s) => ({ ...s, [paymentId]: true }));
    try {
      const existing = payments.find((x) => x._id === paymentId);
      const gid = existing?.groupId ?? undefined;
      const url = gid
        ? `/api/chitgroups/${encodeURIComponent(
            gid,
          )}/payments/approve`
        : "/api/admin/transactions";

      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          approve,
          adminNote: approve
            ? "Approved via admin UI"
            : "Rejected via admin UI",
        }),
      });

      const j: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        let errMsg = res.statusText || "Action failed";
        if (isRecord(j)) {
          const jRec = j as UnknownRecord;
          const errVal =
            jRec.error !== undefined
              ? jRec.error
              : jRec.message !== undefined
              ? jRec.message
              : undefined;
          if (typeof errVal === "string") errMsg = errVal;
        }
        throw new Error(errMsg);
      }

      let returnedRaw: unknown = undefined;
      if (isRecord(j) && isRecord(j.payment)) {
        returnedRaw = j.payment as unknown;
      } else if (isRecord(j)) {
        returnedRaw = j;
      }

      const normalized = normalizePayment(
        returnedRaw,
        existing?.groupId ?? undefined,
        existing?.groupName ?? undefined,
        existing?._source ?? undefined,
      );
      setPayments((cur) =>
        cur.map((p) => (p._id === paymentId ? normalized : p)),
      );
      log(
        `Action ${approve ? "approve" : "reject"} ok for ${paymentId}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : String(err),
      );
      log(`Action error: ${String(err)}`);
    } finally {
      setActionLoading((s) => ({ ...s, [paymentId]: false }));
    }
  }

  const getCollectedByLabel = (p: PendingPayment): string => {
    const mappedName =
      p.collectedById &&
      collectionUserNameMap[String(p.collectedById)];
    const baseName =
      p.collectorName || mappedName || p.collectedById || "admin";

    if (!baseName) return "-";

    if (
      p.collectorRole === "collector" ||
      p.collectedVia === "collection-screen"
    ) {
      // sirf collection user ka naam
      return baseName;
    }

    if (p.collectorRole === "admin") {
      return `Admin: ${baseName}`;
    }

    // fallback
    return baseName;
  };

  const getDisplayMemberName = (p: PendingPayment): string =>
    p.memberName ??
    memberNameMap[String(p.memberId ?? "")] ??
    p.memberId ??
    "Member";

  const getDisplayGroupName = (p: PendingPayment): string =>
    p.groupName ?? p.groupId ?? "Group";

  const search = filter.toLowerCase().trim();
  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (!search) return true;
        const displayName = getDisplayMemberName(p).toLowerCase();
        const groupName = getDisplayGroupName(p).toLowerCase();
        const utr = String(p.utr ?? "").toLowerCase();
        const idstr = String(p._id ?? "").toLowerCase();
        return (
          displayName.includes(search) ||
          groupName.includes(search) ||
          utr.includes(search) ||
          idstr.includes(search)
        );
      }),
    [payments, search, memberNameMap],
  );

  return (
    <div className="p-6 min-h-screen bg-[var(--bg-main)]">
      <h1 className="text-2xl font-semibold mb-4">
        Transactions / Pending Payments
      </h1>

      <div className="mb-4">
        <div className="flex gap-3 items-center">
          <Input
            placeholder="Search member / group / UTR..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button onClick={load} className="ml-auto" disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}
      {loading && (
        <div className="text-sm text-gray-500 mb-4">
          Loading pending transactions…
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && !loading && (
          <div className="text-sm text-gray-500">No payments.</div>
        )}

        {filtered.map((p) => {
          const itemLoading = Boolean(actionLoading[p._id]);
          const displayName = getDisplayMemberName(p);
          const displayGroup = getDisplayGroupName(p);
          const allocText =
            typeof p.allocationSummary === "string"
              ? p.allocationSummary
              : JSON.stringify(p.allocationSummary ?? {}, null, 2);

          const penaltyTotal = getPenaltyForPayment(p);
          const installmentMonth = formatMonthYear(p.createdAt);
          const totalWithPenalty = p.amount + penaltyTotal;

          const statusLower = (p.status ?? "").toLowerCase();
          const isApproved =
            statusLower === "approved" || p.verified === true;
          const isCollectionAutoApproved =
            isApproved &&
            (p.collectedVia === "collection-screen" ||
              p.collectorRole != null ||
              p.collectedById != null);

          return (
            <Card key={p._id}>
              <CardContent className="flex flex-col sm:flex-row justify-between gap-3 items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--bg-highlight)] grid place-items-center">
                      <User />
                    </div>
                    <div>
                      <div className="font-semibold text-lg flex items-center gap-2">
                        {displayName}
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                        >
                          {isCollectionAutoApproved
                            ? "Collection (auto-approved)"
                            : isApproved
                            ? "Approved"
                            : "Pending Verification"}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {displayGroup}
                        {p._source ? (
                          <span className="ml-2 text-xs text-gray-400">
                            · {p._source}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">
                        Amount
                      </div>
                      <div className="font-semibold">
                        ₹{Number(p.amount).toLocaleString()}
                      </div>
                      {penaltyTotal > 0 && (
                        <div className="text-[11px] text-gray-500">
                          With penalty: ₹
                          {totalWithPenalty.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        UTR / Ref
                      </div>
                      <div className="font-medium">
                        {p.utr ?? "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Received
                      </div>
                      <div className="text-xs text-gray-500">
                        {p.createdAt
                          ? formatDate(p.createdAt)
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">
                        Installment Month
                      </div>
                      <div className="font-medium">
                        {installmentMonth}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Payment Mode
                      </div>
                      <div className="font-medium">
                        {p.method === "cash"
                          ? "CASH"
                          : p.method === "upi"
                          ? "UPI"
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">
                        Collected By
                      </div>
                      <div className="font-medium text-xs">
                        {getCollectedByLabel(p)}
                      </div>
                    </div>
                  </div>

                  {p.allocationDetails &&
                    p.allocationDetails.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        <div className="font-medium">
                          Allocation breakdown
                        </div>
                        {p.allocationDetails.map((ad) => (
                          <div
                            key={`${ad.monthIndex}_${ad.principalPaid}`}
                          >
                            Month {ad.monthIndex}: principal ₹
                            {ad.principalPaid.toLocaleString()}
                            {ad.penaltyPaid
                              ? ` • penalty ₹${ad.penaltyPaid.toLocaleString()}`
                              : ""}
                          </div>
                        ))}
                      </div>
                    )}

                  {p.note && (
                    <div className="mt-3 text-sm text-gray-700">
                      Note: {p.note}
                    </div>
                  )}

                  {p.fileUrl && (
                    <div className="mt-3">
                      <div className="text-xs text-gray-500 mb-1">
                        Attachment
                      </div>
                      <a
                        className="text-sm text-blue-600 underline"
                        href={String(p.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View file
                      </a>
                    </div>
                  )}

                  {p.allocationSummary != null && (
                    <div className="mt-3 text-sm">
                      <div className="text-xs text-gray-500">
                        Allocation plan (from user)
                      </div>
                      <pre className="text-xs bg-[var(--bg-main)] p-2 rounded max-w-full overflow-auto">
                        {allocText}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 items-end">
                  <div className="text-sm text-gray-500">
                    Payment ID
                  </div>
                  <div className="font-mono text-xs">{p._id}</div>

                  <div className="mt-2 flex gap-2">
                    {isApproved ? (
                      <div className="text-xs text-green-600 font-medium">
                        Approved
                      </div>
                    ) : (
                      <>
                        <Button
                          onClick={() =>
                            handleAction(p._id, true)
                          }
                          className="bg-green-600 hover:bg-green-700"
                          disabled={itemLoading}
                        >
                          {itemLoading ? (
                            "…"
                          ) : (
                            <>
                              <Check /> Approve
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() =>
                            handleAction(p._id, false)
                          }
                          className="bg-red-600 hover:bg-red-700"
                          disabled={itemLoading}
                        >
                          {itemLoading ? (
                            "…"
                          ) : (
                            <>
                              <X /> Reject
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400">
                    For invoice: open{" "}
                    <span className="font-mono">
                      /admin/invoices
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
