"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { FileText, Download, Send, Eye, Plus, Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger  } from "@/app/components/ui/dialog"
import Button from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Badge } from "@/app/components/ui/badge"


interface Invoice {
  id: number
  invoiceNo: string
  memberName: string
  groupName: string
  amount: number
  dueDate: string
  status: "Paid" | "Pending" | "Overdue"
  generatedDate: string
}

const initialInvoices: Invoice[] = [
  {
    id: 1,
    invoiceNo: "INV-2024-001",
    memberName: "Rajesh Kumar",
    groupName: "Group A - Premium",
    amount: 5000,
    dueDate: "2024-02-15",
    status: "Paid",
    generatedDate: "2024-01-15",
  },
  {
    id: 2,
    invoiceNo: "INV-2024-002",
    memberName: "Sneha Reddy",
    groupName: "Group A - Premium",
    amount: 5000,
    dueDate: "2024-02-15",
    status: "Pending",
    generatedDate: "2024-01-15",
  },
  {
    id: 3,
    invoiceNo: "INV-2024-003",
    memberName: "Arjun Mehta",
    groupName: "Group B - Standard",
    amount: 2500,
    dueDate: "2024-01-20",
    status: "Overdue",
    generatedDate: "2024-01-10",
  },
  {
    id: 4,
    invoiceNo: "INV-2024-004",
    memberName: "Priya Sharma",
    groupName: "Group C - Elite",
    amount: 10000,
    dueDate: "2024-02-20",
    status: "Pending",
    generatedDate: "2024-01-20",
  },
]

const members = [
  "Rajesh Kumar",
  "Priya Sharma",
  "Amit Patel",
  "Sneha Reddy",
  "Vikram Singh",
  "Kavita Singh",
  "Arjun Mehta",
  "Rahul Verma",
]

const groups = ["Group A - Premium", "Group B - Standard", "Group C - Elite", "Group D - Starter"]

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [newInvoice, setNewInvoice] = useState({
    memberName: "",
    groupName: "",
    amount: 0,
    dueDate: "",
  })

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.groupName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const paidInvoices = invoices.filter((i) => i.status === "Paid")
  const pendingInvoices = invoices.filter((i) => i.status === "Pending")
  const overdueInvoices = invoices.filter((i) => i.status === "Overdue")

  const handleCreateInvoice = () => {
    const invoice: Invoice = {
      id: invoices.length + 1,
      invoiceNo: `INV-2024-${String(invoices.length + 1).padStart(3, "0")}`,
      memberName: newInvoice.memberName,
      groupName: newInvoice.groupName,
      amount: newInvoice.amount,
      dueDate: newInvoice.dueDate,
      status: "Pending",
      generatedDate: new Date().toISOString().split("T")[0],
    }
    setInvoices([...invoices, invoice])
    setShowCreateDialog(false)
    setNewInvoice({ memberName: "", groupName: "", amount: 0, dueDate: "" })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700 hover:bg-green-200"
      case "Pending":
        return "bg-orange-100 text-orange-700 hover:bg-orange-200"
      case "Overdue":
        return "bg-red-100 text-red-700 hover:bg-red-200"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-700 mb-1">Total Invoices</p>
                    <h3 className="text-3xl font-bold text-blue-800">{invoices.length}</h3>
                  </div>
                  <div className="bg-blue-200 p-4 rounded-2xl">
                    <FileText className="w-8 h-8 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 mb-1">Paid</p>
                    <h3 className="text-3xl font-bold text-green-800">{paidInvoices.length}</h3>
                  </div>
                  <div className="bg-green-200 p-4 rounded-2xl">
                    <FileText className="w-8 h-8 text-green-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700 mb-1">Pending</p>
                    <h3 className="text-3xl font-bold text-orange-800">{pendingInvoices.length}</h3>
                  </div>
                  <div className="bg-orange-200 p-4 rounded-2xl">
                    <FileText className="w-8 h-8 text-orange-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-700 mb-1">Overdue</p>
                    <h3 className="text-3xl font-bold text-red-800">{overdueInvoices.length}</h3>
                  </div>
                  <div className="bg-red-200 p-4 rounded-2xl">
                    <FileText className="w-8 h-8 text-red-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Invoices List */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl">Invoice Management</CardTitle>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 rounded-xl w-full sm:w-64"
                  />
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl h-12">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Invoice</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="member">Select Member</Label>
                        <Select
                          value={newInvoice.memberName}
                          onValueChange={(value) => setNewInvoice({ ...newInvoice, memberName: value })}
                        >
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Choose member" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((member) => (
                              <SelectItem key={member} value={member}>
                                {member}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="group">Select Group</Label>
                        <Select
                          value={newInvoice.groupName}
                          onValueChange={(value) => setNewInvoice({ ...newInvoice, groupName: value })}
                        >
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Choose group" />
                          </SelectTrigger>
                          <SelectContent>
                            {groups.map((group) => (
                              <SelectItem key={group} value={group}>
                                {group}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={newInvoice.amount || ""}
                          onChange={(e) => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
                          placeholder="Enter amount"
                          className="h-12 rounded-xl"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={newInvoice.dueDate}
                          onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                          className="h-12 rounded-xl"
                        />
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateInvoice}
                          disabled={
                            !newInvoice.memberName || !newInvoice.groupName || !newInvoice.amount || !newInvoice.dueDate
                          }
                          className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
                        >
                          Create Invoice
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-green-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Invoice No.</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Member Name</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Group</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Due Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, index) => (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-6 font-medium text-blue-600">{invoice.invoiceNo}</td>
                      <td className="py-4 px-6 font-medium">{invoice.memberName}</td>
                      <td className="py-4 px-6 text-sm text-gray-600">{invoice.groupName}</td>
                      <td className="py-4 px-6 font-semibold">₹{invoice.amount.toLocaleString()}</td>
                      <td className="py-4 px-6 text-sm">{invoice.dueDate}</td>
                      <td className="py-4 px-6">
                        <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => setSelectedInvoice(invoice)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>Invoice Details</DialogTitle>
                              </DialogHeader>
                              {selectedInvoice && (
                                <div className="space-y-6 py-4">
                                  <div className="bg-gradient-to-br from-blue-50 to-green-50 p-8 rounded-2xl">
                                    <div className="text-center mb-8">
                                      <h2 className="text-3xl font-bold text-gray-800">ChitFund Pro</h2>
                                      <p className="text-sm text-gray-600">Invoice</p>
                                    </div>
                                    <div className="bg-white p-8 rounded-xl space-y-6">
                                      <div className="grid grid-cols-2 gap-6">
                                        <div>
                                          <p className="text-sm text-gray-600 mb-1">Invoice Number</p>
                                          <p className="text-lg font-bold text-blue-600">{selectedInvoice.invoiceNo}</p>
                                        </div>
                                        <div>
                                          <p className="text-sm text-gray-600 mb-1">Generated Date</p>
                                          <p className="text-lg font-semibold">{selectedInvoice.generatedDate}</p>
                                        </div>
                                      </div>

                                      <div className="border-t pt-6">
                                        <p className="text-sm text-gray-600 mb-2">Bill To:</p>
                                        <p className="text-xl font-bold text-gray-800">{selectedInvoice.memberName}</p>
                                        <p className="text-sm text-gray-600">{selectedInvoice.groupName}</p>
                                      </div>

                                      <div className="border-t pt-6">
                                        <table className="w-full">
                                          <thead className="bg-gray-50">
                                            <tr>
                                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                                                Description
                                              </th>
                                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                                                Amount
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            <tr className="border-b">
                                              <td className="py-4 px-4">Monthly Chit Installment</td>
                                              <td className="py-4 px-4 text-right font-semibold">
                                                ₹{selectedInvoice.amount.toLocaleString()}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      <div className="border-t pt-6">
                                        <div className="flex justify-between items-center mb-4">
                                          <span className="text-gray-600">Subtotal:</span>
                                          <span className="font-semibold">
                                            ₹{selectedInvoice.amount.toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xl font-bold">
                                          <span>Total Amount:</span>
                                          <span className="text-green-600">
                                            ₹{selectedInvoice.amount.toLocaleString()}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="border-t pt-6">
                                        <div className="flex justify-between items-center">
                                          <span className="text-gray-600">Due Date:</span>
                                          <span className="font-semibold text-orange-600">
                                            {selectedInvoice.dueDate}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                          <span className="text-gray-600">Status:</span>
                                          <Badge className={getStatusColor(selectedInvoice.status)}>
                                            {selectedInvoice.status}
                                          </Badge>
                                        </div>
                                      </div>

                                      <div className="pt-6 text-center border-t">
                                        <p className="text-xs text-gray-500">
                                          Thank you for your business! Please make payment by the due date.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-3">
                                    <Button variant="outline" className="rounded-xl bg-transparent">
                                      <Send className="w-4 h-4 mr-2" />
                                      Send Email
                                    </Button>
                                    <Button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl">
                                      <Download className="w-4 h-4 mr-2" />
                                      Download PDF
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="sm" className="rounded-xl">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="rounded-xl">
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
  )
}
