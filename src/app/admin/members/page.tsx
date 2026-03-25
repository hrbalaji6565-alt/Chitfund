"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Phone,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import Button from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";

import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchMembers, createMember, updateMember, deleteMember } from "@/store/memberSlice";
import { fetchGroups, updateGroup } from "@/store/chitGroupSlice";
import type { Member } from "@/app/lib/types"; // server-side Member type
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";

// Local subscriber shape used for UI form / previews
interface SubscriberLocal {
  id?: number;
  _id?: string;
  name: string;
  mobile: string;
  userId: string;
  address?: string;
  joiningDate?: string;
  status: "Active" | "Inactive";
  totalPaid?: number;
  pendingAmount?: number;
  aadhaarImage?: string | null; // base64 preview while creating/updating
  govIdImage?: string | null;
  avatarImage?: string | null;
  password?: string;
  // server URLs (when member loaded from server)
  aadhaarUrl?: string;
  govIdUrl?: string;
  avatarUrl?: string;
  attachments?: { id: string; label: string; url: string }[];

  // group fields (read-only on member page)
  groups?: string[]; // array of group ids if supplied by server
  groupId?: string | null; // first/primary group id (legacy)
  groupName?: string | null; // primary group name (legacy)
}

const initialLocalSample: SubscriberLocal = {
  id: 1,
  name: "Rajesh Kumar",
  mobile: "+91 98765 43210",
  userId: "rajesh.kumar@email.com",
  address: "123 MG Road, Bangalore",
  joiningDate: "2024-01-01",
  status: "Active",
  totalPaid: 50000,
  pendingAmount: 5000,
  aadhaarImage: "",
  govIdImage: "",
  avatarImage: "",
  password: "******",
  groupId: undefined,
  groupName: undefined,
  groups: [],
};

// Type-guard helpers to safely read unknown server shapes without using `any`
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

type UnknownRecord = Record<string, unknown>;

function toString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
}

function toNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(val: unknown): string {
  if (val === undefined || val === null) return "";
  return String(val);
}

function getIdFromUnknown(val: unknown): string {
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (isRecord(val)) {
    return toStr(val._id ?? val.id);
  }
  return "";
}

function formatINR(val: number): string {
  return Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeGroupsFromMember(m: unknown): string[] {
  if (!isRecord(m)) return [];
  const rec = m as Record<string, unknown>;
  if (Array.isArray(rec["groupIds"])) return (rec["groupIds"] as Array<unknown>).map(toString).filter(Boolean) as string[];
  if (Array.isArray(rec["groups"])) {
    return (rec["groups"] as Array<unknown>)
      .map((g) => {
        if (typeof g === "string") return g;
        if (isRecord(g) && typeof g._id === "string") return g._id as string;
        return undefined;
      })
      .filter(Boolean) as string[];
  }
  if (isRecord(rec["group"])) {
    const g = rec["group"] as Record<string, unknown>;
    if (typeof g._id === "string") return [g._id];
  }
  if (typeof rec["group"] === "string") return [rec["group"] as string];
  if (rec["groupId"]) return [String(rec["groupId"])];
  return [];
}

function normalizeGroupNamesFromMember(m: unknown): string[] {
  if (!isRecord(m)) return [];
  const rec = m as Record<string, unknown>;
  if (Array.isArray(rec["groupNames"])) return (rec["groupNames"] as Array<unknown>).map(toString).filter(Boolean) as string[];
  if (Array.isArray(rec["groups"]) && (rec["groups"] as Array<unknown>).length && isRecord((rec["groups"] as Array<unknown>)[0])) {
    return (rec["groups"] as Array<unknown>)
      .map((g) => (isRecord(g) && typeof g.name === "string" ? g.name : undefined))
      .filter(Boolean) as string[];
  }
  if (isRecord(rec["group"])) {
    const g = rec["group"] as Record<string, unknown>;
    if (typeof g.name === "string") return [g.name];
  }
  return [];
}

type GroupSlot = { memberId: string; slotId: string };

function getGroupSlots(groupMembers: unknown): GroupSlot[] {
  return normalizeGroupMemberSlots(groupMembers);
}

export default function SubscribersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const members = useSelector((s: RootState) => s.members.members) as Member[]; // server members
  const memberStatus = useSelector((s: RootState) => s.members.status);

  const groups = useSelector((s: RootState) => s.chitGroups.groups) as Array<{ _id?: string; name?: string; [k: string]: unknown }>;
  const groupsStatus = useSelector((s: RootState) => s.chitGroups.status);

  // UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingSubscriber, setViewingSubscriber] = useState<SubscriberLocal | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<SubscriberLocal | null>(null);

  // form
  const emptyForm: Partial<SubscriberLocal> = {
    name: "",
    mobile: "",
    userId: "",
    address: "",
    joiningDate: "",
    status: "Active",
    totalPaid: 0,
    pendingAmount: 0,
    aadhaarImage: "",
    govIdImage: "",
    avatarImage: "",
    password: "",
    groups: [],
    groupId: undefined,
  };
  const [formData, setFormData] = useState<Partial<SubscriberLocal>>(emptyForm);

  // submit + toast states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "error" } | null>(null);
  const [emiSchedule, setEmiSchedule] = useState<Array<{
    loanId: string;
    loanAmount: number;
    monthNumber: number;
    monthName: string;
    dueDate: string;
    emiAmount: number;
    penalty: number;
    totalDue: number;
    paidAmount: number;
    status: "paid" | "pending";
  }>>([]);
  const [emiLoading, setEmiLoading] = useState(false);
  const [emiError, setEmiError] = useState<string | null>(null);

  const [memberPayments, setMemberPayments] = useState<UnknownRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [loanTxns, setLoanTxns] = useState<UnknownRecord[]>([]);
  const [loanLoading, setLoanLoading] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  const [groupProgress, setGroupProgress] = useState<Record<string, { totalMonths: number; rows: Array<{
    slotId: string;
    memberId: string;
    memberName: string;
    paidTillMonth: number;
    nextMonth: number;
    monthAmounts: Array<{ monthIndex: number; amount: number }>;
    monthPenalties: Array<{ monthIndex: number; penaltyAmount: number }>;
  }> }>>({});

  const [paymentForm, setPaymentForm] = useState({
    groupId: "",
    slotId: "",
    monthIndex: "",
    amount: "",
    utr: "",
    note: "",
  });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [selectedGroupToAdd, setSelectedGroupToAdd] = useState<string>("");
  const [editPayment, setEditPayment] = useState<{
    paymentId: string;
    groupId: string;
    slotId: string;
    monthIndex: string;
    amount: string;
    utr: string;
    note: string;
  } | null>(null);

  // fetch members & groups on mount
  useEffect(() => {
    if (memberStatus === "idle") dispatch(fetchMembers());
    if (groupsStatus === "idle") dispatch(fetchGroups());
  }, [memberStatus, groupsStatus, dispatch]);

  // derive UI list from server members
  const uiList: SubscriberLocal[] = members.length
  ? members.map((m, idx) => {
      const mRec = m as unknown as Record<string, unknown>;
      const groupsArr = normalizeGroupsFromMember(mRec);
      const groupNamesArr = normalizeGroupNamesFromMember(mRec);

      return {
        _id: (mRec._id as string) || undefined,
        id: idx + 1,
        name: (mRec.name as string) || "",
        mobile: (mRec.mobile as string) || "",
        userId: (mRec.userId as string) || "",
        address: (mRec.address as string) || "",
        joiningDate: mRec.joiningDate ? String(mRec.joiningDate).split("T")[0] : "",
        status: ((mRec.status as "Active" | "Inactive") || "Active") as "Active" | "Inactive",
        totalPaid: (mRec.totalPaid as number) ?? 0,
        pendingAmount: (mRec.pendingAmount as number) ?? 0,
        aadhaarUrl: (mRec.aadhaarUrl as string) || undefined,
        govIdUrl: (mRec.govIdUrl as string) || undefined,
        avatarUrl: (mRec.avatarUrl as string) || undefined,
        attachments: (mRec.attachments as Array<{ id: string; label: string; url: string }>) || [],
        groups: groupsArr,
        groupId: groupsArr.length ? groupsArr[0] : (mRec.groupId as string | undefined) ?? (typeof mRec.group === "string" ? (mRec.group as string) : undefined),
        groupName: groupNamesArr.length ? groupNamesArr[0] : (mRec.groupName as string | undefined) ?? undefined,
      } as SubscriberLocal;
    })
    : [initialLocalSample];

  const filteredSubscribers = uiList.filter((s) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (s.name || "").toLowerCase().includes(search) ||
      (s.mobile || "").includes(searchTerm) ||
      (s.userId || "").toLowerCase().includes(search);
    const matchesFilter = filterStatus === "all" || s.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleChange = (key: keyof SubscriberLocal, value: string | number | string[] | undefined) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (key: "aadhaarImage" | "govIdImage" | "avatarImage", file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => handleChange(key, reader.result as string);
    reader.readAsDataURL(file);
  };

  // build payload helper: DO NOT include groupId/groups here (assignment only from chit-groups page)
  function buildPayloadFromForm(): Partial<Member> {
    const payload: Partial<Member> = {};
    if (formData.name) (payload as unknown as Record<string, unknown>).name = String(formData.name);
    if (formData.mobile) (payload as unknown as Record<string, unknown>).mobile = String(formData.mobile);
    if (formData.userId) (payload as unknown as Record<string, unknown>).userId = String(formData.userId);
    if (formData.address) (payload as unknown as Record<string, unknown>).address = String(formData.address);
    if (formData.joiningDate) (payload as unknown as Record<string, unknown>).joiningDate = String(formData.joiningDate);
    if (formData.status) (payload as unknown as Record<string, unknown>).status = formData.status;
    if (typeof formData.totalPaid === "number") (payload as unknown as Record<string, unknown>).totalPaid = formData.totalPaid;
    if (typeof formData.pendingAmount === "number") (payload as unknown as Record<string, unknown>).pendingAmount = formData.pendingAmount;
    if (formData.aadhaarImage) (payload as unknown as Record<string, unknown>).aadhaarImage = String(formData.aadhaarImage);
    if (formData.govIdImage) (payload as unknown as Record<string, unknown>).govIdImage = String(formData.govIdImage);
    if (formData.avatarImage) (payload as unknown as Record<string, unknown>).avatarImage = String(formData.avatarImage);
    // password may not exist on server type; add only if present in formData
    if (formData.password) (payload as unknown as Record<string, unknown>).password = String(formData.password);
    return payload;
  }

  // ----- SMALL TOAST COMPONENT -----
  const Toast: React.FC<{ msg: { text: string; type?: "success" | "error" } | null; onClose: () => void }> = ({ msg, onClose }) => {
    if (!msg) return null;
    return (
      <div className={`fixed right-6 bottom-6 z-50 max-w-xs rounded-lg p-3 shadow-lg transform transition-all ${msg.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"}`} role="status">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">{msg.text}</div>
          <button onClick={onClose} className="text-xl leading-none">✕</button>
        </div>
      </div>
    );
  };

  // helper: remove Cloudinary image (server-side endpoint required)
  async function removeCloudinaryImageIfNeeded(oldUrl?: string | null) {
    if (!oldUrl) return;
    try {
      const parts = oldUrl.split("/upload/");
      if (parts.length < 2) return;
      let publicPath = parts[1].replace(/v\d+\//, "");
      publicPath = publicPath.replace(/\.[a-zA-Z0-9]+(\?.*)?$/, "");
      await fetch("/api/cloudinary/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: publicPath }),
      });
    } catch (err) {
      console.warn("Cloudinary delete request failed", err);
    }
  }

  // CREATE
  const handleAddSubscriber = async () => {
    try {
      setIsSubmitting(true);
      const payload = buildPayloadFromForm();
      await dispatch(createMember(payload)).unwrap();
      setIsAddDialogOpen(false);
      setFormData(emptyForm);
      setToastMsg({ text: "Member added successfully", type: "success" });
      dispatch(fetchMembers());
      dispatch(fetchGroups());
    } catch (err) {
      console.error("Create member failed:", err);
      setToastMsg({ text: String(err) || "Create failed", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // open edit modal
  const openEditDialog = (s: SubscriberLocal) => {
    setEditingSubscriber(s);
    setFormData({
      _id: s._id,
      name: s.name,
      mobile: s.mobile,
      userId: s.userId,
      address: s.address,
      joiningDate: s.joiningDate,
      status: s.status,
      totalPaid: s.totalPaid,
      pendingAmount: s.pendingAmount,
      aadhaarImage: undefined,
      govIdImage: undefined,
      avatarImage: undefined,
      password: "",
      groups: s.groups ?? (s.groupId ? [s.groupId] : []),
      groupId: s.groupId ?? (s.groups && s.groups.length ? s.groups[0] : undefined),
    });
    setIsAddDialogOpen(true);
  };

  // UPDATE
  const handleEditSubscriber = async () => {
    if (!editingSubscriber || !editingSubscriber._id) return;
    try {
      setIsSubmitting(true);

      if (formData.avatarImage && editingSubscriber.avatarUrl) {
        await removeCloudinaryImageIfNeeded(editingSubscriber.avatarUrl);
      }
      if (formData.aadhaarImage && editingSubscriber.aadhaarUrl) {
        await removeCloudinaryImageIfNeeded(editingSubscriber.aadhaarUrl);
      }
      if (formData.govIdImage && editingSubscriber.govIdUrl) {
        await removeCloudinaryImageIfNeeded(editingSubscriber.govIdUrl);
      }

      const id = editingSubscriber._id;
      const updates: Partial<Member> = buildPayloadFromForm();
      await dispatch(updateMember({ id, updates })).unwrap();
      setEditingSubscriber(null);
      setFormData(emptyForm);
      setIsAddDialogOpen(false);
      setToastMsg({ text: "Member updated successfully", type: "success" });
      dispatch(fetchMembers());
      dispatch(fetchGroups());
    } catch (err) {
      console.error("Update member failed:", err);
      setToastMsg({ text: String(err) || "Update failed", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // DELETE
  const handleDeleteSubscriber = async (idOrNum?: string | number) => {
    const id = typeof idOrNum === "string" ? idOrNum : undefined;
    if (!id) {
      setToastMsg({ text: "Sample/local item - not deleted.", type: "error" });
      return;
    }
    try {
      await dispatch(deleteMember(id)).unwrap();
      setToastMsg({ text: "Member deleted", type: "success" });
      dispatch(fetchMembers());
      dispatch(fetchGroups());
    } catch (err) {
      console.error("Delete member failed:", err);
      setToastMsg({ text: String(err) || "Delete failed", type: "error" });
    }
  };

  const refreshMemberPayments = async (memberId: string) => {
    if (!memberId) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const res = await fetch(`/api/admin/transactions?memberId=${encodeURIComponent(memberId)}&status=all`, {
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.error ?? data.message ?? "Failed to load payments"));
      }
      const rows = Array.isArray(data.payments) ? data.payments : [];
      setMemberPayments(rows);
    } catch (err) {
      setPaymentsError(String(err));
      setMemberPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const refreshLoanTransactions = async (memberId: string) => {
    if (!memberId) return;
    setLoanLoading(true);
    setLoanError(null);
    try {
      const res = await fetch(`/api/admin/loan-transactions?memberId=${encodeURIComponent(memberId)}`, {
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.message ?? "Failed to load loan transactions"));
      }
      const rows = Array.isArray(data.transactions) ? data.transactions : [];
      setLoanTxns(rows);
    } catch (err) {
      setLoanError(String(err));
      setLoanTxns([]);
    } finally {
      setLoanLoading(false);
    }
  };

  const refreshGroupProgress = async (memberId: string) => {
    if (!memberId) return;
    const map: Record<string, { totalMonths: number; rows: Array<{
      slotId: string;
      memberId: string;
      memberName: string;
      paidTillMonth: number;
      nextMonth: number;
      monthAmounts: Array<{ monthIndex: number; amount: number }>;
      monthPenalties: Array<{ monthIndex: number; penaltyAmount: number }>;
    }> }> = {};

    const groupsWithSlots = (groups || [])
      .map((g) => {
        const slots = getGroupSlots((g as UnknownRecord).members).filter((s) => s.memberId === memberId);
        return slots.length ? { group: g, slots } : null;
      })
      .filter(Boolean) as Array<{ group: { _id?: string }; slots: GroupSlot[] }>;

    if (!groupsWithSlots.length) {
      setGroupProgress({});
      return;
    }

    await Promise.all(
      groupsWithSlots.map(async ({ group, slots }) => {
        const groupId = String(group._id ?? "");
        if (!groupId) return;
        const slotIds = slots.map((s) => s.slotId).filter(Boolean);
        if (!slotIds.length) return;
        try {
          const res = await fetch(
            `/api/collections/member-month-progress?groupId=${encodeURIComponent(groupId)}&slotIds=${encodeURIComponent(slotIds.join(","))}`,
            { credentials: "include" },
          );
          const data = (await res.json()) as UnknownRecord;
          if (res.ok && data.success) {
            map[groupId] = {
              totalMonths: toNum(data.totalMonths, 0),
              rows: Array.isArray(data.rows) ? (data.rows as Array<{
                slotId: string;
                memberId: string;
                memberName: string;
                paidTillMonth: number;
                nextMonth: number;
                monthAmounts: Array<{ monthIndex: number; amount: number }>;
                monthPenalties: Array<{ monthIndex: number; penaltyAmount: number }>;
              }>) : [],
            };
          }
        } catch (err) {
          console.warn("Failed to load member month progress", err);
        }
      }),
    );

    setGroupProgress(map);
  };

  const addSlotToGroup = async (groupId: string, memberId: string) => {
    if (!groupId || !memberId) return;
    const group = groups.find((g) => String((g as UnknownRecord)._id ?? "") === groupId);
    if (!group) return;
    try {
      const currentSlots = getGroupSlots((group as UnknownRecord).members);
      const updated = [
        ...currentSlots.map((s) => ({ memberId: s.memberId, slotId: s.slotId })),
        { memberId },
      ];
      await dispatch(updateGroup({ id: groupId, updates: { members: updated } })).unwrap();
      await dispatch(fetchGroups());
      await dispatch(fetchMembers());
      await refreshGroupProgress(memberId);
    } catch (err) {
      console.error("Failed to add slot:", err);
    }
  };

  const removeSlotFromGroup = async (groupId: string, slotId: string, memberId: string) => {
    if (!groupId || !slotId) return;
    const group = groups.find((g) => String((g as UnknownRecord)._id ?? "") === groupId);
    if (!group) return;
    try {
      const currentSlots = getGroupSlots((group as UnknownRecord).members);
      const updated = currentSlots
        .filter((s) => s.slotId !== slotId)
        .map((s) => ({ memberId: s.memberId, slotId: s.slotId }));
      await dispatch(updateGroup({ id: groupId, updates: { members: updated } })).unwrap();
      await dispatch(fetchGroups());
      await dispatch(fetchMembers());
      await refreshGroupProgress(memberId);
    } catch (err) {
      console.error("Failed to remove slot:", err);
    }
  };

  const addMemberToSelectedGroup = async (memberId: string) => {
    if (!selectedGroupToAdd || !memberId) return;
    await addSlotToGroup(selectedGroupToAdd, memberId);
    setSelectedGroupToAdd("");
  };

  const submitPayment = async (memberId: string) => {
    if (!memberId || !paymentForm.groupId || !paymentForm.amount || !paymentForm.monthIndex) return;
    if (!paymentForm.slotId) {
      setToastMsg({ text: "Please select a slot for this payment.", type: "error" });
      return;
    }
    setPaymentSubmitting(true);
    try {
      const monthIndexNum = Number(paymentForm.monthIndex);
      const amountNum = Number(paymentForm.amount);
      const payload = {
        memberId,
        memberSlotId: paymentForm.slotId || undefined,
        amount: paymentForm.amount,
        utr: paymentForm.utr || undefined,
        adminNote: paymentForm.note || undefined,
        allocationSummary: JSON.stringify([
          {
            monthIndex: Math.max(0, Math.round(monthIndexNum) - 1),
            amount: Number.isFinite(amountNum) ? amountNum : 0,
          },
        ]),
      };
      const res = await fetch(`/api/chitgroups/${encodeURIComponent(paymentForm.groupId)}/payments/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.error ?? "Failed to create payment"));
      }
      setPaymentForm({ groupId: "", slotId: "", monthIndex: "", amount: "", utr: "", note: "" });
      await refreshMemberPayments(memberId);
      await refreshGroupProgress(memberId);
      setToastMsg({ text: "Payment request created", type: "success" });
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const approvePayment = async (paymentId: string) => {
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, approve: true }),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.error ?? "Failed to approve payment"));
      }
      if (viewingSubscriber?._id) {
        await refreshMemberPayments(viewingSubscriber._id);
        await refreshGroupProgress(viewingSubscriber._id);
      }
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  const rejectPayment = async (paymentId: string) => {
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, approve: false, adminNote: "Rejected by admin" }),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.error ?? "Failed to reject payment"));
      }
      if (viewingSubscriber?._id) {
        await refreshMemberPayments(viewingSubscriber._id);
        await refreshGroupProgress(viewingSubscriber._id);
      }
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this payment? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.error ?? "Failed to delete payment"));
      }
      if (viewingSubscriber?._id) {
        await refreshMemberPayments(viewingSubscriber._id);
        await refreshGroupProgress(viewingSubscriber._id);
      }
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  const updateLoanTransaction = async (transactionId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch("/api/admin/loan-transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, action }),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.message ?? "Failed to update loan transaction"));
      }
      if (viewingSubscriber?._id) {
        await refreshLoanTransactions(viewingSubscriber._id);
      }
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  // VIEW (open view modal with full images and details)
  const handleView = async (s: SubscriberLocal) => {
    setViewingSubscriber(s);
    setViewOpen(true);
    setEmiSchedule([]);
    setEmiError(null);
    setSelectedGroupToAdd("");
    setPaymentForm({ groupId: "", slotId: "", monthIndex: "", amount: "", utr: "", note: "" });

    // Fetch EMI schedule for this member
    if (s._id) {
      setEmiLoading(true);
      try {
        const res = await fetch(`/api/admin/loan/member-emi?memberId=${s._id}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setEmiSchedule(data.emiSchedule || []);
        } else {
          setEmiError(data.message || "Failed to load loan EMI schedule.");
          setEmiSchedule([]);
        }
      } catch (err) {
        console.error("Error fetching EMI schedule:", err);
        setEmiError("Failed to load loan EMI schedule.");
        setEmiSchedule([]);
      } finally {
        setEmiLoading(false);
      }
    } else {
      setEmiSchedule([]);
      setEmiError(null);
    }

    if (s._id) {
      void refreshMemberPayments(s._id);
      void refreshLoanTransactions(s._id);
      void refreshGroupProgress(s._id);
    } else {
      setMemberPayments([]);
      setLoanTxns([]);
      setGroupProgress({});
    }
  };

  // helper to show either uploaded base64 preview or server URL
  const imageSrc = (
    member: SubscriberLocal | null,
    baseKey: "avatarImage" | "aadhaarImage" | "govIdImage",
    urlKey: "avatarUrl" | "aadhaarUrl" | "govIdUrl"
  ) => {
    if (!member) return undefined;
    const base = (member as unknown as Record<string, unknown>)[baseKey] as string | undefined;
    const url = (member as unknown as Record<string, unknown>)[urlKey] as string | undefined;
    if (base && base.startsWith("data:")) return base;
    if (url) return url;
    return undefined;
  };

  const fieldConfig = [
    { label: "Full Name", key: "name", type: "text", placeholder: "John Doe" },
    { label: "User ID", key: "userId", type: "text", placeholder: "john123" },
    { label: "Password", key: "password", type: "password", placeholder: "********" },
    { label: "Mobile Number", key: "mobile", type: "text", placeholder: "+91 9876543210" },
    { label: "Joining Date", key: "joiningDate", type: "date", placeholder: "" },
  ];

  const memberGroupInfo = useMemo(() => {
    if (!viewingSubscriber?._id) return [];
    const memberId = viewingSubscriber._id;
    return (groups || [])
      .map((g) => {
        const slots = getGroupSlots((g as UnknownRecord).members).filter((s) => s.memberId === memberId);
        if (!slots.length) return null;
        return { group: g as UnknownRecord, slots };
      })
      .filter(Boolean) as Array<{ group: UnknownRecord; slots: GroupSlot[] }>;
  }, [groups, viewingSubscriber?._id]);

  const availableGroupsForMember = useMemo(() => {
    if (!viewingSubscriber?._id) return [];
    const memberId = viewingSubscriber._id;
    return (groups || [])
      .filter((g) => {
        const slots = getGroupSlots((g as UnknownRecord).members).filter((s) => s.memberId === memberId);
        return slots.length === 0;
      })
      .map((g) => g as UnknownRecord);
  }, [groups, viewingSubscriber?._id]);

  const approvedPayments = useMemo(() => {
    const rows = memberPayments.filter((p) => String(p.status ?? "") === "approved");
    return rows;
  }, [memberPayments]);

  const selectedPaymentGroup = useMemo(() => {
    if (!paymentForm.groupId) return null;
    return (memberGroupInfo || []).find((g) => String((g.group as UnknownRecord)?._id ?? "") === paymentForm.groupId) ?? null;
  }, [memberGroupInfo, paymentForm.groupId]);

  const selectedPaymentSlotRow = useMemo(() => {
    if (!paymentForm.groupId || !paymentForm.slotId) return null;
    const progress = groupProgress[paymentForm.groupId];
    return progress?.rows?.find((r) => r.slotId === paymentForm.slotId) ?? null;
  }, [groupProgress, paymentForm.groupId, paymentForm.slotId]);

  const selectedPaymentTotalMonths = useMemo(() => {
    if (!paymentForm.groupId) return 0;
    const progress = groupProgress[paymentForm.groupId];
    const totalFromProgress = progress?.totalMonths ?? 0;
    if (totalFromProgress) return totalFromProgress;
    const fromGroup = selectedPaymentGroup?.group ? toNum((selectedPaymentGroup.group as UnknownRecord).totalMonths, 0) : 0;
    return fromGroup;
  }, [groupProgress, paymentForm.groupId, selectedPaymentGroup]);

  const paymentMonthOptions = useMemo(() => {
    if (!selectedPaymentTotalMonths || selectedPaymentTotalMonths <= 0) return [];
    return Array.from({ length: selectedPaymentTotalMonths }, (_, i) => i + 1);
  }, [selectedPaymentTotalMonths]);

  useEffect(() => {
    if (!paymentForm.groupId || !paymentForm.slotId) return;
    if (paymentForm.monthIndex) return;
    const suggested = selectedPaymentSlotRow?.nextMonth ?? 1;
    setPaymentForm((prev) => ({ ...prev, monthIndex: String(suggested) }));
  }, [paymentForm.groupId, paymentForm.slotId, paymentForm.monthIndex, selectedPaymentSlotRow?.nextMonth]);

  const editPaymentTotalMonths = useMemo(() => {
    if (!editPayment?.groupId) return 0;
    const progress = groupProgress[editPayment.groupId];
    const totalFromProgress = progress?.totalMonths ?? 0;
    if (totalFromProgress) return totalFromProgress;
    const group = groups.find((g) => String((g as UnknownRecord)._id ?? "") === editPayment.groupId) as UnknownRecord | undefined;
    return group ? toNum(group.totalMonths, 0) : 0;
  }, [editPayment?.groupId, groupProgress, groups]);

  const editPaymentSlotRow = useMemo(() => {
    if (!editPayment?.groupId || !editPayment?.slotId) return null;
    const progress = groupProgress[editPayment.groupId];
    return progress?.rows?.find((r) => r.slotId === editPayment.slotId) ?? null;
  }, [editPayment?.groupId, editPayment?.slotId, groupProgress]);

  const getPaymentMonthIndex = (payment: UnknownRecord): number => {
    const rawMeta = isRecord(payment.rawMeta) ? payment.rawMeta : {};
    const rawMonth = toNum(rawMeta.monthIndex, 0);
    if (rawMonth > 0) return Math.round(rawMonth);
    const allocated = Array.isArray(payment.allocated) ? payment.allocated : [];
    let maxMonth = 0;
    for (const row of allocated) {
      if (!isRecord(row)) continue;
      const m = toNum(row.monthIndex, -1);
      if (m >= 0) maxMonth = Math.max(maxMonth, Math.round(m + 1));
    }
    return maxMonth;
  };

  const openEditPayment = (p: UnknownRecord) => {
    const paymentId = String(p._id ?? "");
    const groupId = getIdFromUnknown(p.groupId);
    const slotId = String(p.memberSlotId ?? "");
    const monthIndex = getPaymentMonthIndex(p);
    setEditPayment({
      paymentId,
      groupId,
      slotId,
      monthIndex: monthIndex > 0 ? String(monthIndex) : "",
      amount: String(p.amount ?? ""),
      utr: String(p.utr ?? p.reference ?? ""),
      note: String(p.adminNote ?? ""),
    });
  };

  const updatePayment = async () => {
    if (!editPayment) return;
    if (!editPayment.paymentId || !editPayment.groupId || !editPayment.amount || !editPayment.monthIndex || !editPayment.slotId) {
      setToastMsg({ text: "Please select slot, month, and amount.", type: "error" });
      return;
    }
    try {
      const monthIndexNum = Number(editPayment.monthIndex);
      const amountNum = Number(editPayment.amount);
      const payload = {
        paymentId: editPayment.paymentId,
        amount: editPayment.amount,
        memberSlotId: editPayment.slotId,
        reference: editPayment.utr || undefined,
        adminNote: editPayment.note || undefined,
        allocationSummary: JSON.stringify([
          {
            monthIndex: Math.max(0, Math.round(monthIndexNum) - 1),
            amount: Number.isFinite(amountNum) ? amountNum : 0,
          },
        ]),
      };
      const res = await fetch("/api/admin/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.error ?? data.message ?? "Failed to update payment"));
      }
      setEditPayment(null);
      if (viewingSubscriber?._id) {
        await refreshMemberPayments(viewingSubscriber._id);
        await refreshGroupProgress(viewingSubscriber._id);
      }
      setToastMsg({ text: "Payment updated", type: "success" });
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* toast */}
      <Toast msg={toastMsg} onClose={() => setToastMsg(null)} />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
            <Input
              placeholder="Search by name, mobile, or userID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40 h-12 rounded-xl bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
              <Filter className="w-4 h-4 mr-2 text-[var(--text-secondary)]" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingSubscriber(null);
              setFormData(emptyForm);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)] rounded-xl shadow-lg h-12 px-6">
              <Plus className="w-5 h-5 mr-2" />
              {editingSubscriber ? "Edit Member" : "Add Members"}
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)]">
            <DialogHeader>
              <DialogTitle>{editingSubscriber ? "Edit Member" : "Add New Member"}</DialogTitle>
              <DialogDescription>{editingSubscriber ? "Update member details." : "Add a new member to the chit fund system."}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {fieldConfig.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key} className="text-[var(--text-primary)]">{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(formData as Record<string, unknown>)[f.key] as string ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(f.key as keyof SubscriberLocal, e.target.value)}
                    className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] placeholder:text-[var(--text-secondary)]"
                  />
                </div>
              ))}

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[var(--text-primary)]">Address</Label>
                <Input
                  value={formData.address ?? ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="123 Main Street, City"
                  className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] placeholder:text-[var(--text-secondary)]"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[var(--text-primary)]">Assigned Group (read-only)</Label>
                <div className="w-full rounded-md px-3 py-2 bg-[var(--bg-muted)] text-[var(--text-primary)] border-[var(--border-color)]">
                  {formData.groupName
                    ? formData.groupName
                    : (formData.groups && formData.groups.length
                      ? formData.groups.map(gid => (groups?.find(gr => gr._id === gid)?.name ?? gid)).join(", ")
                      : "— No group assigned —")}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">To add or remove this member from a group, go to the Chit Groups page and manage members for the target group.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">User Image (Avatar) - optional</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("avatarImage", e.target.files?.[0] || null)} className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]" />
                {formData.avatarImage && typeof formData.avatarImage === "string" && formData.avatarImage.startsWith("data:") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.avatarImage} alt="avatar preview" className="w-24 h-24 object-cover rounded-md mt-2" />
                )}
                {!formData.avatarImage && editingSubscriber && editingSubscriber.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingSubscriber.avatarUrl} alt="avatar" className="w-24 h-24 object-cover rounded-md mt-2" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Aadhaar Image (Required)</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("aadhaarImage", e.target.files?.[0] || null)} className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]" />
                {formData.aadhaarImage && typeof formData.aadhaarImage === "string" && formData.aadhaarImage.startsWith("data:") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.aadhaarImage} alt="aadhaar preview" className="w-36 h-auto rounded-md mt-2" />
                )}
                {!formData.aadhaarImage && editingSubscriber && editingSubscriber.aadhaarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingSubscriber.aadhaarUrl} alt="aadhaar" className="w-36 h-auto rounded-md mt-2" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">PAN / Other Govt ID (Optional)</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("govIdImage", e.target.files?.[0] || null)} className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]" />
                {formData.govIdImage && typeof formData.govIdImage === "string" && formData.govIdImage.startsWith("data:") && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.govIdImage} alt="gov id preview" className="w-36 h-auto rounded-md mt-2" />
                )}
                {!formData.govIdImage && editingSubscriber && editingSubscriber.govIdUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingSubscriber.govIdUrl} alt="gov id" className="w-36 h-auto rounded-md mt-2" />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Status</Label>
                <Select
                  value={(formData.status as "Active" | "Inactive") ?? "Active"}
                  onValueChange={(v: "Active" | "Inactive") => handleChange("status", v)}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setEditingSubscriber(null); setFormData(emptyForm); }} disabled={isSubmitting}>
                Cancel
              </Button>
              {editingSubscriber ? (
                <Button onClick={handleEditSubscriber} className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)]" disabled={isSubmitting}>
                  {isSubmitting ? "Updating…" : "Update Member"}
                </Button>
              ) : (
                <Button onClick={handleAddSubscriber} className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)]" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add Member"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-lg bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-[var(--bg-highlight)] to-[var(--bg-highlight)] text-[var(--text-primary)]">
                <tr>
                  {[
                    "Name",
                    "Contact",
                    "Group",
                    "Joining Date",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="text-left py-4 px-6 w-120 text-sm font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((s) => (
                  <tr key={s._id ?? s.id} className="border-b hover:bg-[var(--bg-highlight)] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-full flex items-center justify-center text-[var(--text-light)] font-semibold">
                          {s.name?.charAt(0) ?? "U"}
                        </div>
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{s.userId}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-sm flex items-center gap-2 text-[var(--text-secondary)]">
                      <Phone className="w-4 h-4 text-[var(--color-primary)]" />
                      {s.mobile}
                    </td>

                    <td className="py-4 px-6 text-sm text-[var(--text-secondary)]">
                      {s.groupName
                        ? s.groupName
                        : (s.groups && s.groups.length
                          ? s.groups.map(gid => (groups?.find(gr => gr._id === gid)?.name ?? gid)).join(", ")
                          : (s.groupId ? (groups?.find(g => g._id === s.groupId)?.name ?? "—") : "—"))}
                    </td>

                    <td className="py-4 px-6 text-sm text-[var(--text-secondary)]">{s.joiningDate}</td>

                    <td className="py-4 px-6">
                      <Badge
                        className={
                          s.status === "Active"
                            ? "bg-[var(--color-secondary)] text-[var(--text-light)]"
                            : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"
                        }
                      >
                        {s.status === "Active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        {s.status}
                      </Badge>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        {s._id ? (
                          <Link href={`/admin/members/${encodeURIComponent(s._id)}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-highlight)]">
                              <Eye className="w-4 h-4 text-[var(--color-primary)]" />
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-highlight)]" disabled>
                            <Eye className="w-4 h-4 text-[var(--color-primary)]" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-highlight)]" onClick={() => openEditDialog(s)}>
                          <Edit className="w-4 h-4 text-[var(--color-primary)]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-[var(--color-accent)]"
                          onClick={() => handleDeleteSubscriber(s._id ?? s.id)}
                        >
                          <Trash2 className="w-4 h-4 text-[var(--color-accent)]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSubscribers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-secondary)]">No members found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog - improved design */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-semibold">Member Details</DialogTitle>
            <DialogDescription className="text-sm text-[var(--text-secondary)]">Full member profile and uploaded images.</DialogDescription>
          </DialogHeader>

          {viewingSubscriber ? (
            <div className="p-6 gap-6 items-start md:grid-cols-12">
              {/* LEFT: Avatar + basic info - improved alignment */}
              <div className="md:col-span-4 flex flex-col items-center md:items-start gap-4">
                <div className="w-44 h-44 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-gradient-to-br from-white/5 to-black/5 flex items-center justify-center shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc(viewingSubscriber, "avatarImage", "avatarUrl") || "/placeholder-avatar.png"}
                    alt={`${viewingSubscriber.name ?? "User"} avatar`}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="text-center md:text-left">
                  <h3 className="text-lg font-semibold">{viewingSubscriber.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{viewingSubscriber.userId}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{viewingSubscriber.mobile}</p>
                </div>

                <div className="w-full mt-2 text-sm text-[var(--text-secondary)] space-y-1">
                  <div className="flex justify-between"><strong className="text-[var(--text-primary)]">Address:</strong> <span className="truncate max-w-[60%] text-right">{viewingSubscriber.address || "—"}</span></div>
                  <div className="flex justify-between "><strong className="text-[var(--text-primary)]">Group:</strong> <span>{viewingSubscriber.groupName ?? (viewingSubscriber.groups && viewingSubscriber.groups.length ? viewingSubscriber.groups.map(gid => (groups?.find(gr => gr._id === gid)?.name ?? gid)).join(", ") : (viewingSubscriber.groupId ? (groups?.find(g => g._id === viewingSubscriber.groupId)?.name ?? "—") : "—"))}</span></div>
                  <div className="flex justify-between"><strong className="text-[var(--text-primary)]">Joined:</strong> <span>{viewingSubscriber.joiningDate || "—"}</span></div>
                  <div className="flex items-center gap-2">
                    <strong className="text-[var(--text-primary)]">Status:</strong>
                    <Badge className={viewingSubscriber.status === "Active" ? "bg-[var(--color-secondary)] text-[var(--text-light)]" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}>
                      {viewingSubscriber.status === "Active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {viewingSubscriber.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* RIGHT: Details */}
              <div className="md:col-span-8 grid grid-cols-1 gap-6 mt-10">
                <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-sm font-semibold">Chit Groups & Slots</h4>
                      <p className="text-xs text-[var(--text-secondary)]">All groups joined by this member. Add or remove slots directly.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={selectedGroupToAdd} onValueChange={setSelectedGroupToAdd}>
                        <SelectTrigger className="h-9 w-52 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                          <SelectValue placeholder="Add to group" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                          {availableGroupsForMember.length === 0 && (
                            <SelectItem value="__none" disabled>No groups available</SelectItem>
                          )}
                          {availableGroupsForMember.map((g) => (
                            <SelectItem key={String(g._id ?? g.name ?? "")} value={String(g._id ?? "")}>
                              {String(g.name ?? "Unnamed Group")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={() => viewingSubscriber?._id && addMemberToSelectedGroup(viewingSubscriber._id)} disabled={!selectedGroupToAdd || selectedGroupToAdd === "__none"}>
                        Add
                      </Button>
                    </div>
                  </div>

                  {memberGroupInfo.length === 0 ? (
                    <div className="text-sm text-[var(--text-secondary)]">This member is not assigned to any group yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {memberGroupInfo.map(({ group, slots }) => {
                        const groupId = String(group._id ?? "");
                        const groupName = String(group.name ?? "Unnamed Group");
                        const totalMembers = Math.max(1, toNum(group.totalMembers, 1));
                        const monthlyInstallment = toNum(group.monthlyInstallment, 0);
                        const perMemberInstallment = monthlyInstallment / totalMembers;
                        const progress = groupProgress[groupId];
                        const totalMonths = progress?.totalMonths || toNum(group.totalMonths, 0);
                        const approvedForGroup = approvedPayments.filter((p) => getIdFromUnknown(p.groupId) === groupId);
                        const approvedAmount = approvedForGroup.reduce((sum, p) => sum + toNum(p.amount, 0), 0);
                        const expectedTotal = totalMonths > 0 ? perMemberInstallment * totalMonths * slots.length : 0;
                        const pendingAmount = Math.max(0, expectedTotal - approvedAmount);

                        return (
                          <div key={groupId} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <div className="font-semibold">{groupName}</div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                  {slots.length} slot(s) | Monthly/slot: Rs. {formatINR(perMemberInstallment)} | Total months: {totalMonths || "-"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-[var(--text-secondary)]">Paid: Rs. {formatINR(approvedAmount)}</div>
                                <div className="text-xs text-[var(--text-secondary)]">Pending: Rs. {formatINR(pendingAmount)}</div>
                                <Button size="sm" variant="outline" onClick={() => viewingSubscriber?._id && addSlotToGroup(groupId, viewingSubscriber._id)}
                                  className="whitespace-nowrap">Add Slot</Button>
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {slots.map((slot) => {
                                const row = progress?.rows?.find((r) => r.slotId === slot.slotId);
                                const paidTill = row?.paidTillMonth ?? 0;
                                const slotPaid = row?.monthAmounts?.reduce((sum, a) => sum + toNum(a.amount, 0), 0) ?? 0;
                                const slotPenalty = row?.monthPenalties?.reduce((sum, p) => sum + toNum(p.penaltyAmount, 0), 0) ?? 0;
                                return (
                                  <div key={slot.slotId} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-md bg-[var(--bg-muted)] border border-[var(--border-color)] p-2">
                                    <div>
                                      <div className="text-sm font-medium">Slot: {slot.slotId}</div>
                                      <div className="text-xs text-[var(--text-secondary)]">
                                        Paid till month: {paidTill || 0} / {totalMonths || "-"} | Paid: Rs. {formatINR(slotPaid)} | Penalty: Rs. {formatINR(slotPenalty)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {row?.nextMonth ? (
                                        <span className="text-xs text-[var(--text-secondary)]">Next month: {row.nextMonth}</span>
                                      ) : null}
                                      <Button size="sm" variant="outline" onClick={() => viewingSubscriber?._id && removeSlotFromGroup(groupId, slot.slotId, viewingSubscriber._id)}
                                        className="whitespace-nowrap">Remove Slot</Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold">New Chit Payment</h4>
                    <p className="text-xs text-[var(--text-secondary)]">Create a payment request for this member and group. Approve from the list below.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-[var(--text-secondary)]">Group</Label>
                      <Select value={paymentForm.groupId} onValueChange={(v) => setPaymentForm((prev) => ({ ...prev, groupId: v, slotId: "", monthIndex: "" }))}>
                        <SelectTrigger className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                          {memberGroupInfo.map(({ group }) => (
                            <SelectItem key={String(group._id ?? group.name ?? "")} value={String(group._id ?? "")}>
                              {String(group.name ?? "Unnamed Group")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-[var(--text-secondary)]">Slot</Label>
                      <Select value={paymentForm.slotId} onValueChange={(v) => setPaymentForm((prev) => ({ ...prev, slotId: v, monthIndex: "" }))} disabled={!selectedPaymentGroup}>
                        <SelectTrigger className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                          <SelectValue placeholder="Select slot" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                          {selectedPaymentGroup?.slots?.map((s) => (
                            <SelectItem key={s.slotId} value={s.slotId}>{s.slotId}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-[var(--text-secondary)]">Payment Month</Label>
                      <Select
                        value={paymentForm.monthIndex}
                        onValueChange={(v) => setPaymentForm((prev) => ({ ...prev, monthIndex: v }))}
                        disabled={!paymentForm.slotId || paymentMonthOptions.length === 0}
                      >
                        <SelectTrigger className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                          <SelectValue placeholder={paymentForm.slotId ? "Select month" : "Select slot first"} />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                          {paymentMonthOptions.map((m) => {
                            const paidAmount = selectedPaymentSlotRow?.monthAmounts?.find((x) => x.monthIndex === m)?.amount ?? 0;
                            const penaltyAmount = selectedPaymentSlotRow?.monthPenalties?.find((x) => x.monthIndex === m)?.penaltyAmount ?? 0;
                            const label = paidAmount > 0 || penaltyAmount > 0
                              ? `Month ${m} (paid Rs. ${formatINR(toNum(paidAmount, 0))}${penaltyAmount ? `, penalty Rs. ${formatINR(toNum(penaltyAmount, 0))}` : ""})`
                              : `Month ${m}`;
                            return (
                              <SelectItem key={`pm-${m}`} value={String(m)}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {selectedPaymentSlotRow?.nextMonth ? (
                        <p className="text-xs text-[var(--text-secondary)] mt-1">Suggested next month: {selectedPaymentSlotRow.nextMonth}</p>
                      ) : null}
                    </div>
                    <div>
                      <Label className="text-xs text-[var(--text-secondary)]">Amount</Label>
                      <Input
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="Amount"
                        className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[var(--text-secondary)]">UTR / Reference</Label>
                      <Input
                        value={paymentForm.utr}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, utr: e.target.value }))}
                        placeholder="UTR or note"
                        className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-[var(--text-secondary)]">Admin Note</Label>
                      <Input
                        value={paymentForm.note}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                        placeholder="Optional note"
                        className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button onClick={() => viewingSubscriber?._id && submitPayment(viewingSubscriber._id)} disabled={paymentSubmitting || !paymentForm.groupId || !paymentForm.slotId || !paymentForm.monthIndex || !paymentForm.amount}>
                      {paymentSubmitting ? "Creating..." : "Create Payment"}
                    </Button>
                  </div>
                </div>

                <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold">Chit Transactions</h4>
                      <p className="text-xs text-[var(--text-secondary)]">Approved, pending, and rejected payments for this member.</p>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Approved total: Rs. {formatINR(approvedPayments.reduce((sum, p) => sum + toNum(p.amount, 0), 0))}
                    </div>
                  </div>

                  {paymentsError && <div className="text-sm text-red-600">{paymentsError}</div>}
                  {paymentsLoading ? (
                    <div className="text-sm text-[var(--text-secondary)]">Loading payments...</div>
                  ) : memberPayments.length === 0 ? (
                    <div className="text-sm text-[var(--text-secondary)]">No transactions found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border-color)]">
                            <th className="text-left py-2 px-2 font-semibold">Date</th>
                            <th className="text-left py-2 px-2 font-semibold">Group</th>
                        <th className="text-left py-2 px-2 font-semibold">Slot</th>
                        <th className="text-left py-2 px-2 font-semibold">Month</th>
                            <th className="text-right py-2 px-2 font-semibold">Amount</th>
                            <th className="text-left py-2 px-2 font-semibold">Status</th>
                            <th className="text-left py-2 px-2 font-semibold">UTR</th>
                            <th className="text-right py-2 px-2 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberPayments.map((p) => {
                            const groupName = groups?.find((g) => String((g as UnknownRecord)._id ?? "") === getIdFromUnknown(p.groupId))?.name ?? p.groupName ?? "-";
                            const status = String(p.status ?? "pending");
                            const created = p.createdAt ? new Date(String(p.createdAt)) : null;
                            return (
                              <tr key={String(p._id ?? Math.random())} className="border-b border-[var(--border-color)]">
                                <td className="py-2 px-2 text-[var(--text-secondary)]">{created ? created.toLocaleDateString("en-IN") : "-"}</td>
                                <td className="py-2 px-2">{String(groupName)}</td>
                            <td className="py-2 px-2 text-[var(--text-secondary)]">{String(p.memberSlotId ?? "-")}</td>
                            <td className="py-2 px-2 text-[var(--text-secondary)]">{getPaymentMonthIndex(p) || "-"}</td>
                                <td className="py-2 px-2 text-right">Rs. {formatINR(toNum(p.amount, 0))}</td>
                                <td className="py-2 px-2">
                                  <Badge className={status === "approved" ? "bg-green-600 text-white" : status === "rejected" ? "bg-red-600 text-white" : "bg-yellow-600 text-white"}>
                                    {status}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 text-[var(--text-secondary)]">{String(p.utr ?? p.reference ?? "-")}</td>
                                <td className="py-2 px-2 text-right">
                                  <div className="flex justify-end gap-2">
                                {status !== "approved" && (
                                  <Button size="sm" variant="outline" onClick={() => approvePayment(String(p._id ?? ""))}>Approve</Button>
                                )}
                                {status === "pending" && (
                                  <Button size="sm" variant="outline" onClick={() => openEditPayment(p)}>Edit</Button>
                                )}
                                {status !== "rejected" && (
                                  <Button size="sm" variant="outline" onClick={() => rejectPayment(String(p._id ?? ""))}>Reject</Button>
                                )}
                                    <Button size="sm" variant="outline" onClick={() => deletePayment(String(p._id ?? ""))}>Delete</Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold">Loan Transactions</h4>
                    <p className="text-xs text-[var(--text-secondary)]">Loan EMI payments made by this member.</p>
                  </div>
                  {loanError && <div className="text-sm text-red-600">{loanError}</div>}
                  {loanLoading ? (
                    <div className="text-sm text-[var(--text-secondary)]">Loading loan transactions...</div>
                  ) : loanTxns.length === 0 ? (
                    <div className="text-sm text-[var(--text-secondary)]">No loan transactions found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border-color)]">
                            <th className="text-left py-2 px-2 font-semibold">Date</th>
                            <th className="text-left py-2 px-2 font-semibold">Loan</th>
                            <th className="text-left py-2 px-2 font-semibold">EMI</th>
                            <th className="text-right py-2 px-2 font-semibold">Amount</th>
                            <th className="text-left py-2 px-2 font-semibold">Status</th>
                            <th className="text-left py-2 px-2 font-semibold">UTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loanTxns.map((t) => {
                            const created = t.date ? new Date(String(t.date)) : null;
                            const statusVal = String(t.status ?? "").toLowerCase();
                            return (
                              <tr key={String(t._id ?? Math.random())} className="border-b border-[var(--border-color)]">
                                <td className="py-2 px-2 text-[var(--text-secondary)]">{created ? created.toLocaleDateString("en-IN") : "-"}</td>
                                <td className="py-2 px-2">{String(t.loanName ?? t.loanId ?? "-")}</td>
                                <td className="py-2 px-2">Month {String(t.emiMonth ?? "-")}</td>
                                <td className="py-2 px-2 text-right">Rs. {formatINR(toNum(t.amount, 0))}</td>
                                <td className="py-2 px-2">
                                  <Badge className={statusVal === "paid" ? "bg-green-600 text-white" : statusVal === "failed" ? "bg-red-600 text-white" : "bg-yellow-600 text-white"}>
                                    {String(t.status ?? "Pending")}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 text-[var(--text-secondary)]">{String(t.utr ?? t.referenceId ?? "-")}</td>
                                <td className="py-2 px-2 text-right">
                                  {statusVal === "paid" || statusVal === "failed" ? (
                                    <span className="text-xs text-[var(--text-secondary)]">No action</span>
                                  ) : (
                                    <div className="flex justify-end gap-2">
                                      <Button size="sm" variant="outline" onClick={() => updateLoanTransaction(String(t._id ?? ""), "approve")}>Approve</Button>
                                      <Button size="sm" variant="outline" onClick={() => updateLoanTransaction(String(t._id ?? ""), "reject")}>Reject</Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)] hover:shadow-lg transition-all flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">Aadhaar / ID Card</h4>
                      <span className="text-xs text-[var(--text-secondary)]">Uploaded image</span>
                    </div>

                    {imageSrc(viewingSubscriber, "aadhaarImage", "aadhaarUrl") ? (
                      <div className="w-full h-56 flex items-center justify-center relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageSrc(viewingSubscriber, "aadhaarImage", "aadhaarUrl")}
                          alt="Aadhaar / ID"
                          className="max-h-56 object-contain rounded-md transition-transform hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="h-56 flex items-center justify-center text-[var(--text-secondary)]">No Aadhaar uploaded</div>
                    )}
                  </div>

                  <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)] hover:shadow-lg transition-all flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">Govt ID (PAN / Other)</h4>
                      <span className="text-xs text-[var(--text-secondary)]">Optional</span>
                    </div>

                    {imageSrc(viewingSubscriber, "govIdImage", "govIdUrl") ? (
                      <div className="w-full h-56 flex items-center justify-center relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageSrc(viewingSubscriber, "govIdImage", "govIdUrl")}
                          alt="Government ID"
                          className="max-h-56 object-contain rounded-md transition-transform hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="h-56 flex items-center justify-center text-[var(--text-secondary)]">No Govt ID uploaded</div>
                    )}
                  </div>
                </div>

                <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                  <h4 className="text-sm font-semibold mb-3">Notes & Metadata</h4>
                  <div className="text-sm text-[var(--text-secondary)] space-y-2">
                    <div className="flex justify-between"><strong>Member ID:</strong> <span className="truncate max-w-[60%] text-right">{viewingSubscriber._id ?? "-"}</span></div>
                    <div className="flex justify-between"><strong>Total Paid:</strong> <span>Rs. {Number(viewingSubscriber.totalPaid ?? 0).toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><strong>Pending:</strong> <span>Rs. {Number(viewingSubscriber.pendingAmount ?? 0).toLocaleString("en-IN")}</span></div>
                  </div>
                </div>

                {/* EMI Schedule Section */}
                <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold">Loan EMI Schedule</h4>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Combined loan schedule for this member. Penalty and total due are shown month-wise.
                    </p>
                  </div>
                  {!emiLoading && !emiError && emiSchedule.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                        <p className="text-xs text-[var(--text-secondary)]">Total EMI Rows</p>
                        <p className="text-lg font-semibold text-[var(--text-primary)]">{emiSchedule.length}</p>
                      </div>
                      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                        <p className="text-xs text-[var(--text-secondary)]">Pending Rows</p>
                        <p className="text-lg font-semibold text-amber-600">
                          {emiSchedule.filter((e) => e.status !== "paid").length}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
                        <p className="text-xs text-[var(--text-secondary)]">Outstanding</p>
                        <p className="text-lg font-semibold text-red-600">
                          Rs. {emiSchedule
                            .reduce((sum, e) => sum + Math.max(0, e.totalDue - e.paidAmount), 0)
                            .toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                  {emiError && (
                    <div className="text-sm text-red-600 py-2">{emiError}</div>
                  )}
                  {emiLoading ? (
                    <div className="text-sm text-[var(--text-secondary)] py-4">Loading EMI schedule...</div>
                  ) : emiSchedule.length === 0 && !emiError ? (
                    <div className="text-sm text-[var(--text-secondary)] py-4">No loan EMI records found.</div>
                  ) : emiError ? null : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border-color)]">
                            <th className="text-left py-2 px-2 font-semibold text-[var(--text-primary)]">Month</th>
                            <th className="text-left py-2 px-2 font-semibold text-[var(--text-primary)]">Due Date</th>
                            <th className="text-right py-2 px-2 font-semibold text-[var(--text-primary)]">EMI Amount</th>
                            <th className="text-right py-2 px-2 font-semibold text-[var(--text-primary)]">Penalty</th>
                            <th className="text-right py-2 px-2 font-semibold text-[var(--text-primary)]">Total Due</th>
                            <th className="text-right py-2 px-2 font-semibold text-[var(--text-primary)]">Paid</th>
                            <th className="text-left py-2 px-2 font-semibold text-[var(--text-primary)]">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emiSchedule.map((emi, idx) => (
                            <tr key={idx} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-highlight)]">
                              <td className="py-2 px-2 text-[var(--text-secondary)]">{emi.monthName}</td>
                              <td className="py-2 px-2 text-[var(--text-secondary)]">
                                {new Date(emi.dueDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="py-2 px-2 text-right text-[var(--text-secondary)]">
                                Rs. {emi.emiAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-right text-[var(--text-secondary)]">
                                {emi.penalty > 0 ? (
                                  <span className="text-orange-600">Rs. {emi.penalty.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                                ) : (
                                  <span>Rs. 0.00</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-medium text-[var(--text-primary)]">
                                Rs. {emi.totalDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-right text-[var(--text-secondary)]">
                                Rs. {emi.paidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2">
                                <Badge
                                  className={
                                    emi.status === "paid"
                                      ? "bg-green-600 text-white"
                                      : "bg-yellow-600 text-white"
                                  }
                                >
                                  {emi.status === "paid" ? (
                                    <CheckCircle className="w-3 h-3 mr-1 inline" />
                                  ) : (
                                    <XCircle className="w-3 h-3 mr-1 inline" />
                                  )}
                                  {emi.status === "paid" ? "Paid" : "Pending"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-[var(--text-secondary)]">No member selected.</div>
          )}

          <div className="px-6 pb-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {editPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Payment</h2>
              <Button variant="outline" onClick={() => setEditPayment(null)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="text-xs text-[var(--text-secondary)]">Group</Label>
                <div className="h-9 flex items-center rounded-md border border-[var(--border-color)] px-3 bg-[var(--bg-muted)] text-sm">
                  {String((memberGroupInfo.find((g) => String((g.group as UnknownRecord)?._id ?? "") === editPayment.groupId)?.group as UnknownRecord | undefined)?.name ?? "Group")}
                </div>
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">Slot</Label>
                <Select value={editPayment.slotId} onValueChange={(v) => setEditPayment((prev) => (prev ? { ...prev, slotId: v } : prev))}>
                  <SelectTrigger className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                    <SelectValue placeholder="Select slot" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                    {(memberGroupInfo.find((g) => String((g.group as UnknownRecord)?._id ?? "") === editPayment.groupId)?.slots ?? []).map((s) => (
                      <SelectItem key={`edit-slot-${s.slotId}`} value={s.slotId}>{s.slotId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">Payment Month</Label>
                <Select
                  value={editPayment.monthIndex}
                  onValueChange={(v) => setEditPayment((prev) => (prev ? { ...prev, monthIndex: v } : prev))}
                  disabled={!editPayment.slotId || editPaymentTotalMonths <= 0}
                >
                  <SelectTrigger className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                    <SelectValue placeholder={editPayment.slotId ? "Select month" : "Select slot first"} />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                    {Array.from({ length: editPaymentTotalMonths || 0 }, (_, i) => i + 1).map((m) => {
                      const paidAmount = editPaymentSlotRow?.monthAmounts?.find((x) => x.monthIndex === m)?.amount ?? 0;
                      const penaltyAmount = editPaymentSlotRow?.monthPenalties?.find((x) => x.monthIndex === m)?.penaltyAmount ?? 0;
                      const label = paidAmount > 0 || penaltyAmount > 0
                        ? `Month ${m} (paid Rs. ${formatINR(toNum(paidAmount, 0))}${penaltyAmount ? `, penalty Rs. ${formatINR(toNum(penaltyAmount, 0))}` : ""})`
                        : `Month ${m}`;
                      return (
                        <SelectItem key={`edit-month-${m}`} value={String(m)}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {editPaymentSlotRow?.nextMonth ? (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Suggested next month: {editPaymentSlotRow.nextMonth}</p>
                ) : null}
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">Amount</Label>
                <Input
                  value={editPayment.amount}
                  onChange={(e) => setEditPayment((prev) => (prev ? { ...prev, amount: e.target.value } : prev))}
                  placeholder="Amount"
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">UTR / Reference</Label>
                <Input
                  value={editPayment.utr}
                  onChange={(e) => setEditPayment((prev) => (prev ? { ...prev, utr: e.target.value } : prev))}
                  placeholder="UTR or note"
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-[var(--text-secondary)]">Admin Note</Label>
                <Input
                  value={editPayment.note}
                  onChange={(e) => setEditPayment((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                  placeholder="Optional note"
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button>
              <Button onClick={updatePayment}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
