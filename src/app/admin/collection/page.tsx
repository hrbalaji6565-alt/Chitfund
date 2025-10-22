"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { DollarSign, Download, CheckCircle, XCircle, Calendar, Badge } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import Button from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"

interface Payment {
  id: number
  memberName: string
  installmentNo: number
  amount: number
  paid: boolean
  dateOfPayment: string
  modeOfPayment: string
}

const initialPayments: Record<string, Payment[]> = {
  "Group A - Premium": [
    {
      id: 1,
      memberName: "Rajesh Kumar",
      installmentNo: 10,
      amount: 5000,
      paid: true,
      dateOfPayment: "2024-01-15",
      modeOfPayment: "UPI",
    },
    {
      id: 2,
      memberName: "Sneha Reddy",
      installmentNo: 10,
      amount: 5000,
      paid: true,
      dateOfPayment: "2024-01-14",
      modeOfPayment: "Bank Transfer",
    },
    {
      id: 3,
      memberName: "Arjun Mehta",
      installmentNo: 10,
      amount: 5000,
      paid: false,
      dateOfPayment: "",
      modeOfPayment: "",
    },
    {
      id: 4,
      memberName: "Kavita Singh",
      installmentNo: 10,
      amount: 5000,
      paid: false,
      dateOfPayment: "",
      modeOfPayment: "",
    },
  ],
  "Group B - Standard": [
    {
      id: 5,
      memberName: "Priya Sharma",
      installmentNo: 10,
      amount: 2500,
      paid: true,
      dateOfPayment: "2024-01-14",
      modeOfPayment: "Cash",
    },
    {
      id: 6,
      memberName: "Rahul Verma",
      installmentNo: 10,
      amount: 2500,
      paid: false,
      dateOfPayment: "",
      modeOfPayment: "",
    },
  ],
}

export default function CollectionsPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>("Group A - Premium")
  const [payments, setPayments] = useState<Record<string, Payment[]>>(initialPayments)
  const [receiptData, setReceiptData] = useState<Payment | null>(null)

  const currentPayments = payments[selectedGroup] || []
  const totalCollected = currentPayments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0)
  const totalPending = currentPayments.filter((p) => !p.paid).reduce((sum, p) => sum + p.amount, 0)

  const togglePaymentStatus = (id: number) => {
    setPayments({
      ...payments,
      [selectedGroup]: currentPayments.map((p) =>
        p.id === id
          ? {
              ...p,
              paid: !p.paid,
              dateOfPayment: !p.paid ? new Date().toISOString().split("T")[0] : "",
              modeOfPayment: !p.paid ? "Cash" : "",
            }
          : p,
      ),
    })
  }

  const updatePaymentDetails = (id: number, field: string, value: string) => {
    setPayments({
      ...payments,
      [selectedGroup]: currentPayments.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    })
  }

  return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 mb-1">Total Collected</p>
                    <h3 className="text-3xl font-bold text-green-800">₹{totalCollected.toLocaleString()}</h3>
                  </div>
                  <div className="bg-green-200 p-4 rounded-2xl">
                    <CheckCircle className="w-8 h-8 text-green-700" />
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
            <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700 mb-1">Total Pending</p>
                    <h3 className="text-3xl font-bold text-orange-800">₹{totalPending.toLocaleString()}</h3>
                  </div>
                  <div className="bg-orange-200 p-4 rounded-2xl">
                    <XCircle className="w-8 h-8 text-orange-700" />
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
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-700 mb-1">Collection Rate</p>
                    <h3 className="text-3xl font-bold text-blue-800">
                      {currentPayments.length > 0
                        ? Math.round((currentPayments.filter((p) => p.paid).length / currentPayments.length) * 100)
                        : 0}
                      %
                    </h3>
                  </div>
                  <div className="bg-blue-200 p-4 rounded-2xl">
                    <DollarSign className="w-8 h-8 text-blue-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Group Selection */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl">Monthly Collection Management</CardTitle>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-full sm:w-64 h-12 rounded-xl">
                  <SelectValue placeholder="Select Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Group A - Premium">Group A - Premium</SelectItem>
                  <SelectItem value="Group B - Standard">Group B - Standard</SelectItem>
                  <SelectItem value="Group C - Elite">Group C - Elite</SelectItem>
                  <SelectItem value="Group D - Starter">Group D - Starter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-green-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Member Name</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Installment No.</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Date of Payment</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Mode</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPayments.map((payment, index) => (
                    <motion.tr
                      key={payment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-6 font-medium">{payment.memberName}</td>
                      <td className="py-4 px-6">{payment.installmentNo}</td>
                      <td className="py-4 px-6 font-semibold">₹{payment.amount.toLocaleString()}</td>
                      <td className="py-4 px-6">
                        <Button
                            variant="ghost"
                          onClick={() => togglePaymentStatus(payment.id)}
                          className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                        >
                          <Badge
                            // variant={payment.paid ? "default" : "secondary"}
                            className={
                              payment.paid
                                ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                                : "bg-orange-100 text-orange-700 hover:bg-orange-200 cursor-pointer"
                            }
                          >
                            {payment.paid ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Paid
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                Unpaid
                              </>
                            )}
                          </Badge>
                        </Button>
                      </td>
                      <td className="py-4 px-6">
                        {payment.paid ? (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <Input
                              type="date"
                              value={payment.dateOfPayment}
                              onChange={(e) => updatePaymentDetails(payment.id, "dateOfPayment", e.target.value)}
                              className="h-8 w-36 text-xs"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {payment.paid ? (
                          <Select
                            value={payment.modeOfPayment}
                            onValueChange={(value) => updatePaymentDetails(payment.id, "modeOfPayment", value)}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                              <SelectItem value="UPI">UPI</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {payment.paid && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl bg-transparent"
                                onClick={() => setReceiptData(payment)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Receipt
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Payment Receipt</DialogTitle>
                              </DialogHeader>
                              {receiptData && (
                                <div className="space-y-6 py-4">
                                  <div className="bg-gradient-to-br from-blue-50 to-green-50 p-6 rounded-2xl">
                                    <div className="text-center mb-6">
                                      <h2 className="text-2xl font-bold text-gray-800">ChitFund Pro</h2>
                                      <p className="text-sm text-gray-600">Payment Receipt</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl space-y-4">
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Receipt No:</span>
                                        <span className="font-semibold">
                                          RCP-{receiptData.id.toString().padStart(6, "0")}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Member Name:</span>
                                        <span className="font-semibold">{receiptData.memberName}</span>
                                      </div>
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Group:</span>
                                        <span className="font-semibold">{selectedGroup}</span>
                                      </div>
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Installment No:</span>
                                        <span className="font-semibold">{receiptData.installmentNo}</span>
                                      </div>
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Amount Paid:</span>
                                        <span className="font-semibold text-green-600 text-lg">
                                          ₹{receiptData.amount.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Payment Date:</span>
                                        <span className="font-semibold">{receiptData.dateOfPayment}</span>
                                      </div>
                                      <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-600">Payment Mode:</span>
                                        <span className="font-semibold">{receiptData.modeOfPayment}</span>
                                      </div>
                                      <div className="pt-4 text-center">
                                        <p className="text-xs text-gray-500">
                                          This is a computer-generated receipt and does not require a signature.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-3">
                                    <Button variant="outline">Print Receipt</Button>
                                    <Button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white">
                                      Download PDF
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        )}
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
