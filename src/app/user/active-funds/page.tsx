"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, IndianRupee } from "lucide-react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Search } from "lucide-react"

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

// Example user funds
const userFunds: ChitFund[] = [
  {
    id: 1,
    fundName: "Premium Fund 2024",
    groupName: "Group A",
    totalAmount: 200000,
    collectedAmount: 150000,
    pendingAmount: 50000,
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
    groupName: "Group B",
    totalAmount: 100000,
    collectedAmount: 70000,
    pendingAmount: 30000,
    startDate: "2024-02-01",
    maturityDate: "2025-09-01",
    status: "Active",
    interestRate: 10,
    numberOfInstallments: 20,
    completedInstallments: 14,
  },
]

export default function UserActiveFunds() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredFunds = userFunds.filter(
    fund =>
      fund.fundName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalFunds = userFunds.reduce((sum, fund) => sum + fund.totalAmount, 0)
  const totalCollected = userFunds.reduce((sum, fund) => sum + fund.collectedAmount, 0)
  const totalPending = userFunds.reduce((sum, fund) => sum + fund.pendingAmount, 0)

  const getProgressPercentage = (fund: ChitFund) =>
    Math.min((fund.collectedAmount / fund.totalAmount) * 100, 100)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Completed":
        return "bg-blue-100 text-blue-800"
      case "Pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6 p-4 bg-[var(--bg-main)] min-h-screen">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="shadow-lg p-4 ">
          <CardContent>
            <p className="text-sm text-gray-500">Total Funds</p>
            <h3 className="text-2xl font-bold">₹{totalFunds.toLocaleString()}</h3>
          </CardContent>
        </Card>
        <Card className="shadow-lg p-4">
          <CardContent>
            <p className="text-sm text-gray-500">Collected Amount</p>
            <h3 className="text-2xl font-bold text-green-600">₹{totalCollected.toLocaleString()}</h3>
          </CardContent>
        </Card>
        <Card className="shadow-lg p-4">
          <CardContent>
            <p className="text-sm text-gray-500">Pending Amount</p>
            <h3 className="text-2xl font-bold text-red-600">₹{totalPending.toLocaleString()}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search funds or groups..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-10 h-12 rounded-lg"
        />
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
              <Card className="shadow-lg p-4">
                <CardContent>
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold">{fund.fundName}</h3>
                        <Badge className={getStatusColor(fund.status)}>{fund.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">{fund.groupName}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        <div>
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="font-semibold">₹{fund.totalAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Collected</p>
                          <p className="font-semibold text-green-600">₹{fund.collectedAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pending</p>
                          <p className="font-semibold text-red-600">₹{fund.pendingAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Interest</p>
                          <p className="font-semibold">{fund.interestRate}%</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mt-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Progress</span>
                          <span className="font-semibold">{getProgressPercentage(fund).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${getProgressPercentage(fund)}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                            className="h-full bg-green-500 rounded-full"
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{fund.startDate} - {fund.maturityDate}</span>
                        </div>
                        <div>
                          {fund.completedInstallments}/{fund.numberOfInstallments} Installments
                        </div>
                      </div>
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
