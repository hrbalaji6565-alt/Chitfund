"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Edit, Trash2, Search, Users, Calendar, CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import Button from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchGroups, createGroup, updateGroup, deleteGroup } from "@/store/chitGroupSlice";
import { fetchMembers } from "@/store/memberSlice";
import type { ChitGroup as ChitGroupType, Member as MemberType } from "@/app/lib/types";

interface FormField {
  name: keyof FormDataShape;
  label: string;
  type: "text" | "number" | "date";
  placeholder?: string;
}

/** Note: server groups have _id (string). We keep UI exactly same but use _id internally. */
type ServerGroup = ChitGroupType & {
  _id?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  members?: string[];
  penaltyPercent?: number;
  status?: "Active" | "Closed" | "Inactive";
};

/** shape used in the form (subset) */
type FormDataShape = {
  _id?: string;
  name: string;
  chitValue: number;
  monthlyInstallment: number;
  totalMonths: number;
  totalMembers: number;
  startDate: string; // ISO yyyy-mm-dd for input
  endDate: string; // ISO yyyy-mm-dd for input
  status: "Active" | "Closed" | "Inactive";
  remarks: string;
  penaltyPercent?: number;
  members?: string[];
};

const formFields: FormField[] = [
  { name: "name", label: "Group Name", type: "text", placeholder: "Group A - Premium" },
  { name: "chitValue", label: "Chit Value (₹)", type: "number", placeholder: "100000" },
  { name: "monthlyInstallment", label: "Monthly Installment (₹)", type: "number", placeholder: "5000" },
  { name: "totalMonths", label: "Total Months", type: "number", placeholder: "20" },
  { name: "totalMembers", label: "Total Members", type: "number", placeholder: "20" },
  { name: "startDate", label: "Start Date", type: "date" },
  { name: "endDate", label: "End Date", type: "date" },
  { name: "penaltyPercent", label: "Penalty (%)", type: "number", placeholder: "2" },
  { name: "remarks", label: "Remarks", type: "text", placeholder: "Additional notes..." },
];

/** Helpers - date utilities */
function toInputDate(value?: string | null): string {
  if (!value) return "";
  const isoLike = /^\d{4}-\d{2}-\d{2}$/;
  if (isoLike.test(value)) return value;
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function formatToDDMMYYYY(value?: string | null): string {
  if (!value) return "";
  const isoLike = /^\d{4}-\d{2}-\d{2}$/;
  let date: Date;
  if (isoLike.test(value)) date = new Date(`${value}T00:00:00`);
  else date = new Date(value);
  if (isNaN(date.getTime())) return value || "";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function addMonthsKeepDay(startDateStr: string, months: number): string {
  if (!startDateStr) return "";
  const input = toInputDate(startDateStr);
  if (!input) return "";
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const targetMonthIndex = ((targetMonth % 12) + 12) % 12;
  const candidate = new Date(targetYear, targetMonthIndex, d);
  if (candidate.getMonth() !== targetMonthIndex) {
    const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    candidate.setDate(lastDay);
  }
  const yyyy = candidate.getFullYear();
  const mmStr = String(candidate.getMonth() + 1).padStart(2, "0");
  const ddStr = String(candidate.getDate()).padStart(2, "0");
  return `${yyyy}-${mmStr}-${ddStr}`;
}

/** Robust helper: does member belong to groupId? Accepts many server shapes */
function memberBelongsToGroup(member: unknown, groupId?: string | null): boolean {
  if (!groupId) return false;
  if (!member || typeof member !== "object") return false;
  const m = member as Record<string, unknown>;

  // direct field: member.group (ObjectId or string or nested)
  const g = m["group"];
  if (typeof g === "string" && String(g) === String(groupId)) return true;
  if (typeof g === "object" && g !== null) {
    const gObj = g as Record<string, unknown>;
    if (typeof gObj._id === "string" && String(gObj._id) === String(groupId)) return true;
    if (typeof gObj._id === "number" && String(gObj._id) === String(groupId)) return true;
  }

  // legacy single id
  if (m["groupId"] && String(m["groupId"]) === String(groupId)) return true;

  // arrays: member.groups or member.groupIds or group_ids
  const groupsField = m["groups"];
  if (Array.isArray(groupsField)) {
    for (const gg of groupsField) {
      if (typeof gg === "string" && gg === String(groupId)) return true;
      if (typeof gg === "object" && gg !== null) {
        const ggObj = gg as Record<string, unknown>;
        if (typeof ggObj._id === "string" && String(ggObj._id) === String(groupId)) return true;
      }
    }
  }
  const groupIds = m["groupIds"];
  if (Array.isArray(groupIds)) {
    if (groupIds.some((gId) => String(gId) === String(groupId))) return true;
  }
  const group_ids = m["group_ids"];
  if (Array.isArray(group_ids)) {
    if (group_ids.some((gId) => String(gId) === String(groupId))) return true;
  }
  return false;
}

/** Utility to produce a normalized groups array for a member (existing groups as strings) */
function getMemberGroupsArray(member: unknown): string[] {
  if (!member || typeof member !== "object") return [];
  const m = member as Record<string, unknown>;
  if (Array.isArray(m["groups"])) {
    return (m["groups"] as Array<unknown>)
      .map((g) => {
        if (!g) return undefined;
        if (typeof g === "string") return g;
        if (typeof g === "object" && g !== null) {
          const o = g as Record<string, unknown>;
          if (typeof o._id === "string") return o._id;
          return undefined;
        }
        return undefined;
      })
      .filter(Boolean) as string[];
  }
  if (Array.isArray(m["groupIds"])) {
    return (m["groupIds"] as Array<unknown>).map(String).filter(Boolean) as string[];
  }
  if (typeof m["group"] === "string") return [m["group"] as string];
  if (typeof m["group"] === "object" && m["group"] !== null) {
    const g = m["group"] as Record<string, unknown>;
    if (typeof g._id === "string") return [g._id];
  }
  if (m["groupId"]) return [String(m["groupId"])];
  return [];
}

/** Safe accessors to avoid casting to `any` */
function getMemberId(member: unknown): string | undefined {
  if (!member || typeof member !== "object") return undefined;
  const m = member as Record<string, unknown>;
  const possible = m._id ?? m.id ?? (m as { _doc?: { id?: unknown } })?._doc?.id; // small, internal fallback for mongoose shape
  if (possible === undefined || possible === null) return undefined;
  return String(possible);
}
function getMemberName(member: unknown): string {
  if (!member || typeof member !== "object") return "";
  const m = member as Record<string, unknown>;
  return (m["name"] ? String(m["name"]) : "");
}
function getMemberEmail(member: unknown): string {
  if (!member || typeof member !== "object") return "";
  const m = member as Record<string, unknown>;
  return (m["email"] ? String(m["email"]) : "");
}
function getMemberMobile(member: unknown): string {
  if (!member || typeof member !== "object") return "";
  const m = member as Record<string, unknown>;
  return (m["mobile"] ? String(m["mobile"]) : "");
}

export default function GroupsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const groups = useSelector((state: RootState) => state.chitGroups.groups) as ServerGroup[];
  const status = useSelector((state: RootState) => state.chitGroups.status);

  // members from redux
  const members = useSelector((state: RootState) => state.members.members) as MemberType[] | unknown[];
  const membersStatus = useSelector((state: RootState) => state.members.status);

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
  const [formData, setFormData] = useState<FormDataShape>({
    name: "",
    chitValue: 0,
    monthlyInstallment: 0,
    totalMonths: 20,
    totalMembers: 20,
    startDate: "",
    endDate: "",
    status: "Active",
    remarks: "",
    penaltyPercent: 2,
  });

  useEffect(() => {
    if (status === "idle") dispatch(fetchGroups());
    if (membersStatus === "idle") dispatch(fetchMembers());
  }, [status, membersStatus, dispatch]);

  const filteredGroups = groups.filter((g) => (g.name || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const resetForm = () =>
    setFormData({
      name: "",
      chitValue: 0,
      monthlyInstallment: 0,
      totalMonths: 20,
      totalMembers: 20,
      startDate: "",
      endDate: "",
      status: "Active",
      remarks: "",
      penaltyPercent: 2,
    });

  const openEditDialog = (group: ServerGroup) => {
    setEditingGroup(group);
    setFormData({
      _id: group._id,
      name: group.name || "",
      chitValue: (group.chitValue as number) || 0,
      monthlyInstallment: (group.monthlyInstallment as number) || 0,
      totalMonths: (group.totalMonths as number) || 0,
      totalMembers: (group.totalMembers as number) || 0,
      startDate: toInputDate(group.startDate ?? group.createdAt ?? ""),
      endDate: toInputDate(group.endDate ?? ""),
      status: (group.status as ServerGroup["status"]) || "Active",
      remarks: group.remarks || "",
      penaltyPercent: group.penaltyPercent ?? 0,
    });
    setIsAddDialogOpen(true);
  };

  const handleStartDateChange = (value: string) => {
    const newStart = value;
    const end = newStart && formData.totalMonths ? addMonthsKeepDay(newStart, formData.totalMonths) : formData.endDate;
    setFormData({ ...formData, startDate: newStart, endDate: end });
  };
  const handleTotalMonthsChange = (value: number) => {
    const months = Number(value) || 0;
    const end = formData.startDate ? addMonthsKeepDay(formData.startDate, months) : formData.endDate;
    setFormData({ ...formData, totalMonths: months, endDate: end });
  };

  const handleAddGroup = async () => {
    try {
      const payload: Partial<FormDataShape> = { ...formData };
      delete payload._id;
      await dispatch(createGroup(payload)).unwrap();
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Create failed:", err);
    }
  };

  const handleEditGroup = async () => {
    if (!editingGroup) return;
    try {
      const id = editingGroup._id;
      if (!id) throw new Error("Missing group id");
      const updates: Partial<FormDataShape> = { ...formData };
      delete updates._id;
      await dispatch(updateGroup({ id, updates })).unwrap();
      setEditingGroup(null);
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleDeleteGroup = async (id?: string) => {
    if (!id) return;
    try {
      await dispatch(deleteGroup(id)).unwrap();
      await dispatch(fetchMembers());
      await dispatch(fetchGroups());
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const renderFormFields = () =>
    formFields.map((field) => {
      if (field.name === "startDate") {
        return (
          <div key="startDate" className="space-y-2">
            <Label htmlFor="startDate" className="text-[var(--text-primary)]">
              {field.label}
            </Label>
            <Input id="startDate" type="date" value={formData.startDate ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStartDateChange(e.target.value)} className="bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border-[var(--border-color)]" />
          </div>
        );
      }

      if (field.name === "totalMonths") {
        return (
          <div key="totalMonths" className="space-y-2">
            <Label htmlFor="totalMonths" className="text-[var(--text-primary)]">
              {field.label}
            </Label>
            <Input id="totalMonths" type="number" value={formData.totalMonths ?? 0} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTotalMonthsChange(Number(e.target.value))} placeholder={field.placeholder} className="bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border-[var(--border-color)]" />
          </div>
        );
      }

      if (field.name === "endDate") {
        return (
          <div key="endDate" className="space-y-2">
            <Label htmlFor="endDate" className="text-[var(--text-primary)]">
              {field.label}
            </Label>
            <Input id="endDate" type="date" value={formData.endDate ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, endDate: e.target.value })} className="bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border-[var(--border-color)]" />
          </div>
        );
      }

      const value = formData[field.name] as unknown as string | number;

      return (
        <div key={String(field.name)} className="space-y-2">
          <Label htmlFor={String(field.name)} className="text-[var(--text-primary)]">
            {field.label}
          </Label>
          <Input
            id={String(field.name)}
            type={field.type}
            value={value as string | number}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData({
                ...formData,
                [field.name]: field.type === "number" ? Number(e.target.value) : e.target.value,
              } as FormDataShape)
            }
            placeholder={field.placeholder}
            className="bg-[var(--bg-card)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] border-[var(--border-color)]"
          />
        </div>
      );
    });

  function GroupCard({ group }: { group: ServerGroup }) {
    const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
    const [searchAvailable, setSearchAvailable] = useState("");
    const [selectedMemberToAdd, setSelectedMemberToAdd] = useState<string[]>([]);

    // members assigned to this group (robust check)
    const membersInGroup = useMemo(() => {
      return (members || []).filter((m) => memberBelongsToGroup(m, group._id));
    }, [members, group._id]);

    // available members = those not in this group (robust check)
    const availableMembers = useMemo(() => {
      return (members || []).filter((m) => !memberBelongsToGroup(m, group._id));
    }, [members, group._id]);

    const filteredAvailable = availableMembers.filter((m) => {
      const q = searchAvailable.trim().toLowerCase();
      if (!q) return true;
      return getMemberName(m).toLowerCase().includes(q) || getMemberEmail(m).toLowerCase().includes(q) || getMemberMobile(m).toLowerCase().includes(q);
    });

    const openMembersDialog = () => {
      setIsMemberDialogOpen(true);
      setSearchAvailable("");
      setSelectedMemberToAdd([]);
    };

    // multi-select toggle
    const toggleSelectMember = (id: string) => {
      setSelectedMemberToAdd((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    };

    // add selected members to group (append group.id into members' groups array)
    const addSelectedMembersToGroup = async () => {
      if (!selectedMemberToAdd || selectedMemberToAdd.length === 0) return;
      try {
        // compute current member IDs for this group (string array)
        const current = membersInGroup.map((m) => getMemberId(m)).filter(Boolean) as string[];
        // merge current + selected without duplicates
        const mergedSet = new Set<string>([...current, ...selectedMemberToAdd.map(String)]);
        const mergedArr = Array.from(mergedSet);

        // Call updateGroup to set group's members array (server should reconcile member docs)
        if (!group._id) return;
        await dispatch(updateGroup({ id: group._id, updates: { members: mergedArr } as Partial<FormDataShape> })).unwrap();

        // refresh local data
        await dispatch(fetchMembers());
        await dispatch(fetchGroups());

        // reset selection
        setSelectedMemberToAdd([]);
      } catch (err) {
        console.error("Failed to add members to group:", err);
      }
    };

    // remove a member from this group by updating the group's members array
    const removeMemberFromGroup = async (memberId: string) => {
      try {
        // current members in group
        const current = membersInGroup.map((m) => getMemberId(m)).filter(Boolean) as string[];
        const updated = current.filter((id) => String(id) !== String(memberId));

        if (!group._id) return;
        await dispatch(updateGroup({ id: group._id, updates: { members: updated } as Partial<FormDataShape> })).unwrap();

        // refresh data
        await dispatch(fetchMembers());
        await dispatch(fetchGroups());
      } catch (err) {
        console.error("Failed to remove member from group:", err);
      }
    };

    const clearSelection = () => {
      setSelectedMemberToAdd([]);
      setSearchAvailable("");
    };

    return (
      <div className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden p-4 bg-[var(--bg-card)] text-[var(--text-primary)]">
        <CardHeader className="bg-gradient-to-br from-[var(--bg-highlight)] to-[var(--bg-highlight)] pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 p-3">
              <CardTitle className="text-lg mb-2">{group.name}</CardTitle>
              <Badge
                variant="default"
                className={group.status === "Active" ? "bg-[var(--color-secondary)] text-[var(--text-light)] hover:bg-[var(--color-secondary-dark)]" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}
              >
                {group.status === "Active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                {group.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-[var(--bg-highlight)]" onClick={() => openEditDialog(group)}>
                    <Edit className="w-4 h-4 text-[var(--color-primary)]" />
                  </Button>
                </DialogTrigger>
              </Dialog>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-[var(--bg-highlight)]" onClick={() => handleDeleteGroup(group._id)}>
                <Trash2 className="w-4 h-4 text-[var(--color-accent)]" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Chit Value</span>
            <span className="font-semibold text-lg">₹{Number(group.chitValue).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Monthly Installment</span>
            <span className="font-semibold">₹{Number(group.monthlyInstallment).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Penalty</span>
            <span className="font-semibold">{group.penaltyPercent || 0}%</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-[var(--text-secondary)]">{group.totalMembers} Members</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-[var(--color-secondary)]" />
            <span className="text-[var(--text-secondary)]">
              {group.totalMonths} Months ({formatToDDMMYYYY(toInputDate(group.startDate ?? group.createdAt ?? ""))} to {formatToDDMMYYYY(toInputDate(group.endDate ?? ""))})
            </span>
          </div>

          {group.remarks && <p className="text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--border-color)]">{group.remarks}</p>}

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">{membersInGroup.length}</strong> assigned
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openMembersDialog()}>
                Manage Members
              </Button>
            </div>
          </div>
        </CardContent>

        <Dialog open={isMemberDialogOpen} onOpenChange={(open) => { setIsMemberDialogOpen(open); setSearchAvailable(""); setSelectedMemberToAdd([]); }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)]">
            <DialogHeader>
              <DialogTitle>Manage Members - {group.name}</DialogTitle>
              <DialogDescription>View members assigned to this group. Add or remove members below. You can select multiple available members and add them together.</DialogDescription>
            </DialogHeader>

            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Assigned Members ({membersInGroup.length})</h4>
                {membersInGroup.length === 0 ? (
                  <div className="text-sm text-[var(--text-secondary)]">No members assigned to this group.</div>
                ) : (
                  <div className="space-y-2">
                    {membersInGroup.map((m) => (
                      <div key={getMemberId(m)} className="flex items-center justify-between gap-3 p-2 rounded-md bg-[var(--bg-muted)] border border-[var(--border-color)]">
                        <div>
                          <div className="font-medium">{getMemberName(m)}</div>
                          <div className="text-xs text-[var(--text-secondary)]">{getMemberEmail(m)} • {getMemberMobile(m)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => removeMemberFromGroup(String(getMemberId(m)))}>Remove</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Add Existing Members (multi-select)</h4>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input placeholder="Search available members..." value={searchAvailable} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchAvailable(e.target.value)} className="mb-2" />
                    <div className="max-h-56 overflow-y-auto border rounded-md p-2 bg-[var(--bg-muted)]">
                      {filteredAvailable.length === 0 ? (
                        <div className="text-xs text-[var(--text-secondary)]">No available members found.</div>
                      ) : (
                        filteredAvailable.map((m) => {
                          const id = getMemberId(m) ?? "";
                          const checked = selectedMemberToAdd.includes(id);
                          return (
                            <label key={id} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-highlight)] cursor-pointer">
                              <input
                                type="checkbox"
                                value={id}
                                checked={checked}
                                onChange={() => toggleSelectMember(id)}
                              />
                              <div>
                                <div className="font-medium text-sm">{getMemberName(m)}</div>
                                <div className="text-xs text-[var(--text-secondary)]">{getMemberEmail(m)} • {getMemberMobile(m)}</div>
                                <div className="text-xs text-[var(--text-secondary)]">Currently in {getMemberGroupsArray(m).length || 0} group(s)</div>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="w-36 flex flex-col gap-2">
                    <Button size="sm" onClick={addSelectedMembersToGroup} disabled={!selectedMemberToAdd.length}>Add Selected</Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-2">Selected members will have this group&#39;s id appended to their <code>groups</code> array (allowing multi-group membership).</p>
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
          <Input placeholder="Search groups..." value={searchTerm} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)} className="pl-10 h-12 rounded-xl bg-[var(--bg-card)] text-[var(--text-primary)]" />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setEditingGroup(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button variant="default">
              <Plus className="w-5 h-5 mr-2" /> Add New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)]">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Edit Chit Group" : "Add New Chit Group"}</DialogTitle>
              <DialogDescription>{editingGroup ? "Update the group details below." : "Create a new chit group with all the necessary details."}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {renderFormFields()}
              <div className="space-y-2">
                <Label htmlFor="status" className="text-[var(--text-primary)]">Status</Label>
                <select id="status" value={formData.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, status: e.target.value as FormDataShape["status"] })} className="w-full h-10 rounded-md px-3 bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setEditingGroup(null); resetForm(); }}>Cancel</Button>
              {editingGroup ? (
                <Button onClick={handleEditGroup} className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)]">Update Group</Button>
              ) : (
                <Button onClick={handleAddGroup} className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)]">Create Group</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((group, idx) => (
          <GroupCard key={group._id ?? idx} group={group} />
        ))}
      </div>
    </div>
  );
}
