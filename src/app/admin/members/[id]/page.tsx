"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import Button from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";

import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchMembers, updateMember } from "@/store/memberSlice";
import { fetchGroups, updateGroup } from "@/store/chitGroupSlice";
import type { Member } from "@/app/lib/types";
import { normalizeGroupMemberSlots } from "@/app/lib/groupSlots";

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
  aadhaarImage?: string | null;
  govIdImage?: string | null;
  avatarImage?: string | null;
  password?: string;
  aadhaarUrl?: string;
  govIdUrl?: string;
  avatarUrl?: string;
  attachments?: { id: string; label: string; url: string }[];
  groups?: string[];
  groupId?: string | null;
  groupName?: string | null;
}

type UnknownRecord = Record<string, unknown>;
type GroupSlot = { memberId: string; slotId: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

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

function formatINR(val: number): string {
  return Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getIdFromUnknown(val: unknown): string {
  if (typeof val === "string" || typeof val === "number") return String(val);
  if (isRecord(val)) {
    return toStr(val._id ?? val.id);
  }
  return "";
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

function getGroupSlots(groupMembers: unknown): GroupSlot[] {
  return normalizeGroupMemberSlots(groupMembers);
}

export default function AdminMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const memberId = params?.id ? String(params.id) : "";

  const dispatch = useDispatch<AppDispatch>();
  const members = useSelector((s: RootState) => s.members.members) as Member[];
  const memberStatus = useSelector((s: RootState) => s.members.status);
  const groups = useSelector((s: RootState) => s.chitGroups.groups) as Array<{ _id?: string; name?: string; [k: string]: unknown }>;
  const groupsStatus = useSelector((s: RootState) => s.chitGroups.status);

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
  const [editLoanTx, setEditLoanTx] = useState<{
    transactionId: string;
    loanId: string;
    emiMonth: string;
    amount: string;
    paymentMethod: string;
    utr: string;
    date: string;
  } | null>(null);

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

  const [editOpen, setEditOpen] = useState(false);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (memberStatus === "idle") dispatch(fetchMembers());
    if (groupsStatus === "idle") dispatch(fetchGroups());
  }, [memberStatus, groupsStatus, dispatch]);

  const memberRecord = useMemo<SubscriberLocal | null>(() => {
    const m = members.find((mm) => String((mm as UnknownRecord)._id ?? "") === memberId);
    if (!m) return null;
    const mRec = m as UnknownRecord;
    const groupsArr = normalizeGroupsFromMember(mRec);
    const groupNamesArr = normalizeGroupNamesFromMember(mRec);
    return {
      _id: (mRec._id as string) || undefined,
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
  }, [members, memberId]);

  useEffect(() => {
    if (!memberRecord) return;
    setFormData({
      _id: memberRecord._id,
      name: memberRecord.name,
      mobile: memberRecord.mobile,
      userId: memberRecord.userId,
      address: memberRecord.address,
      joiningDate: memberRecord.joiningDate,
      status: memberRecord.status,
      totalPaid: memberRecord.totalPaid,
      pendingAmount: memberRecord.pendingAmount,
      aadhaarImage: undefined,
      govIdImage: undefined,
      avatarImage: undefined,
      password: "",
      groups: memberRecord.groups ?? (memberRecord.groupId ? [memberRecord.groupId] : []),
      groupId: memberRecord.groupId ?? (memberRecord.groups && memberRecord.groups.length ? memberRecord.groups[0] : undefined),
    });
  }, [memberRecord]);

  const handleChange = (key: keyof SubscriberLocal, value: string | number | string[] | undefined) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (key: "aadhaarImage" | "govIdImage" | "avatarImage", file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => handleChange(key, reader.result as string);
    reader.readAsDataURL(file);
  };

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
    if (formData.password) (payload as unknown as Record<string, unknown>).password = String(formData.password);
    return payload;
  }

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

  const handleEditMember = async () => {
    if (!memberRecord?._id) return;
    try {
      setIsSubmitting(true);

      if (formData.avatarImage && memberRecord.avatarUrl) {
        await removeCloudinaryImageIfNeeded(memberRecord.avatarUrl);
      }
      if (formData.aadhaarImage && memberRecord.aadhaarUrl) {
        await removeCloudinaryImageIfNeeded(memberRecord.aadhaarUrl);
      }
      if (formData.govIdImage && memberRecord.govIdUrl) {
        await removeCloudinaryImageIfNeeded(memberRecord.govIdUrl);
      }

      const updates: Partial<Member> = buildPayloadFromForm();
      await dispatch(updateMember({ id: memberRecord._id, updates })).unwrap();
      setEditOpen(false);
      setToastMsg({ text: "Member updated successfully", type: "success" });
      dispatch(fetchMembers());
      dispatch(fetchGroups());
    } catch (err) {
      setToastMsg({ text: String(err) || "Update failed", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshMemberPayments = async (id: string) => {
    if (!id) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const res = await fetch(`/api/admin/transactions?memberId=${encodeURIComponent(id)}&status=all`, {
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

  const refreshLoanTransactions = async (id: string) => {
    if (!id) return;
    setLoanLoading(true);
    setLoanError(null);
    try {
      const res = await fetch(`/api/admin/loan-transactions?memberId=${encodeURIComponent(id)}`, {
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

  const refreshGroupProgress = async (id: string) => {
    if (!id) return;
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
        const slots = getGroupSlots((g as UnknownRecord).members).filter((s) => s.memberId === id);
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

  const submitPayment = async (id: string) => {
    if (!id || !paymentForm.groupId || !paymentForm.amount || !paymentForm.monthIndex) return;
    if (!paymentForm.slotId) {
      setToastMsg({ text: "Please select a slot for this payment.", type: "error" });
      return;
    }
    setPaymentSubmitting(true);
    try {
      const monthIndexNum = Number(paymentForm.monthIndex);
      const amountNum = Number(paymentForm.amount);
      const payload = {
        memberId: id,
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
      await refreshMemberPayments(id);
      await refreshGroupProgress(id);
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
      if (memberId) {
        await refreshMemberPayments(memberId);
        await refreshGroupProgress(memberId);
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
      if (memberId) {
        await refreshMemberPayments(memberId);
        await refreshGroupProgress(memberId);
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
      if (memberId) {
        await refreshMemberPayments(memberId);
        await refreshGroupProgress(memberId);
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
      if (memberId) {
        await refreshLoanTransactions(memberId);
      }
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  const openEditLoanTx = (t: UnknownRecord) => {
    const txId = String(t._id ?? "");
    if (!txId) return;
    const dateObj = t.date ? new Date(String(t.date)) : null;
    const dateVal = dateObj ? dateObj.toISOString().split("T")[0] : "";
    setEditLoanTx({
      transactionId: txId,
      loanId: String(t.loanId ?? ""),
      emiMonth: String(t.emiMonth ?? ""),
      amount: String(t.amount ?? ""),
      paymentMethod: String(t.paymentMethod ?? "UPI"),
      utr: String(t.utr ?? t.referenceId ?? ""),
      date: dateVal,
    });
  };

  const saveEditLoanTx = async () => {
    if (!editLoanTx?.transactionId) return;
    try {
      const payload = {
        transactionId: editLoanTx.transactionId,
        emiMonth: editLoanTx.emiMonth,
        amount: editLoanTx.amount,
        paymentMethod: editLoanTx.paymentMethod,
        utr: editLoanTx.utr || undefined,
        date: editLoanTx.date || undefined,
      };
      const res = await fetch("/api/admin/loan-transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.message ?? data.error ?? "Failed to update loan transaction"));
      }
      setEditLoanTx(null);
      if (memberId) {
        await refreshLoanTransactions(memberId);
      }
      setToastMsg({ text: "Loan transaction updated", type: "success" });
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  const deleteLoanTx = async (transactionId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this loan transaction? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/loan-transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
        credentials: "include",
      });
      const data = (await res.json()) as UnknownRecord;
      if (!res.ok || data.success === false) {
        throw new Error(String(data.message ?? data.error ?? "Failed to delete loan transaction"));
      }
      if (memberId) {
        await refreshLoanTransactions(memberId);
      }
      setToastMsg({ text: "Loan transaction deleted", type: "success" });
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  const addSlotToGroup = async (groupId: string, id: string) => {
    if (!groupId || !id) return;
    const group = groups.find((g) => String((g as UnknownRecord)._id ?? "") === groupId);
    if (!group) return;
    try {
      const currentSlots = getGroupSlots((group as UnknownRecord).members);
      const updated = [
        ...currentSlots.map((s) => ({ memberId: s.memberId, slotId: s.slotId })),
        { memberId: id },
      ];
      await dispatch(updateGroup({ id: groupId, updates: { members: updated } })).unwrap();
      await dispatch(fetchGroups());
      await dispatch(fetchMembers());
      await refreshGroupProgress(id);
    } catch (err) {
      console.error("Failed to add slot:", err);
    }
  };

  const removeSlotFromGroup = async (groupId: string, slotId: string, id: string) => {
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
      await refreshGroupProgress(id);
    } catch (err) {
      console.error("Failed to remove slot:", err);
    }
  };

  const addMemberToSelectedGroup = async (id: string) => {
    if (!selectedGroupToAdd || !id) return;
    await addSlotToGroup(selectedGroupToAdd, id);
    setSelectedGroupToAdd("");
  };

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

  const memberGroupInfo = useMemo(() => {
    if (!memberRecord?._id) return [];
    const id = memberRecord._id;
    return (groups || [])
      .map((g) => {
        const slots = getGroupSlots((g as UnknownRecord).members).filter((s) => s.memberId === id);
        if (!slots.length) return null;
        return { group: g as UnknownRecord, slots };
      })
      .filter(Boolean) as Array<{ group: UnknownRecord; slots: GroupSlot[] }>;
  }, [groups, memberRecord?._id]);

  const availableGroupsForMember = useMemo(() => {
    if (!memberRecord?._id) return [];
    const id = memberRecord._id;
    return (groups || [])
      .filter((g) => {
        const slots = getGroupSlots((g as UnknownRecord).members).filter((s) => s.memberId === id);
        return slots.length === 0;
      })
      .map((g) => g as UnknownRecord);
  }, [groups, memberRecord?._id]);

  const approvedPayments = useMemo(() => {
    const rows = memberPayments.filter((p) => String(p.status ?? "") === "approved");
    return rows;
  }, [memberPayments]);

  const approvedTotalPaid = useMemo(() => {
    return approvedPayments.reduce((sum, p) => sum + toNum(p.amount, 0), 0);
  }, [approvedPayments]);

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

  useEffect(() => {
    if (!memberId) return;
    setSelectedGroupToAdd("");
    setPaymentForm({ groupId: "", slotId: "", monthIndex: "", amount: "", utr: "", note: "" });

    setEmiSchedule([]);
    setEmiError(null);

    const loadEmi = async () => {
      setEmiLoading(true);
      try {
        const res = await fetch(`/api/admin/loan/member-emi?memberId=${memberId}`, {
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
    };

    void loadEmi();
    void refreshMemberPayments(memberId);
    void refreshLoanTransactions(memberId);
    void refreshGroupProgress(memberId);
  }, [memberId, groups]);

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
      if (memberId) {
        await refreshMemberPayments(memberId);
        await refreshGroupProgress(memberId);
      }
      setToastMsg({ text: "Payment updated", type: "success" });
    } catch (err) {
      setToastMsg({ text: String(err), type: "error" });
    }
  };

  // UI render follows.

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className={`fixed right-6 bottom-6 z-50 max-w-xs rounded-lg p-3 shadow-lg ${toastMsg.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"}`} role="status">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">{toastMsg.text}</div>
            <button onClick={() => setToastMsg(null)} className="text-xl leading-none">x</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/admin/members")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Member Details</h1>
            <p className="text-sm text-[var(--text-secondary)]">Full profile, groups, slots, payments, and loan history.</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>Edit Member</Button>
      </div>

      {!memberRecord ? (
        <div className="p-6 text-[var(--text-secondary)]">Loading member...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-36 h-36 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-gradient-to-br from-white/5 to-black/5 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc(memberRecord, "avatarImage", "avatarUrl") || "/placeholder-avatar.png"}
                    alt={`${memberRecord.name ?? "User"} avatar`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{memberRecord.name}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{memberRecord.userId}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{memberRecord.mobile}</div>
                </div>
              </div>
              <div className="mt-4 text-sm text-[var(--text-secondary)] space-y-2">
                <div className="flex justify-between"><strong className="text-[var(--text-primary)]">Address:</strong> <span className="truncate max-w-[60%] text-right">{memberRecord.address || "-"}</span></div>
                <div className="flex justify-between"><strong className="text-[var(--text-primary)]">Joined:</strong> <span>{memberRecord.joiningDate || "-"}</span></div>
                <div className="flex items-center gap-2">
                  <strong className="text-[var(--text-primary)]">Status:</strong>
                  <Badge className={memberRecord.status === "Active" ? "bg-[var(--color-secondary)] text-[var(--text-light)]" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}>
                    {memberRecord.status === "Active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {memberRecord.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
              <h4 className="text-sm font-semibold mb-3">Notes & Metadata</h4>
              <div className="text-sm text-[var(--text-secondary)] space-y-2">
                <div className="flex justify-between"><strong>Member ID:</strong> <span className="truncate max-w-[60%] text-right">{memberRecord._id ?? "-"}</span></div>
                <div className="flex justify-between"><strong>Total Paid:</strong> <span>Rs. {formatINR(approvedTotalPaid)}</span></div>
                <div className="flex justify-between"><strong>Pending:</strong> <span>Rs. {Number(memberRecord.pendingAmount ?? 0).toLocaleString("en-IN")}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                <h4 className="text-sm font-semibold mb-3">Aadhaar / ID</h4>
                {imageSrc(memberRecord, "aadhaarImage", "aadhaarUrl") ? (
                  <div className="w-full h-52 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(memberRecord, "aadhaarImage", "aadhaarUrl")} alt="Aadhaar" className="max-h-52 object-contain rounded-md" />
                  </div>
                ) : (
                  <div className="h-52 flex items-center justify-center text-[var(--text-secondary)]">No Aadhaar uploaded</div>
                )}
              </div>
              <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
                <h4 className="text-sm font-semibold mb-3">Govt ID</h4>
                {imageSrc(memberRecord, "govIdImage", "govIdUrl") ? (
                  <div className="w-full h-52 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc(memberRecord, "govIdImage", "govIdUrl")} alt="Government ID" className="max-h-52 object-contain rounded-md" />
                  </div>
                ) : (
                  <div className="h-52 flex items-center justify-center text-[var(--text-secondary)]">No Govt ID uploaded</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
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
                  <Button size="sm" onClick={() => memberRecord?._id && addMemberToSelectedGroup(memberRecord._id)} disabled={!selectedGroupToAdd || selectedGroupToAdd === "__none"}>
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
                            <Button size="sm" variant="outline" onClick={() => memberRecord?._id && addSlotToGroup(groupId, memberRecord._id)}
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
                                  <Button size="sm" variant="outline" onClick={() => memberRecord?._id && removeSlotFromGroup(groupId, slot.slotId, memberRecord._id)}
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
                <Button onClick={() => memberRecord?._id && submitPayment(memberRecord._id)} disabled={paymentSubmitting || !paymentForm.groupId || !paymentForm.slotId || !paymentForm.monthIndex || !paymentForm.amount}>
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
                        <th className="text-right py-2 px-2 font-semibold">Actions</th>
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
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditLoanTx(t)}>Edit</Button>
                                  <Button size="sm" variant="outline" onClick={() => deleteLoanTx(String(t._id ?? ""))}>Delete</Button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => updateLoanTransaction(String(t._id ?? ""), "approve")}>Approve</Button>
                                  <Button size="sm" variant="outline" onClick={() => updateLoanTransaction(String(t._id ?? ""), "reject")}>Reject</Button>
                                  <Button size="sm" variant="outline" onClick={() => openEditLoanTx(t)}>Edit</Button>
                                  <Button size="sm" variant="outline" onClick={() => deleteLoanTx(String(t._id ?? ""))}>Delete</Button>
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
            <div className="bg-[var(--bg-muted)] rounded-xl p-4 border border-[var(--border-color)]">
              <div className="mb-3">
                <h4 className="text-sm font-semibold">Loan EMI Schedule</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Combined loan schedule for this member. Penalty and total due are shown month-wise.</p>
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
                            <Badge className={emi.status === "paid" ? "bg-green-600 text-white" : "bg-yellow-600 text-white"}>
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
      )}

      {editOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Member</h2>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["name", "userId", "password", "mobile", "joiningDate"] as Array<keyof SubscriberLocal>).map((key) => (
                <div key={String(key)} className="space-y-2">
                  <Label htmlFor={String(key)} className="text-[var(--text-primary)]">
                    {key === "userId" ? "User ID" : key === "joiningDate" ? "Joining Date" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </Label>
                  <Input
                    id={String(key)}
                    type={key === "password" ? "password" : key === "joiningDate" ? "date" : "text"}
                    value={(formData as Record<string, unknown>)[key] as string ?? ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(key, e.target.value)}
                    className="bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border-[var(--border-color)]"
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="address" className="text-[var(--text-primary)]">Address</Label>
                <Input id="address" value={formData.address ?? ""} onChange={(e) => handleChange("address", e.target.value)} className="bg-[var(--bg-card)] text-[var(--text-primary)]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status" className="text-[var(--text-primary)]">Status</Label>
                <select id="status" value={(formData.status as "Active" | "Inactive") ?? "Active"} onChange={(e) => handleChange("status", e.target.value as "Active" | "Inactive")} className="w-full h-10 rounded-md px-3 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Avatar</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("avatarImage", e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Aadhaar</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("aadhaarImage", e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Govt ID</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("govIdImage", e.target.files?.[0] || null)} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleEditMember} disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Update Member"}</Button>
            </div>
          </div>
        </div>
      )}

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

      {editLoanTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Loan Transaction</h2>
              <Button variant="outline" onClick={() => setEditLoanTx(null)}>Close</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">EMI Month</Label>
                <Input
                  value={editLoanTx.emiMonth}
                  onChange={(e) => setEditLoanTx((prev) => (prev ? { ...prev, emiMonth: e.target.value } : prev))}
                  placeholder="Month number"
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">Amount</Label>
                <Input
                  value={editLoanTx.amount}
                  onChange={(e) => setEditLoanTx((prev) => (prev ? { ...prev, amount: e.target.value } : prev))}
                  placeholder="Amount"
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">Payment Method</Label>
                <select
                  value={editLoanTx.paymentMethod}
                  onChange={(e) => setEditLoanTx((prev) => (prev ? { ...prev, paymentMethod: e.target.value } : prev))}
                  className="w-full h-9 rounded-md px-3 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-[var(--text-secondary)]">Date</Label>
                <Input
                  type="date"
                  value={editLoanTx.date}
                  onChange={(e) => setEditLoanTx((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-[var(--text-secondary)]">UTR / Reference</Label>
                <Input
                  value={editLoanTx.utr}
                  onChange={(e) => setEditLoanTx((prev) => (prev ? { ...prev, utr: e.target.value } : prev))}
                  placeholder="UTR or note"
                  className="h-9 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditLoanTx(null)}>Cancel</Button>
              <Button onClick={saveEditLoanTx}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
