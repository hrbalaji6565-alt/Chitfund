"use client"

import { useState } from "react"
import { Users, Calendar, CheckCircle, XCircle, Info } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog"
import Button from "@/app/components/ui/button"

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

const groups: ChitGroup[] = [
  {
    id: 1,
    name: "Group A - Premium",
    chitValue: 100000,
    monthlyInstallment: 5000,
    totalMonths: 20,
    totalMembers: 20,
    startDate: "2024-01-01",
    endDate: "2025-08-01",
    status: "Active",
    remarks: "High value group for premium members",
    penaltyPercent: 2,
  },
  {
    id: 2,
    name: "Group B - Standard",
    chitValue: 50000,
    monthlyInstallment: 2500,
    totalMonths: 20,
    totalMembers: 20,
    startDate: "2024-02-01",
    endDate: "2025-09-01",
    status: "Active",
    remarks: "Standard group for regular members",
    penaltyPercent: 2,
  },
  {
    id: 3,
    name: "Group C - Elite",
    chitValue: 200000,
    monthlyInstallment: 10000,
    totalMonths: 20,
    totalMembers: 20,
    startDate: "2023-06-01",
    endDate: "2025-01-01",
    status: "Active",
    remarks: "Elite group with high returns",
    penaltyPercent: 2,
  },
  {
    id: 4,
    name: "Group D - Starter",
    chitValue: 25000,
    monthlyInstallment: 1250,
    totalMonths: 20,
    totalMembers: 20,
    startDate: "2023-01-01",
    endDate: "2024-08-01",
    status: "Closed",
    remarks: "Completed successfully",
    penaltyPercent: 2,
  },
]

export default function ChitFundsPage() {
  const [selectedGroup, setSelectedGroup] = useState<ChitGroup | null>(null)

  return (
    <div className="flex flex-col w-full h-full p-3 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6">
        <h1
          className="text-xl sm:text-2xl font-semibold leading-tight"
          style={{ color: "var(--color-primary)" }}
        >
          Chit Funds
        </h1>
        <p className="text-sm mt-1 sm:mt-0" style={{ color: "var(--text-secondary)" }}>
          Explore all available chit fund groups.
        </p>
      </div>

      {/* Grid layout */}
      <div
        className="grid gap-3 sm:gap-4 md:gap-6 
                   [@media(max-width:640px)]:grid-cols-2 
                   sm:grid-cols-2 md:grid-cols-3"
      >
        {groups.map((group) => (
          <Card
            key={group.id}
            className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-[var(--bg-card)] text-[var(--text-primary)]"
          >
            <CardHeader
              className="pb-3 pt-3"
              style={{
                background: "var(--bg-highlight)",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base mb-2 leading-snug">
                    {group.name}
                  </CardTitle>
                  <Badge
                    className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs"
                    style={{
                      background:
                        group.status === "Active"
                          ? "var(--color-secondary)"
                          : "var(--color-primary)",
                      color: "var(--text-light)",
                    }}
                  >
                    {group.status === "Active" ? (
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                    ) : (
                      <XCircle className="w-3 h-3 inline mr-1" />
                    )}
                    {group.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-3 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span style={{ color: "var(--text-secondary)" }}>Chit Value</span>
                <span className="font-semibold">
                  ₹{group.chitValue.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-xs sm:text-sm">
                <span style={{ color: "var(--text-secondary)" }}>
                  Monthly
                </span>
                <span className="font-semibold">
                  ₹{group.monthlyInstallment.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <Users className="w-3 h-3 text-[var(--color-primary)]" />
                <span style={{ color: "var(--text-secondary)" }}>
                  {group.totalMembers} Members
                </span>
              </div>

              <Button
                size="sm"
                className="mt-2 w-full text-xs py-1"
                style={{
                  background: "var(--color-primary)",
                  color: "var(--text-light)",
                }}
                onClick={() => setSelectedGroup(group)}
              >
                <Info className="w-3 h-3 mr-1" /> See Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-sm sm:max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Info className="w-5 h-5 text-[var(--color-primary)]" />
                  {selectedGroup.name}
                </DialogTitle>
                <DialogDescription style={{ color: "var(--text-secondary)" }}>
                  Complete chit group details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 mt-3 text-sm">
                <p>
                  <strong>Chit Value:</strong> ₹
                  {selectedGroup.chitValue.toLocaleString()}
                </p>
                <p>
                  <strong>Monthly Installment:</strong> ₹
                  {selectedGroup.monthlyInstallment.toLocaleString()}
                </p>
                <p>
                  <strong>Total Members:</strong> {selectedGroup.totalMembers}
                </p>
                <p>
                  <strong>Duration:</strong> {selectedGroup.totalMonths} Months
                </p>
                <p>
                  <strong>Start:</strong> {selectedGroup.startDate}
                </p>
                <p>
                  <strong>End:</strong> {selectedGroup.endDate}
                </p>
                <p>
                  <strong>Penalty:</strong> {selectedGroup.penaltyPercent || 0}%
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    style={{
                      color:
                        selectedGroup.status === "Active"
                          ? "var(--color-secondary)"
                          : "var(--color-primary)",
                    }}
                  >
                    {selectedGroup.status}
                  </span>
                </p>
                {selectedGroup.remarks && (
                  <p>
                    <strong>Remarks:</strong> {selectedGroup.remarks}
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedGroup(null)}
                  style={{
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
