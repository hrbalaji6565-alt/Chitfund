"use client";

import React, { useEffect, useState } from "react";
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
import { fetchGroups } from "@/store/chitGroupSlice";
import type { Member } from "@/app/lib/types"; // server-side Member type

// Local subscriber shape used for UI form / previews
interface SubscriberLocal {
  id?: number;
  _id?: string;
  name: string;
  mobile: string;
  email: string;
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
  email: "rajesh.kumar@email.com",
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

function toString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
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

export default function SubscribersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const members = useSelector((s: RootState) => s.members.members) as Member[]; // server members
  const memberStatus = useSelector((s: RootState) => s.members.status);
  // keep memberError referenced to avoid unused-var lint (you can display it if desired)
  const memberError = useSelector((s: RootState) => s.members.error) as unknown;

  const groups = useSelector((s: RootState) => s.chitGroups.groups) as { _id: string; name: string }[];
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
    email: "",
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
        email: (mRec.email as string) || "",
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
      (s.email || "").toLowerCase().includes(search);
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
    if (formData.email) (payload as unknown as Record<string, unknown>).email = String(formData.email);
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
      if (!formData.aadhaarImage) {
        setToastMsg({ text: "Aadhaar image is required", type: "error" });
        return;
      }
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
      email: s.email,
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

  // VIEW (open view modal with full images and details)
  const handleView = (s: SubscriberLocal) => {
    setViewingSubscriber(s);
    setViewOpen(true);
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
    { label: "Mobile Number", key: "mobile", type: "text", placeholder: "+91 98765 43210" },
    { label: "Email Address", key: "email", type: "email", placeholder: "john@email.com" },
    { label: "Password (only for create or change)", key: "password", type: "password", placeholder: "********" },
    { label: "Joining Date", key: "joiningDate", type: "date", placeholder: "" },
  ];

  return (
    <div className="space-y-6">
      {/* toast */}
      <Toast msg={toastMsg} onClose={() => setToastMsg(null)} />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
            <Input
              placeholder="Search by name, mobile, or email..."
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
                          <p className="text-xs text-[var(--text-secondary)]">{s.email}</p>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-highlight)]" onClick={() => handleView(s)}>
                          <Eye className="w-4 h-4 text-[var(--color-primary)]" />
                        </Button>
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
                  <p className="text-sm text-[var(--text-secondary)]">{viewingSubscriber.email}</p>
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

              {/* RIGHT: Images */}
              <div className="md:col-span-8 grid grid-cols-1 gap-6 mt-10">
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
                    <div className="flex justify-between"><strong>Member ID:</strong> <span className="truncate max-w-[60%] text-right">{viewingSubscriber._id ?? "—"}</span></div>
                    <div className="flex justify-between"><strong>Total Paid:</strong> <span>₹{Number(viewingSubscriber.totalPaid ?? 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><strong>Pending:</strong> <span>₹{Number(viewingSubscriber.pendingAmount ?? 0).toLocaleString()}</span></div>
                  </div>
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
    </div>
  );
}
