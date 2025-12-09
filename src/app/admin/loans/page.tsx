// src/app/admin/loans/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchMembers } from "@/store/memberSlice";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/app/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

type MemberOption = { id: string; name: string };

type LoanRow = {
  _id: string;
  memberId: string;
  principal: number;
  monthlyInterestRate: number;
  tenureMonths: number;
  dueDayOfMonth: number;
  penaltyRate: number;
  installmentAmount: number;
  status: string;
};

type ScheduleItem = {
  monthIndex: number;
  dueDate: string;
  baseAmount: number;
  interestAmount: number;
  emiAmount: number;
};

type PaymentRow = {
  _id: string;
  monthIndex: number;
  penaltyAmount: number;
  totalDue: number;
  paidAmount: number;
  utr?: string;
  status: string;
};

export default function AdminLoansPage() {
  const dispatch = useDispatch<AppDispatch>();

  const membersFromStore = useSelector((s: RootState) => {
    const slice = (s as unknown as Record<string, unknown>)[
      "members"
    ] as Record<string, unknown> | undefined;

    const arr = Array.isArray(slice?.list)
      ? slice?.list
      : Array.isArray(slice?.items)
      ? slice?.items
      : Array.isArray(slice?.members)
      ? slice?.members
      : [];

    return (arr as unknown[]).map((it) => {
      if (
        typeof it === "object" &&
        it !== null &&
        !Array.isArray(it)
      ) {
        const rec = it as Record<string, unknown>;
        const id = String(rec._id ?? rec.id ?? "");
        const name =
          typeof rec.name === "string" ? rec.name : id;
        return { id, name };
      }
      const id = String(it ?? "");
      return { id, name: id };
    });
  });

  useEffect(() => {
    if (!membersFromStore.length) dispatch(fetchMembers());
  }, [dispatch, membersFromStore.length]);

  const memberOptions: MemberOption[] = useMemo(
    () =>
      membersFromStore.map((m) => ({
        id: m.id,
        name: m.name,
      })),
    [membersFromStore],
  );

  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [formMemberId, setFormMemberId] = useState("");
  const [formPrincipal, setFormPrincipal] = useState("");
  const [formInterest, setFormInterest] = useState("10");
  const [formTenure, setFormTenure] = useState("12");
  const [formDueDay, setFormDueDay] = useState("10");
  const [formPenalty, setFormPenalty] = useState("5");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedLoan, setSelectedLoan] =
    useState<LoanRow | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<
    ScheduleItem[]
  >([]);
  const [detailPayments, setDetailPayments] = useState<
    PaymentRow[]
  >([]);

  const loadLoans = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/loans", {
      credentials: "include",
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) {
      toast.error(data.error || "Failed to load loans");
      return;
    }
    setLoans(data.loans as LoanRow[]);
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const handleCreate = async () => {
    const principal = Number(formPrincipal);
    const monthlyInterestRate = Number(formInterest);
    const tenureMonths = Number(formTenure);
    const dueDayOfMonth = Number(formDueDay);
    const penaltyRate = Number(formPenalty);

    if (!formMemberId || principal <= 0 || tenureMonths <= 0) {
      toast.error("Member, principal & tenure required");
      return;
    }

    const body = {
      memberId: formMemberId,
      principal,
      monthlyInterestRate,
      tenureMonths,
      dueDayOfMonth,
      penaltyRate,
    };

    const res = await fetch("/api/admin/loans", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(data.error || "Failed to create loan");
      return;
    }
    toast.success("Loan created");
    setCreateOpen(false);
    loadLoans();
  };

  const memberName = (memberId: string) =>
    memberOptions.find((m) => m.id === memberId)?.name ??
    memberId;

  const openDetails = async (loan: LoanRow) => {
    setSelectedLoan(loan);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailSchedule([]);
    setDetailPayments([]);

    const res = await fetch(
      `/api/admin/loans?id=${encodeURIComponent(loan._id)}`,
      {
        credentials: "include",
      },
    );
    const data = await res.json();
    setDetailLoading(false);
    if (!data.success) {
      toast.error(data.error || "Failed to load loan");
      return;
    }
    const sched = (data.schedule as ScheduleItem[]).map(
      (s) => ({
        ...s,
        dueDate: new Date(s.dueDate).toISOString(),
      }),
    );
    setDetailSchedule(sched);
    setDetailPayments(data.payments as PaymentRow[]);
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setSelectedLoan(null);
    setDetailSchedule([]);
    setDetailPayments([]);
  };

  const fmtCurrency = (n: number) =>
    `₹${n.toLocaleString("en-IN")}`;

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Loans</h1>
        <Button
          className="rounded-xl"
          onClick={() => setCreateOpen(true)}
        >
          Create Loan
        </Button>
      </div>

      <Card className="shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">
            All Loans
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="text-sm text-gray-500 mb-2">
              Loading loans…
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left">Member</th>
                  <th className="py-2 px-3 text-left">Principal</th>
                  <th className="py-2 px-3 text-left">
                    Interest / month
                  </th>
                  <th className="py-2 px-3 text-left">Tenure</th>
                  <th className="py-2 px-3 text-left">EMI</th>
                  <th className="py-2 px-3 text-left">
                    Penalty / month
                  </th>
                  <th className="py-2 px-3 text-left">Status</th>
                  <th className="py-2 px-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {loans.map((loan, idx) => (
                    <motion.tr
                      key={loan._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-t hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-3">
                        {memberName(loan.memberId)}
                      </td>
                      <td className="py-2 px-3">
                        {fmtCurrency(loan.principal)}
                      </td>
                      <td className="py-2 px-3">
                        {loan.monthlyInterestRate}%
                      </td>
                      <td className="py-2 px-3">
                        {loan.tenureMonths} months
                      </td>
                      <td className="py-2 px-3">
                        {fmtCurrency(loan.installmentAmount)}
                      </td>
                      <td className="py-2 px-3">
                        {loan.penaltyRate}%
                      </td>
                      <td className="py-2 px-3">
                        {loan.status}
                      </td>
                      <td className="py-2 px-3">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          onClick={() => openDetails(loan)}
                        >
                          View
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {loans.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-4 text-center text-sm text-gray-500"
                    >
                      No loans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CREATE LOAN DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Loan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1">Member</p>
              <Select
                value={formMemberId}
                onValueChange={setFormMemberId}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {memberOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-1">Loan amount (Principal)</p>
              <Input
                type="number"
                value={formPrincipal}
                onChange={(e) =>
                  setFormPrincipal(e.target.value)
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1">Interest / month (%)</p>
                <Input
                  type="number"
                  value={formInterest}
                  onChange={(e) =>
                    setFormInterest(e.target.value)
                  }
                />
              </div>
              <div>
                <p className="mb-1">Tenure (months)</p>
                <Input
                  type="number"
                  value={formTenure}
                  onChange={(e) =>
                    setFormTenure(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1">Due date (day of month)</p>
                <Input
                  type="number"
                  value={formDueDay}
                  onChange={(e) =>
                    setFormDueDay(e.target.value)
                  }
                />
              </div>
              <div>
                <p className="mb-1">Penalty / month (%)</p>
                <Input
                  type="number"
                  value={formPenalty}
                  onChange={(e) =>
                    setFormPenalty(e.target.value)
                  }
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAILS MODAL */}
      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          if (!o) closeDetails();
          else setDetailOpen(o);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
          </DialogHeader>

          {detailLoading || !selectedLoan ? (
            <p className="text-sm text-gray-500">
              Loading details…
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border p-3 bg-gray-50">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <div className="text-xs text-gray-500">
                      Member
                    </div>
                    <div className="font-semibold">
                      {memberName(selectedLoan.memberId)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      Principal
                    </div>
                    <div className="font-semibold">
                      {fmtCurrency(selectedLoan.principal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      EMI (every month)
                    </div>
                    <div className="font-semibold">
                      {fmtCurrency(
                        selectedLoan.installmentAmount,
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      Interest / month
                    </div>
                    <div className="font-semibold">
                      {selectedLoan.monthlyInterestRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      Tenure
                    </div>
                    <div className="font-semibold">
                      {selectedLoan.tenureMonths} months
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      Due by every month
                    </div>
                    <div className="font-semibold">
                      Day {selectedLoan.dueDayOfMonth}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">
                      Status
                    </div>
                    <div className="font-semibold">
                      {selectedLoan.status}
                    </div>
                  </div>
                </div>
              </div>

              <Card className="shadow-sm border">
                <CardHeader>
                  <CardTitle className="text-base">
                    Installment Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-2 text-left">
                          Month
                        </th>
                        <th className="py-2 px-2 text-left">
                          Due Date
                        </th>
                        <th className="py-2 px-2 text-left">
                          Base
                        </th>
                        <th className="py-2 px-2 text-left">
                          Interest
                        </th>
                        <th className="py-2 px-2 text-left">
                          EMI
                        </th>
                        <th className="py-2 px-2 text-left">
                          Paid
                        </th>
                        <th className="py-2 px-2 text-left">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailSchedule.map((s) => {
                        const p = detailPayments.find(
                          (pp) =>
                            pp.monthIndex === s.monthIndex,
                        );
                        const d = new Date(s.dueDate);
                        return (
                          <tr
                            key={s.monthIndex}
                            className="border-t hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 px-2">
                              #{s.monthIndex}
                            </td>
                            <td className="py-2 px-2">
                              {d.toLocaleDateString("en-IN")}
                            </td>
                            <td className="py-2 px-2">
                              {fmtCurrency(s.baseAmount)}
                            </td>
                            <td className="py-2 px-2">
                              {fmtCurrency(
                                s.interestAmount,
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {fmtCurrency(s.emiAmount)}
                            </td>
                            <td className="py-2 px-2">
                              {p?.paidAmount
                                ? fmtCurrency(
                                    p.paidAmount,
                                  )
                                : "-"}
                            </td>
                            <td className="py-2 px-2">
                              {p?.status ?? "pending"}
                            </td>
                          </tr>
                        );
                      })}
                      {detailSchedule.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-3 text-center text-xs text-gray-500"
                          >
                            No schedule.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
