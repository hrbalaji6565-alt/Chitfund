// src/app/admin/invoices/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, CardContent } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { User, FileText, Printer, Download, Send } from "lucide-react";
import { fetchMembers } from "@/store/memberSlice";
import type { RootState, AppDispatch } from "@/store/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Badge } from "@/app/components/ui/badge";
import jsPDF from "jspdf";

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
  status?: string | null;   // ⭐ NEW
  _source?: string;
};


type FetchJsonResult = { ok: boolean; status: number; body: unknown };

type InvoiceDetails = {
  installmentMonth: string;
  penaltyAmount: number;
  remainingAmount: number;
  totalPayable: number;
  statusLabel: string;
};

type MinimalShareData = {
  title?: string;
  text?: string;
  url?: string;
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
  const pad = (n: number) => String(n).padStart(2, "0");
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

// ----- Allocation helpers (same style as /admin/transactions) -----

const parseAllocationArray = (input: unknown): AllocationDetail[] | undefined => {
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
        0
    );

    const penaltyPaid = toNumber(
      item.penaltyPaid ??
        item.penalty ??
        item.pen ??
        item.penaltyApplied ??
        0
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
  raw: UnknownRecord
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
      rm.appliedAllocation
    );
  }

  for (const c of candidates) {
    if (typeof c === "string") {
      try {
        const parsed = JSON.parse(c) as unknown;
        const arr = parseAllocationArray(parsed);
        if (arr && arr.length) return arr;
      } catch {
        // ignore parse error
      }
    } else {
      const arr = parseAllocationArray(c);
      if (arr && arr.length) return arr;
    }
  }

  return undefined;
};

// ✅ Single source of truth: yahi se har jagah penalty niklega
const getPenaltyForPayment = (p: PendingPayment): number => {
  // 1) allocationDetails se sum lo (ye hi breakdown mein dikh raha hai)
  if (p.allocationDetails && p.allocationDetails.length) {
    const total = p.allocationDetails.reduce((sum, d) => {
      const val = toNumber(d.penaltyPaid);
      return sum + (val || 0);
    }, 0);
    if (total > 0) return total;
  }

  // 2) allocationSummary object se
  if (isRecord(p.allocationSummary)) {
    const a = p.allocationSummary as UnknownRecord;
    const penaltyCandidate =
      a.penalty ?? a.lateFee ?? a.fine ?? a.penaltyAmount ?? a.charges;
    if (penaltyCandidate !== undefined) {
      const val = toNumber(penaltyCandidate);
      if (val > 0) return val;
    }
  }

  // 3) allocationSummary string ho toh parse karke array/object scan karo
  if (typeof p.allocationSummary === "string") {
    try {
      const parsed = JSON.parse(p.allocationSummary) as unknown;
      if (Array.isArray(parsed)) {
        const arr = parseAllocationArray(parsed);
        if (arr && arr.length) {
          const total = arr.reduce((sum, d) => sum + toNumber(d.penaltyPaid), 0);
          if (total > 0) return total;
        }
      } else if (isRecord(parsed)) {
        const a = parsed as UnknownRecord;
        const penaltyCandidate =
          a.penalty ?? a.lateFee ?? a.fine ?? a.penaltyAmount ?? a.charges;
        if (penaltyCandidate !== undefined) {
          const val = toNumber(penaltyCandidate);
          if (val > 0) return val;
        }
      }
    } catch {
      // ignore
    }
  }

  return 0;
};

const computeInvoiceDetails = (p: PendingPayment): InvoiceDetails => {
  const installmentMonth = formatMonthYear(p.createdAt);
  const penaltyAmount = getPenaltyForPayment(p);

  let remainingAmount = 0;

  if (isRecord(p.allocationSummary)) {
    const a = p.allocationSummary as UnknownRecord;
    const remainingCandidate =
      a.remaining ??
      a.remainingAmount ??
      a.balanceRemaining ??
      a.balanceDue ??
      a.outstanding ??
      a.due;

    if (remainingCandidate !== undefined) {
      remainingAmount = toNumber(remainingCandidate);
    }
  }

  const statusLower = (p.status ?? "").toLowerCase();
  const isApproved = statusLower === "approved" || p.verified === true;

  // ⭐ Agar approved hai, default remaining 0
  if (!remainingAmount) {
    remainingAmount = isApproved ? 0 : p.amount;
  }

  const totalPayable = p.amount + penaltyAmount;

  // ⭐ Status label bhi status field + verified se banao
  let statusLabel: string;
  if (isApproved) {
    statusLabel = "Approved";
  } else if (statusLower === "rejected") {
    statusLabel = "Rejected";
  } else if (statusLower === "pending") {
    statusLabel = "Pending Verification";
  } else {
    statusLabel = statusLower || "Pending Verification";
  }

  return {
    installmentMonth,
    penaltyAmount,
    remainingAmount,
    totalPayable,
    statusLabel,
  };
};


// ---------- PDF + Share helpers ----------

const createInvoicePdfFromPayment = (
  payment: PendingPayment,
  memberName: string,
  groupName: string,
  details: InvoiceDetails
): jsPDF => {
  const doc = new jsPDF();
  const centerX = 105;
  let y = 20;

  const idStr = payment._id || "";
  const shortId = idStr.slice(-6);
  const invoiceNo = `INV-${shortId.padStart(6, "0").toUpperCase()}`;

  doc.setFontSize(18);
  doc.text("ChitFund Pro Pvt. Ltd.", centerX, y, { align: "center" });
  y += 8;
  doc.setFontSize(11);
  doc.text("Smart Monthly Collection System", centerX, y, { align: "center" });
  y += 5;
  doc.text(
    "Email: support@chitfundpro.com  |  Phone: +91-98765-43210",
    centerX,
    y,
    { align: "center" }
  );

  y += 12;
  doc.setFontSize(16);
  doc.text("INVOICE", centerX, y, { align: "center" });

  y += 14;
  doc.setFontSize(11);
  doc.text(`Invoice No: ${invoiceNo}`, 20, y);
  doc.text(`Group: ${groupName}`, 120, y);
  y += 6;
  const genDate = formatDate(new Date().toISOString());
  doc.text(`Installment Month: ${details.installmentMonth}`, 20, y);
  doc.text(`Generated: ${genDate}`, 120, y);
  y += 6;

  const paymentDateLabel = payment.createdAt
    ? formatDate(payment.createdAt)
    : "N/A";
  doc.text(`Payment Date: ${paymentDateLabel}`, 20, y);
  doc.text(`Status: ${details.statusLabel}`, 120, y);

  y += 12;
  doc.setFontSize(12);
  doc.text("Bill To:", 20, y);
  y += 6;
  doc.setFontSize(11);
  doc.text(memberName, 20, y);
  y += 6;
  doc.text(`Member ID: ${payment.memberId ?? "-"}`, 20, y);

  y += 12;
  doc.setFontSize(12);
  doc.text("Payment Details", 20, y);
  y += 6;

  doc.setFontSize(11);
  doc.text("Description", 20, y);
  doc.text("Amount (₹)", 150, y, { align: "right" });
  y += 4;
  doc.line(20, y, 190, y);
  y += 6;

  doc.text("Monthly Chit Installment", 20, y);
  doc.text(payment.amount.toLocaleString(), 150, y, { align: "right" });
  y += 8;

  if (details.penaltyAmount > 0) {
    doc.text("Penalty", 20, y);
    doc.text(details.penaltyAmount.toLocaleString(), 150, y, { align: "right" });
    y += 8;
  }

  doc.text("Remaining for this month", 20, y);
  doc.text(details.remainingAmount.toLocaleString(), 150, y, { align: "right" });
  y += 10;

  doc.setFontSize(12);
  doc.text("Total Payable (Installment + Penalty)", 20, y);
  doc.text(details.totalPayable.toLocaleString(), 150, y, { align: "right" });
  y += 10;

  doc.setFontSize(11);
  doc.text(`UTR / Ref: ${payment.utr ?? "-"}`, 20, y);
  y += 6;
  if (payment.note) {
    doc.text(`Note: ${payment.note}`, 20, y);
    y += 6;
  }

  if (payment.allocationDetails && payment.allocationDetails.length > 0) {
    y += 4;
    doc.setFontSize(11);
    doc.text("Allocation breakdown:", 20, y);
    y += 6;

    for (const ad of payment.allocationDetails) {
      const line = `Month ${ad.monthIndex}: principal ₹${ad.principalPaid.toLocaleString()}${
        ad.penaltyPaid ? ` • penalty ₹${ad.penaltyPaid.toLocaleString()}` : ""
      }`;
      doc.text(line, 20, y);
      y += 6;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    }
  }

  y = 280;
  doc.setFontSize(9);
  doc.text(
    "This is a computer-generated invoice and does not require a signature.",
    centerX,
    y,
    { align: "center" }
  );

  return doc;
};

const buildShareText = (
  payment: PendingPayment,
  memberName: string,
  groupName: string,
  details: InvoiceDetails
): string => {
  const idStr = payment._id || "";
  const shortId = idStr.slice(-6);
  const invoiceNo = `INV-${shortId.padStart(6, "0").toUpperCase()}`;
  const paymentDateLabel = payment.createdAt
    ? formatDate(payment.createdAt)
    : "N/A";

  const lines: string[] = [
    `Invoice: ${invoiceNo}`,
    `Member: ${memberName}`,
    `Member ID: ${payment.memberId ?? "-"}`,
    `Group: ${groupName}`,
    `Installment Month: ${details.installmentMonth}`,
    `Amount: ₹${payment.amount.toLocaleString()}`,
    `Penalty: ₹${details.penaltyAmount.toLocaleString()}`,
    `Total Payable: ₹${details.totalPayable.toLocaleString()}`,
    `Remaining for month: ₹${details.remainingAmount.toLocaleString()}`,
    `Status: ${details.statusLabel}`,
    `Payment Date: ${paymentDateLabel}`,
    `UTR / Ref: ${payment.utr ?? "-"}`,
  ];

  if (payment.allocationDetails && payment.allocationDetails.length > 0) {
    lines.push("", "Allocation breakdown:");
    for (const ad of payment.allocationDetails) {
      const line = `Month ${ad.monthIndex}: principal ₹${ad.principalPaid.toLocaleString()}${
        ad.penaltyPaid ? ` • penalty ₹${ad.penaltyPaid.toLocaleString()}` : ""
      }`;
      lines.push(line);
    }
  }

  if (payment.note) {
    lines.push(`Note: ${payment.note}`);
  }

  return lines.join("\n");
};

// ---------- Component ----------

export default function AdminInvoicesPage(): React.ReactElement {
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
        : { id: String(it ?? ""), name: undefined }
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
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(
    null
  );

  const log = (msg: string) => {
    console.debug("[admin/invoices]", msg);
  };

  async function fetchJson(url: string, init?: RequestInit): Promise<FetchJsonResult> {
    const res = await fetch(url, { credentials: "include", ...init });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }

  function normalizePayment(
  raw: unknown,
  fallbackGroupId?: string,
  fallbackGroupName?: string,
  src?: string
): PendingPayment {
  const r: UnknownRecord = isRecord(raw) ? raw : {};

  const memberFromMeta = isRecord(r.member) ? r.member : undefined;
  const groupFromMeta = isRecord(r.group) ? r.group : undefined;
  const rawMeta = isRecord(r.rawMeta) ? r.rawMeta : undefined;

  const memberId = asOptString(
    r.memberId ?? (memberFromMeta ? memberFromMeta._id : undefined) ?? r.userId
  );
  const memberName = asOptString(
    r.memberName ?? (memberFromMeta ? memberFromMeta.name : undefined) ?? r.name
  );
  const groupId = asOptString(
    r.groupId ?? (groupFromMeta ? groupFromMeta._id : undefined) ?? fallbackGroupId
  );
  const groupName = asOptString(
    r.groupName ??
      (groupFromMeta ? groupFromMeta.name : undefined) ??
      fallbackGroupName
  );
  const amount = Number(r.amount ?? r.amt ?? 0) || 0;
  const createdAt = asOptString(r.createdAt ?? r.date);

  // ⭐ NEW: status read karo
  const status = asOptString(r.status ?? r.state);

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

  // ⭐ IMPORTANT: yahan fix – approved status ko verified मानो
  const statusLower = (status ?? "").toLowerCase();
  const verified =
    statusLower === "approved" ||
    Boolean(r.verified ?? false) ||
    Boolean(r.approvedAt ?? false);

  return {
    _id: asOptString(r._id ?? r.id ?? Math.random().toString(36).slice(2)) ?? "",
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
    status: status ?? null,       // ⭐ store bhi kar rahe
    _source: src,
  };
}


  async function load() {
    setLoading(true);
    setError(null);
    setPayments([]);
    try {
      log("Trying /api/admin/transactions for invoices");
      const adminResp = await fetchJson("/api/admin/transactions");

      if (adminResp.ok) {
        let listUnknown: unknown[] = [];
        if (
          isRecord(adminResp.body) &&
          Array.isArray((adminResp.body as UnknownRecord).payments)
        ) {
          listUnknown = (adminResp.body as UnknownRecord).payments as unknown[];
        } else if (Array.isArray(adminResp.body)) {
          listUnknown = adminResp.body as unknown[];
        }

        if (listUnknown.length > 0) {
          setPayments(
            listUnknown.map((r: unknown) =>
              normalizePayment(r, undefined, undefined, "/api/admin/transactions")
            )
          );
          setLoading(false);
          return;
        }
        log("/api/admin/transactions returned empty list");
      } else {
        log(`/api/admin/transactions returned ${adminResp.status}`);
      }

      log("Fetching /api/chitgroups for fallback (invoices)");
      const gResp = await fetchJson("/api/chitgroups");
      if (!gResp.ok) {
        log(`/api/chitgroups returned ${gResp.status}`);
        setError("No payments and fallback failed. Ensure admin session is active.");
        setLoading(false);
        return;
      }

      const bodyGroups = gResp.body;
      let groupsArr: unknown[] = [];
      if (isRecord(bodyGroups) && Array.isArray((bodyGroups as UnknownRecord).groups)) {
        groupsArr = (bodyGroups as UnknownRecord).groups as unknown[];
      } else if (Array.isArray(bodyGroups)) {
        groupsArr = bodyGroups as unknown[];
      }

      const concurrency = 6;
      const pending: PendingPayment[] = [];

      async function fetchGroupPayments(g: UnknownRecord) {
        const gid = asOptString(g._id ?? g.id) ?? "";
        if (!gid) return;
        const pUrl = `/api/chitgroups/${encodeURIComponent(gid)}/payments?all=true`;
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
          Array.isArray((bodyPayments as UnknownRecord).payments)
        ) {
          arr = (bodyPayments as UnknownRecord).payments as unknown[];
        }

        const fallbackName = asOptString(g.name ?? g.groupName);
        for (const item of arr) {
          pending.push(
            normalizePayment(item, gid, fallbackName || undefined, "fallback")
          );
        }
      }

      for (let i = 0; i < groupsArr.length; i += concurrency) {
        const slice = groupsArr.slice(i, i + concurrency);
        await Promise.all(
          slice.map((gg: unknown) =>
            isRecord(gg) ? fetchGroupPayments(gg) : Promise.resolve()
          )
        );
      }

      log(`Fallback found ${pending.length} payments across groups`);
      setPayments(pending);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    [payments, search, memberNameMap]
  );

  const handleDownloadInvoice = (p: PendingPayment) => {
    const memberName = getDisplayMemberName(p);
    const groupName = getDisplayGroupName(p);
    const details = computeInvoiceDetails(p);
    const doc = createInvoicePdfFromPayment(p, memberName, groupName, details);

    const idStr = p._id || "";
    const shortId = idStr.slice(-6);
    const invoiceNo = `INV-${shortId.padStart(6, "0").toUpperCase()}`;

    doc.save(`${invoiceNo}.pdf`);
  };

  const handlePrintInvoice = (p: PendingPayment) => {
    if (typeof window === "undefined") return;
    const memberName = getDisplayMemberName(p);
    const groupName = getDisplayGroupName(p);
    const details = computeInvoiceDetails(p);
    const doc = createInvoicePdfFromPayment(p, memberName, groupName, details);
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl, "_blank");
  };

  const handleShareInvoice = async (p: PendingPayment) => {
    if (typeof navigator === "undefined") return;

    const nav = navigator as Navigator & {
      share?: (data: MinimalShareData) => Promise<void>;
    };

    if (typeof nav.share !== "function") {
      window.alert("Sharing is not supported in this browser.");
      return;
    }

    const details = computeInvoiceDetails(p);
    const memberName = getDisplayMemberName(p);
    const groupName = getDisplayGroupName(p);
    const text = buildShareText(p, memberName, groupName, details);

    try {
      await nav.share({
        title: "ChitFund Pro Invoice",
        text,
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 min-h-screen bg-[var(--bg-main)]">
      <h1 className="text-2xl font-semibold mb-4">Invoices</h1>

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
        <div className="text-sm text-gray-500 mb-4">Loading invoices…</div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && !loading && (
          <div className="text-sm text-gray-500">No payments.</div>
        )}

        {filtered.map((p) => {
          const displayName = getDisplayMemberName(p);
          const displayGroup = getDisplayGroupName(p);
          const details = computeInvoiceDetails(p);

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
                        <Badge variant="outline" className="text-[10px]">
                          {details.statusLabel}
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
                      <div className="text-xs text-gray-500">Amount</div>
                      <div className="font-semibold">
                        ₹{Number(p.amount).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">UTR / Ref</div>
                      <div className="font-medium">{p.utr ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Received</div>
                      <div className="text-xs text-gray-500">
                        {p.createdAt ? formatDate(p.createdAt) : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">
                        Installment Month
                      </div>
                      <div className="font-medium">
                        {details.installmentMonth}
                      </div>
                    </div>
                 
                  </div>

                  {p.allocationDetails && p.allocationDetails.length > 0 && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <div className="font-medium">Allocation breakdown</div>
                      {p.allocationDetails.map((ad) => (
                        <div key={`${ad.monthIndex}_${ad.principalPaid}`}>
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
                </div>

                <div className="flex flex-col gap-3 items-end">
                  <div className="text-sm text-gray-500">Payment ID</div>
                  <div className="font-mono text-xs">{p._id}</div>

                  <div className="mt-3 flex flex-wrap gap-2 justify-end">
                    <Dialog
                      open={selectedPayment?._id === p._id}
                      onOpenChange={(open) => {
                        if (open) {
                          setSelectedPayment(p);
                        } else {
                          setSelectedPayment(null);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setSelectedPayment(p)}
                          disabled={!p.verified}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Invoice
                        </Button>
                      </DialogTrigger>

                      {/* Dialog: max height + inner scroll + bottom-fixed buttons */}
                      <DialogContent className="max-w-3xl w-full max-h-[80vh] flex flex-col">
                        <DialogHeader>
                          <DialogTitle>Payment Invoice</DialogTitle>
                        </DialogHeader>

                        {selectedPayment && selectedPayment._id === p._id && (
                          <div className="flex flex-col flex-1 overflow-hidden ">
                            {/* Scrollable body */}
                            <div className="space-y-6 py-4 bg-white rounded-2xl p-6 overflow-y-auto flex-1">
                              <div className="mb-4 text-center">
                                <h2 className="text-2xl font-bold">
                                  ChitFund Pro Pvt. Ltd.
                                </h2>
                                <p className="text-sm text-gray-600">
                                  Smart Monthly Collection System
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Email: support@chitfundpro.com · Phone:
                                  +91-98765-43210
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border rounded-2xl p-4 mb-4">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">
                                    Invoice For
                                  </p>
                                  <p className="text-lg font-bold">
                                    {displayName}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {displayGroup}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-3 mb-1">
                                    Member ID
                                  </p>
                                  <p className="text-sm font-medium">
                                    {p.memberId ?? "-"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">
                                    Installment Month
                                  </p>
                                  <p className="text-sm font-medium">
                                    {details.installmentMonth}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-3 mb-1">
                                    Payment Date
                                  </p>
                                  <p className="text-sm font-medium">
                                    {p.createdAt
                                      ? formatDate(p.createdAt)
                                      : "N/A"}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-3 mb-1">
                                    Status
                                  </p>
                                  <Badge className="text-xs">
                                    {details.statusLabel}
                                  </Badge>
                                </div>
                              </div>

                              <div className="border rounded-2xl overflow-hidden mb-4">
                                <table className="w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="text-left py-3 px-4 text-sm font-semibold">
                                        Description
                                      </th>
                                      <th className="text-right py-3 px-4 text-sm font-semibold">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="border-b">
                                      <td className="py-3 px-4 text-sm">
                                        Monthly Chit Installment
                                      </td>
                                      <td className="py-3 px-4 text-right font-semibold text-sm">
                                        ₹{p.amount.toLocaleString()}
                                      </td>
                                    </tr>
                                    
                                  </tbody>
                                </table>
                              </div>

                              {p.allocationDetails &&
                                p.allocationDetails.length > 0 && (
                                  <div className="mb-4">
                                    <p className="text-sm font-medium mb-1">
                                      Allocation breakdown
                                    </p>
                                    <div className="text-xs text-gray-600 space-y-1">
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
                                  </div>
                                )}

                              <div className="flex flex-col gap-2 items-end mb-4">
                                <div className="flex justify-between w-full md:w-80">
                                  <span className="text-sm text-gray-600">
                                    Total Payable (Installment + Penalty)
                                  </span>
                                  <span className="text-base font-bold">
                                    ₹{details.totalPayable.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between w-full md:w-80">
                                  <span className="text-sm text-gray-600">
                                    UTR / Ref
                                  </span>
                                  <span className="text-sm font-medium">
                                    {p.utr ?? "-"}
                                  </span>
                                </div>
                              </div>

                              {p.note && (
                                <p className="text-xs text-gray-600">
                                  Note: {p.note}
                                </p>
                              )}

                              <p className="text-xs text-gray-500">
                                This is a computer-generated invoice and does not
                                require a signature. Remaining amount indicates
                                unpaid balance for this month including
                                penalties.
                              </p>
                            </div>

                            {/* Fixed footer buttons */}
                            <div className="flex flex-wrap justify-end gap-3 mt-4 pt-3 border-t bg-white">
                              <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => handleShareInvoice(p)}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Share
                              </Button>
                              <Button
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => handlePrintInvoice(p)}
                              >
                                <Printer className="w-4 h-4 mr-2" />
                                Print
                              </Button>
                              <Button
                                className="rounded-xl"
                                onClick={() => handleDownloadInvoice(p)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download PDF
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleDownloadInvoice(p)}
                      disabled={!p.verified}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => handleShareInvoice(p)}
                      disabled={!p.verified}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
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
