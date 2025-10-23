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
  { id: 1, invoiceNo: "INV-2024-001", memberName: "Rajesh Kumar", groupName: "Group A - Premium", amount: 5000, dueDate: "2024-02-15", status: "Paid", generatedDate: "2024-01-15" },
  { id: 2, invoiceNo: "INV-2024-002", memberName: "Sneha Reddy", groupName: "Group A - Premium", amount: 5000, dueDate: "2024-02-15", status: "Pending", generatedDate: "2024-01-15" },
  { id: 3, invoiceNo: "INV-2024-003", memberName: "Arjun Mehta", groupName: "Group B - Standard", amount: 2500, dueDate: "2024-01-20", status: "Overdue", generatedDate: "2024-01-10" },
  { id: 4, invoiceNo: "INV-2024-004", memberName: "Priya Sharma", groupName: "Group C - Elite", amount: 10000, dueDate: "2024-02-20", status: "Pending", generatedDate: "2024-01-20" },
]

const members = ["Rajesh Kumar", "Priya Sharma", "Amit Patel", "Sneha Reddy", "Vikram Singh", "Kavita Singh", "Arjun Mehta", "Rahul Verma"]
const groups = ["Group A - Premium", "Group B - Standard", "Group C - Elite", "Group D - Starter"]

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [newInvoice, setNewInvoice] = useState({ memberName: "", groupName: "", amount: 0, dueDate: "" })

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
      case "Paid": return "var(--badge-paid-bg) var(--badge-paid-text)"
      case "Pending": return "var(--badge-pending-bg) var(--badge-pending-text)"
      case "Overdue": return "var(--badge-overdue-bg) var(--badge-overdue-text)"
      default: return "var(--badge-default-bg) var(--badge-default-text)"
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Invoices", value: invoices.length, bg: "var(--card-bg)", text: "var(--text-primary)", iconColor: "var(--text-accent)" },
          { label: "Paid", value: paidInvoices.length, bg: "var(--paid-bg)", text: "var(--paid-text)", iconColor: "var(--paid-text)" },
          { label: "Pending", value: pendingInvoices.length, bg: "var(--pending-bg)", text: "var(--pending-text)", iconColor: "var(--pending-text)" },
          { label: "Overdue", value: overdueInvoices.length, bg: "var(--overdue-bg)", text: "var(--overdue-text)", iconColor: "var(--overdue-text)" },
        ].map((card, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1, duration: 0.3 }}>
            <Card style={{ background: card.bg, borderColor: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p style={{ color: card.text }} className="text-sm mb-1">{card.label}</p>
                  <h3 style={{ color: card.text }} className="text-3xl font-bold">{card.value}</h3>
                </div>
                <div style={{ background: "var(--badge-bg)" }} className="p-4 rounded-2xl">
                  <FileText className="w-8 h-8" style={{ color: card.iconColor }} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Invoice Table */}
      <Card style={{ background: "var(--card-bg)", borderColor: "var(--card-border)", boxShadow: "var(--card-shadow)" }}>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle style={{ color: "var(--text-primary)" }}>Invoice Management</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 rounded-xl w-full sm:w-64"
              />
            </div>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button variant="default" style={{  color: "var(--btn-text)" }} className="h-12 rounded-xl">
                  <Plus className="w-4 h-4 mr-2" /> Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl " style={{ background: "var(--dialog-bg)", color: "var(--text-primary)" }}>
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4 bg-white h-full p-4">
                  <div className="space-y-2">
                    <Label>Select Member</Label>
                    <Select value={newInvoice.memberName} onValueChange={(value) => setNewInvoice({ ...newInvoice, memberName: value })}>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Choose member" /></SelectTrigger>
                      <SelectContent>{members.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Select Group</Label>
                    <Select value={newInvoice.groupName} onValueChange={(value) => setNewInvoice({ ...newInvoice, groupName: value })}>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Choose group" /></SelectTrigger>
                      <SelectContent>{groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (₹)</Label>
                    <Input type="number" value={newInvoice.amount || ""} onChange={e => setNewInvoice({...newInvoice, amount: Number(e.target.value)})} className="h-12 rounded-xl"/>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice({...newInvoice, dueDate: e.target.value})} className="h-12 rounded-xl"/>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="default" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                    <Button variant="default" disabled={!newInvoice.memberName || !newInvoice.groupName || !newInvoice.amount || !newInvoice.dueDate}>Create Invoice</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: "var(--table-header-bg)", color: "var(--text-primary)" }}>
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Invoice No.</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Member Name</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Group</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Amount</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Due Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice, index) => (
                  <motion.tr key={invoice.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }} style={{ borderBottom: "1px solid var(--table-border)" }}>
                    <td className="py-4 px-6" style={{ color: "var(--text-primary)" }}>{invoice.invoiceNo}</td>
                    <td className="py-4 px-6">{invoice.memberName}</td>
                    <td className="py-4 px-6">{invoice.groupName}</td>
                    <td className="py-4 px-6 font-semibold">₹{invoice.amount.toLocaleString()}</td>
                    <td className="py-4 px-6">{invoice.dueDate}</td>
                    <td className="py-4 px-6"><Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge></td>
                    <td className="py-4 px-6 flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setSelectedInvoice(invoice)}><Eye className="w-4 h-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl" style={{ background: "var(--dialog-bg)", color: "var(--text-primary)" }}>
                          <DialogHeader><DialogTitle>Invoice Details</DialogTitle></DialogHeader>
                          {selectedInvoice && (
                            <div className="space-y-6 py-4 bg-white h-full rounded-2xl">
                              <div className="bg-gradient-to-br from-var(--card-bg) to-var(--btn-primary-bg) p-8 rounded-2xl">
                                <div className="text-center mb-8">
                                  <h2 className="text-3xl font-bold">ChitFund Pro</h2>
                                  <p className="text-sm text-gray-600">Invoice</p>
                                </div>
                                <div className="bg-var(--card-bg) p-8 rounded-xl space-y-6">
                                  <div className="grid grid-cols-2 gap-6">
                                    <div>
                                      <p className="text-sm text-gray-600 mb-1">Invoice Number</p>
                                      <p className="text-lg font-bold">{selectedInvoice.invoiceNo}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-600 mb-1">Generated Date</p>
                                      <p className="text-lg font-semibold">{selectedInvoice.generatedDate}</p>
                                    </div>
                                  </div>
                                  <div className="border-t pt-6">
                                    <p className="text-sm text-gray-600 mb-2">Bill To:</p>
                                    <p className="text-xl font-bold">{selectedInvoice.memberName}</p>
                                    <p className="text-sm text-gray-600">{selectedInvoice.groupName}</p>
                                  </div>
                                  <div className="border-t pt-6">
                                    <table className="w-full">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="text-left py-3 px-4 text-sm font-semibold">Description</th>
                                          <th className="text-right py-3 px-4 text-sm font-semibold">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr className="border-b">
                                          <td className="py-4 px-4">Monthly Chit Installment</td>
                                          <td className="py-4 px-4 text-right font-semibold">₹{selectedInvoice.amount.toLocaleString()}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="border-t pt-6 flex justify-between items-center font-bold">
                                    <span>Total Amount:</span>
                                    <span>₹{selectedInvoice.amount.toLocaleString()}</span>
                                  </div>
                                  <div className="border-t pt-6 flex justify-between items-center">
                                    <span>Due Date:</span>
                                    <span>{selectedInvoice.dueDate}</span>
                                  </div>
                                  <div className="border-t pt-6 flex justify-between items-center">
                                    <span>Status:</span>
                                    <Badge className={getStatusColor(selectedInvoice.status)}>{selectedInvoice.status}</Badge>
                                  </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                  <Button variant="outline" className="rounded-xl"><Send className="w-4 h-4 mr-2" /> Send Email</Button>
                                  <Button className="bg-var(--btn-primary-bg) text-var(--btn-text) rounded-xl"><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm" className="rounded-xl"><Download className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="rounded-xl"><Send className="w-4 h-4" /></Button>
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
