"use client"

import { useState } from "react"
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Phone,
  Calendar,
  Eye,
  CheckCircle,
  XCircle
} from "lucide-react"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import Button from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"

interface Subscriber {
  id: number
  name: string
  mobile: string
  email: string
  address: string
  assignedGroup: string
  joiningDate: string
  status: "Active" | "Inactive"
  totalPaid: number
  pendingAmount: number
  aadhaarImage: string
  govIdImage?: string
  password: string
}

const groups = [
  "Group A - Premium",
  "Group B - Standard",
  "Group C - Elite",
  "Group D - Starter"
]

const initialSubscribers: Subscriber[] = [
  {
    id: 1,
    name: "Rajesh Kumar",
    mobile: "+91 98765 43210",
    email: "rajesh.kumar@email.com",
    address: "123 MG Road, Bangalore",
    assignedGroup: "Group A - Premium",
    joiningDate: "2024-01-01",
    status: "Active",
    totalPaid: 50000,
    pendingAmount: 5000,
    aadhaarImage: "",
    govIdImage: "",
    password: "******"
  }
]

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState(initialSubscribers)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [viewingSubscriber, setViewingSubscriber] = useState<Subscriber | null>(null)
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null)

  const emptyForm: Partial<Subscriber> = {
    name: "",
    mobile: "",
    email: "",
    address: "",
    assignedGroup: "",
    joiningDate: "",
    status: "Active",
    totalPaid: 0,
    pendingAmount: 0,
    aadhaarImage: "",
    govIdImage: "",
    password: ""
  }
  const [formData, setFormData] = useState(emptyForm)

  const filteredSubscribers = subscribers.filter((s) => {
    const search = searchTerm.toLowerCase()
    const matchesSearch =
      s.name.toLowerCase().includes(search) ||
      s.mobile.includes(searchTerm) ||
      s.email.toLowerCase().includes(search)
    const matchesFilter = filterStatus === "all" || s.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const handleChange = (key: keyof Subscriber, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleFileChange = (key: "aadhaarImage" | "govIdImage", file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => handleChange(key, reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleAddSubscriber = () => {
    if (!formData.aadhaarImage) {
      alert("Aadhaar image is required")
      return
    }
    const newSubscriber = {
      ...(formData as Subscriber),
      id: subscribers.length + 1
    }
    setSubscribers([...subscribers, newSubscriber])
    setIsAddDialogOpen(false)
    setFormData(emptyForm)
  }

  const handleEditSubscriber = () => {
    if (!editingSubscriber) return
    setSubscribers(
      subscribers.map((s) => (s.id === editingSubscriber.id ? { ...editingSubscriber, ...formData } : s))
    )
    setEditingSubscriber(null)
    setFormData(emptyForm)
  }

  const handleDeleteSubscriber = (id: number) =>
    setSubscribers(subscribers.filter((s) => s.id !== id))

  const fieldConfig = [
    { label: "Full Name", key: "name", type: "text", placeholder: "John Doe" },
    { label: "Mobile Number", key: "mobile", type: "text", placeholder: "+91 98765 43210" },
    { label: "Email Address", key: "email", type: "email", placeholder: "john@email.com" },
    { label: "Password", key: "password", type: "password", placeholder: "********" },
    { label: "Joining Date", key: "joiningDate", type: "date" }
  ]

  return (
    <div className="space-y-6">
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

        {/* Add Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)] rounded-xl shadow-lg h-12 px-6">
              <Plus className="w-5 h-5 mr-2" />
              Add Subscriber
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] text-[var(--text-primary)]">
            <DialogHeader>
              <DialogTitle>Add New Subscriber</DialogTitle>
              <DialogDescription>Add a new subscriber to the chit fund system.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {fieldConfig.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={f.key} className="text-[var(--text-primary)]">{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={formData[f.key as keyof Subscriber] as string}
                    onChange={(e) => handleChange(f.key as keyof Subscriber, e.target.value)}
                    className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] placeholder:text-[var(--text-secondary)]"
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Assigned Group</Label>
                <Select
                  value={formData.assignedGroup}
                  onValueChange={(v) => handleChange("assignedGroup", v)}
                >
                  <SelectTrigger className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                    {groups.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-[var(--text-primary)]">Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="123 Main Street, City"
                  className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] placeholder:text-[var(--text-secondary)]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Aadhaar Image (Required)</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("aadhaarImage", e.target.files?.[0] || null)} className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]" />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">PAN / Other Govt ID (Optional)</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleFileChange("govIdImage", e.target.files?.[0] || null)} className="bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]" />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--text-primary)]">Status</Label>
                <Select
                  value={formData.status}
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
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddSubscriber}
                className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-[var(--text-light)]"
              >
                Add Subscriber
              </Button>
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
                  {["Name", "Contact", "Group", "Joining Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left py-4 px-6 w-120 text-sm font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-[var(--bg-highlight)] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-full flex items-center justify-center text-[var(--text-light)] font-semibold">
                          {s.name.charAt(0)}
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
                    <td className="py-4 px-6 text-sm font-medium">{s.assignedGroup}</td>
                    <td className="py-4 px-6 text-sm flex items-center gap-2 text-[var(--text-secondary)]">
                      <Calendar className="w-4 h-4 text-[var(--color-secondary)]" />
                      {s.joiningDate}
                    </td>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-highlight)]">
                          <Eye className="w-4 h-4 text-[var(--color-primary)]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[var(--bg-highlight)]">
                          <Edit className="w-4 h-4 text-[var(--color-primary)]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-[var(--color-accent)]"
                          onClick={() => handleDeleteSubscriber(s.id)}
                        >
                          <Trash2 className="w-4 h-4 text-[var(--color-accent)]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
