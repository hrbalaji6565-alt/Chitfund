"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Search, X } from "lucide-react"

interface Transaction {
  id: number
  date: string
  amount: number
  method: "Bank" | "UPI" | "UPI + Cash" | "Cash"
  status: "Success" | "Pending" | "Failed"
  remarks?: string
}

const initialTransactions: Transaction[] = [
  { id: 1, date: "2025-10-01", amount: 5000, method: "UPI", status: "Success", remarks: "Monthly installment" },
  { id: 2, date: "2025-10-05", amount: 2000, method: "Bank", status: "Pending" },
  { id: 3, date: "2025-10-10", amount: 3000, method: "UPI + Cash", status: "Success", remarks: "Extra contribution" },
  { id: 4, date: "2025-10-12", amount: 1500, method: "Cash", status: "Failed" },
]

export default function UserTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTransactions = transactions.filter(
    t =>
      t.method.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.amount.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.remarks && t.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Success": return "bg-green-100 text-green-800"
      case "Pending": return "bg-yellow-100 text-yellow-800"
      case "Failed": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const clearSearch = () => setSearchTerm("")

  return (
    <div className="space-y-6 p-4 bg-[var(--bg-main)] min-h-screen">
      <h2 className="text-2xl font-bold text-[var(--color-primary)]">Your Transactions</h2>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search by amount, method or remarks..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 pr-10 h-12 rounded-lg"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <table className="w-full text-left border-collapse bg-[var(--bg-card)] rounded-lg overflow-hidden shadow-lg">
          <thead className="bg-[var(--color-primary)] text-white">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(tx => (
              <tr key={tx.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{tx.date}</td>
                <td className="px-4 py-3">₹{tx.amount.toLocaleString()}</td>
                <td className="px-4 py-3">{tx.method}</td>
                <td className="px-4 py-3">
                  <Badge className={getStatusColor(tx.status)}>{tx.status}</Badge>
                </td>
                <td className="px-4 py-3">{tx.remarks || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        <AnimatePresence>
          {filteredTransactions.map((tx, index) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Card className="shadow-lg p-4">
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <p className="text-lg font-semibold text-[var(--color-primary)]">
                        ₹{tx.amount.toLocaleString()}
                      </p>
                      <Badge className={getStatusColor(tx.status)}>{tx.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">Date: {tx.date}</p>
                    <p className="text-sm text-gray-500">Method: {tx.method}</p>
                    {tx.remarks && <p className="text-sm text-gray-500">Remarks: {tx.remarks}</p>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredTransactions.length === 0 && (
          <p className="text-center text-gray-500 mt-4">No transactions found</p>
        )}
      </div>
    </div>
  )
}
