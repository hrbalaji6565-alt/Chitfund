"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, Search, Users, Calendar, CheckCircle, XCircle } from "lucide-react"
import { Input } from "@/app/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import Button from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"

interface FormField {
  name: keyof ChitGroup  // field must be a key from ChitGroup
  label: string
  type: "text" | "number" | "date"
  placeholder?: string
}

interface ChitGroup {
  id: number
  name: string
  chitValue: number
  monthlyInstallment: number
  totalMonths: number
  totalMembers: number
  startDate: string
  endDate: string
  status: "Active" | "Closed" | "Inactive"
  remarks: string
  penaltyPercent?: number
}

const initialGroups: ChitGroup[] = [
  { id: 1, name: "Group A - Premium", chitValue: 100000, monthlyInstallment: 5000, totalMonths: 20, totalMembers: 20, startDate: "2024-01-01", endDate: "2025-08-01", status: "Active", remarks: "High value group for premium members", penaltyPercent: 2 },
  { id: 2, name: "Group B - Standard", chitValue: 50000, monthlyInstallment: 2500, totalMonths: 20, totalMembers: 20, startDate: "2024-02-01", endDate: "2025-09-01", status: "Active", remarks: "Standard group for regular members", penaltyPercent: 2 },
  { id: 3, name: "Group C - Elite", chitValue: 200000, monthlyInstallment: 10000, totalMonths: 20, totalMembers: 20, startDate: "2023-06-01", endDate: "2025-01-01", status: "Active", remarks: "Elite group with high returns", penaltyPercent: 2 },
  { id: 4, name: "Group D - Starter", chitValue: 25000, monthlyInstallment: 1250, totalMonths: 20, totalMembers: 20, startDate: "2023-01-01", endDate: "2024-08-01", status: "Closed", remarks: "Completed successfully", penaltyPercent: 2 },
]

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
]

export default function GroupsPage() {
  const [groups, setGroups] = useState<ChitGroup[]>(initialGroups)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ChitGroup | null>(null)
  const [formData, setFormData] = useState<Partial<ChitGroup>>({
    name: "",
    chitValue: 0,
    monthlyInstallment: 0,
    totalMonths: 20,
    totalMembers: 20,
    startDate: "",
    endDate: "",
    status: "Active",
    remarks: "",
    penaltyPercent: 2, // default penalty
  })

  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleAddGroup = () => {
    const newGroup: ChitGroup = {
      id: groups.length + 1,
      status: "Active",
      penaltyPercent: 2,
      ...formData,
    } as ChitGroup
    setGroups([...groups, newGroup])
    setIsAddDialogOpen(false)
    resetForm()
  }

const handleEditGroup = () => {
  if (editingGroup) {
    setGroups(groups.map((g) => (g.id === editingGroup.id ? { ...editingGroup, ...formData } : g)))
    setEditingGroup(null) 
    setIsAddDialogOpen(false)
    resetForm()          
  }
}


  const handleDeleteGroup = (id: number) => {
    setGroups(groups.filter((g) => g.id !== id))
  }

  const resetForm = () => {
    setFormData({ name: "", chitValue: 0, monthlyInstallment: 0, totalMonths: 20, totalMembers: 20, startDate: "", endDate: "", status: "Active", remarks: "", penaltyPercent: 2 })
  }

  const openEditDialog = (group: ChitGroup) => {
    setEditingGroup(group)
    setFormData(group)
  }

 const renderFormFields = () =>
  formFields.map((field) => (
    <div key={field.name} className="space-y-2">
      <Label htmlFor={field.name}>{field.label}</Label>
      <Input
        id={field.name}
        type={field.type}
        value={formData[field.name] as string | number} // cast based on field type
        onChange={(e) => {
          const value = field.type === "number" ? Number(e.target.value) : e.target.value
          setFormData({ ...formData, [field.name]: value })
        }}
        placeholder={field.placeholder}
      />
    </div>
  ))
// update
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input placeholder="Search groups..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-12 rounded-xl" />
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl shadow-lg h-12 px-6">
              <Plus className="w-5 h-5 mr-2" />
              Add New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Chit Group</DialogTitle>
              <DialogDescription>Create a new chit group with all the necessary details.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">{renderFormFields()}</div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGroup} className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white">
                Create Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((group) => (
          <div key={group.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden p-4">
            <CardHeader className="bg-gradient-to-br from-blue-50 to-green-50 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{group.name}</CardTitle>
                  <Badge
                    variant={group.status === "Active" ? "default" : "secondary"}
                    className={
                      group.status === "Active" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-700"
                    }
                  >
                    {group.status === "Active" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                    {group.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-blue-100" onClick={() => openEditDialog(group)}>
                        <Edit className="w-4 h-4 text-blue-600" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Chit Group</DialogTitle>
                        <DialogDescription>Update the group details below.</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">{renderFormFields()}</div>
                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setEditingGroup(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleEditGroup} className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white">
                          Update Group
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-100" onClick={() => handleDeleteGroup(group.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Chit Value</span>
                <span className="font-semibold text-lg">₹{group.chitValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Monthly Installment</span>
                <span className="font-semibold">₹{group.monthlyInstallment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Penalty</span>
                <span className="font-semibold">{group.penaltyPercent || 0}%</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-muted-foreground">{group.totalMembers} Members</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-green-600" />
                <span className="text-muted-foreground">
                  {group.totalMonths} Months ({group.startDate} to {group.endDate})
                </span>
              </div>
              {group.remarks && <p className="text-xs text-muted-foreground pt-2 border-t">{group.remarks}</p>}
            </CardContent>
          </div>
        ))}
      </div>
    </div>
  )
}
