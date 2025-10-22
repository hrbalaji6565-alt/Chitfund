"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Edit,
  Trash2,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  Download,
  IndianRupee,
} from "lucide-react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import Button from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Badge } from "@/app/components/ui/badge"

interface ChitFund {
  id: number
  fundName: string
  groupName: string
  totalAmount: number
  collectedAmount: number
  pendingAmount: number
  startDate: string
  maturityDate: string
  status: "Active" | "Completed" | "Pending"
  interestRate: number
  numberOfInstallments: number
  completedInstallments: number
}

const initialFunds: ChitFund[] = [
  {
    id: 1,
    fundName: "Premium Fund 2024",
    groupName: "Group A - Premium",
    totalAmount: 2000000,
    collectedAmount: 1500000,
    pendingAmount: 500000,
    startDate: "2024-01-01",
    maturityDate: "2025-08-01",
    status: "Active",
    interestRate: 12,
    numberOfInstallments: 20,
    completedInstallments: 15,
  },
  {
    id: 2,
    fundName: "Standard Fund Q1",
    groupName: "Group B - Standard",
    totalAmount: 1000000,
    collectedAmount: 750000,
    pendingAmount: 250000,
    startDate: "2024-02-01",
    maturityDate: "2025-09-01",
    status: "Active",
    interestRate: 10,
    numberOfInstallments: 20,
    completedInstallments: 15,
  },
  {
    id: 3,
    fundName: "Elite Fund 2024",
    groupName: "Group C - Elite",
    totalAmount: 4000000,
    collectedAmount: 3800000,
    pendingAmount: 200000,
    startDate: "2023-06-01",
    maturityDate: "2025-01-01",
    status: "Active",
    interestRate: 15,
    numberOfInstallments: 20,
    completedInstallments: 19,
  },
  {
    id: 4,
    fundName: "Starter Fund 2023",
    groupName: "Group D - Starter",
    totalAmount: 500000,
    collectedAmount: 500000,
    pendingAmount: 0,
    startDate: "2023-01-01",
    maturityDate: "2024-08-01",
    status: "Completed",
    interestRate: 8,
    numberOfInstallments: 20,
    completedInstallments: 20,
  },
]

export default function ManageFundsPage() {
  const [funds, setFunds] = useState<ChitFund[]>(initialFunds)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFund, setEditingFund] = useState<ChitFund | null>(null)
  const [formData, setFormData] = useState<Partial<ChitFund>>({
    fundName: "",
    groupName: "",
    totalAmount: 0,
    collectedAmount: 0,
    pendingAmount: 0,
    startDate: "",
    maturityDate: "",
    status: "Active",
    interestRate: 0,
    numberOfInstallments: 20,
    completedInstallments: 0,
  })

  const filteredFunds = funds.filter((fund) => {
    const matchesSearch =
      fund.fundName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.groupName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || fund.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalFunds = funds.reduce((sum, fund) => sum + fund.totalAmount, 0)
  const totalCollected = funds.reduce((sum, fund) => sum + fund.collectedAmount, 0)
  const totalPending = funds.reduce((sum, fund) => sum + fund.pendingAmount, 0)

  const handleAddFund = () => {
    const newFund: ChitFund = {
      id: funds.length + 1,
      fundName: formData.fundName || "",
      groupName: formData.groupName || "",
      totalAmount: formData.totalAmount || 0,
      collectedAmount: formData.collectedAmount || 0,
      pendingAmount: (formData.totalAmount || 0) - (formData.collectedAmount || 0),
      startDate: formData.startDate || "",
      maturityDate: formData.maturityDate || "",
      status: formData.status || "Active",
      interestRate: formData.interestRate || 0,
      numberOfInstallments: formData.numberOfInstallments || 20,
      completedInstallments: formData.completedInstallments || 0,
    }
    setFunds([...funds, newFund])
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleEditFund = () => {
    if (editingFund) {
      setFunds(
        funds.map((f) =>
          f.id === editingFund.id
            ? {
                ...editingFund,
                ...formData,
                pendingAmount: (formData.totalAmount || 0) - (formData.collectedAmount || 0),
              }
            : f,
        ),
      )
      setEditingFund(null)
      resetForm()
    }
  }

  const handleDeleteFund = (id: number) => {
    setFunds(funds.filter((f) => f.id !== id))
  }

  const resetForm = () => {
    setFormData({
      fundName: "",
      groupName: "",
      totalAmount: 0,
      collectedAmount: 0,
      pendingAmount: 0,
      startDate: "",
      maturityDate: "",
      status: "Active",
      interestRate: 0,
      numberOfInstallments: 20,
      completedInstallments: 0,
    })
  }

  const openEditDialog = (fund: ChitFund) => {
    setEditingFund(fund)
    setFormData(fund)
  }

  const getProgressPercentage = (fund: ChitFund) => {
    return (fund.collectedAmount / fund.totalAmount) * 100
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-700 hover:bg-green-200"
      case "Completed":
        return "bg-blue-100 text-blue-700 hover:bg-blue-200"
      case "Pending":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Funds</p>
                    <h3 className="text-3xl font-bold mt-2">₹{totalFunds.toLocaleString()}</h3>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Collected Amount</p>
                    <h3 className="text-3xl font-bold mt-2">₹{totalCollected.toLocaleString()}</h3>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Pending Amount</p>
                    <h3 className="text-3xl font-bold mt-2">₹{totalPending.toLocaleString()}</h3>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search funds or groups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-xl">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none h-12 rounded-xl bg-transparent">
              <Download className="w-5 h-5 mr-2" />
              Export
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl shadow-lg h-12 px-6">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Fund
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Chit Fund</DialogTitle>
                  <DialogDescription>Create a new chit fund with all the necessary details.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fundName">Fund Name</Label>
                    <Input
                      id="fundName"
                      value={formData.fundName}
                      onChange={(e) => setFormData({ ...formData, fundName: e.target.value })}
                      placeholder="e.g., Premium Fund 2024"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Group Name</Label>
                    <Input
                      id="groupName"
                      value={formData.groupName}
                      onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                      placeholder="e.g., Group A - Premium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Total Amount (₹)</Label>
                    <Input
                      id="totalAmount"
                      type="number"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                      placeholder="2000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="collectedAmount">Collected Amount (₹)</Label>
                    <Input
                      id="collectedAmount"
                      type="number"
                      value={formData.collectedAmount}
                      onChange={(e) => setFormData({ ...formData, collectedAmount: Number(e.target.value) })}
                      placeholder="1500000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                    <Input
                      id="interestRate"
                      type="number"
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numberOfInstallments">Number of Installments</Label>
                    <Input
                      id="numberOfInstallments"
                      type="number"
                      value={formData.numberOfInstallments}
                      onChange={(e) => setFormData({ ...formData, numberOfInstallments: Number(e.target.value) })}
                      placeholder="20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="completedInstallments">Completed Installments</Label>
                    <Input
                      id="completedInstallments"
                      type="number"
                      value={formData.completedInstallments}
                      onChange={(e) => setFormData({ ...formData, completedInstallments: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as ChitFund["status"] })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maturityDate">Maturity Date</Label>
                    <Input
                      id="maturityDate"
                      type="date"
                      value={formData.maturityDate}
                      onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddFund}
                    className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
                  >
                    Create Fund
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Funds List */}
        <div className="space-y-4">
          <AnimatePresence>
            {filteredFunds.map((fund, index) => (
              <motion.div
                key={fund.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Fund Info */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">{fund.fundName}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{fund.groupName}</p>
                          </div>
                          <Badge className={getStatusColor(fund.status)}>{fund.status}</Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Amount</p>
                            <p className="text-lg font-semibold">₹{fund.totalAmount.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Collected</p>
                            <p className="text-lg font-semibold text-green-600">
                              ₹{fund.collectedAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Pending</p>
                            <p className="text-lg font-semibold text-orange-600">
                              ₹{fund.pendingAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Interest Rate</p>
                            <p className="text-lg font-semibold">{fund.interestRate}%</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Collection Progress</span>
                            <span className="font-semibold">{getProgressPercentage(fund).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${getProgressPercentage(fund)}%` }}
                              transition={{ duration: 1, delay: index * 0.1 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {fund.startDate} to {fund.maturityDate}
                            </span>
                          </div>
                          <div>
                            <span>
                              {fund.completedInstallments}/{fund.numberOfInstallments} Installments
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex lg:flex-col gap-2 justify-end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl hover:bg-blue-50 bg-transparent"
                              onClick={() => openEditDialog(fund)}
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Chit Fund</DialogTitle>
                              <DialogDescription>Update the fund details below.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-fundName">Fund Name</Label>
                                <Input
                                  id="edit-fundName"
                                  value={formData.fundName}
                                  onChange={(e) => setFormData({ ...formData, fundName: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-groupName">Group Name</Label>
                                <Input
                                  id="edit-groupName"
                                  value={formData.groupName}
                                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-totalAmount">Total Amount (₹)</Label>
                                <Input
                                  id="edit-totalAmount"
                                  type="number"
                                  value={formData.totalAmount}
                                  onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-collectedAmount">Collected Amount (₹)</Label>
                                <Input
                                  id="edit-collectedAmount"
                                  type="number"
                                  value={formData.collectedAmount}
                                  onChange={(e) =>
                                    setFormData({ ...formData, collectedAmount: Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-interestRate">Interest Rate (%)</Label>
                                <Input
                                  id="edit-interestRate"
                                  type="number"
                                  value={formData.interestRate}
                                  onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-numberOfInstallments">Number of Installments</Label>
                                <Input
                                  id="edit-numberOfInstallments"
                                  type="number"
                                  value={formData.numberOfInstallments}
                                  onChange={(e) =>
                                    setFormData({ ...formData, numberOfInstallments: Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-completedInstallments">Completed Installments</Label>
                                <Input
                                  id="edit-completedInstallments"
                                  type="number"
                                  value={formData.completedInstallments}
                                  onChange={(e) =>
                                    setFormData({ ...formData, completedInstallments: Number(e.target.value) })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-status">Status</Label>
                                <Select
                                  value={formData.status}
                                  onValueChange={(value) =>
                                    setFormData({ ...formData, status: value as ChitFund["status"] })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-startDate">Start Date</Label>
                                <Input
                                  id="edit-startDate"
                                  type="date"
                                  value={formData.startDate}
                                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-maturityDate">Maturity Date</Label>
                                <Input
                                  id="edit-maturityDate"
                                  type="date"
                                  value={formData.maturityDate}
                                  onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-3">
                              <Button variant="outline" onClick={() => setEditingFund(null)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleEditFund}
                                className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
                              >
                                Update Fund
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl hover:bg-red-50 bg-transparent"
                          onClick={() => handleDeleteFund(fund.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
  )
}
