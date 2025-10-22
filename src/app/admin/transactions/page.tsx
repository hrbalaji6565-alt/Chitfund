"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Calendar, User, TrendingUp, IndianRupee } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";

interface Transaction {
  id: string;
  user: string;
  amount: number;
  date: string;
  paymentType: string;
  notes?: string;
}

// Reusable overview card
const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) => (
  <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm flex-1 min-w-[200px]">
    <CardContent className="flex items-center justify-between p-5">
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{title}</p>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{value}</h2>
      </div>
      <div className="p-3 rounded-lg bg-[var(--bg-highlight)]">
        <Icon className="text-[var(--color-primary)]" size={22} />
      </div>
    </CardContent>
  </Card>
);

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const mockData: Transaction[] = [
      { id: "1", user: "Rahul Sharma", amount: 1200, date: "2025-10-18", paymentType: "UPI", notes: "Monthly payment" },
      { id: "2", user: "Aman Verma", amount: 900, date: "2025-10-20", paymentType: "Cash", notes: "Advance" },
      { id: "3", user: "Priya Singh", amount: 1500, date: "2025-10-21", paymentType: "Bank Transfer", notes: "Full payment" },
      { id: "4", user: "Raj Patel", amount: 700, date: "2025-10-22", paymentType: "UPI" },
    ];
    setTransactions(mockData);
    setFiltered(mockData);
  }, []);

  const handleFilter = () => {
    let data = transactions;

    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (t) =>
          t.user.toLowerCase().includes(s) ||
          t.paymentType.toLowerCase().includes(s) ||
          (t.notes && t.notes.toLowerCase().includes(s))
      );
    }
    if (startDate) data = data.filter((t) => new Date(t.date) >= new Date(startDate));
    if (endDate) data = data.filter((t) => new Date(t.date) <= new Date(endDate));
    setFiltered(data);
  };

  // --- Overview Calculations ---
  const totals = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const month = new Date().getMonth();
    const year = new Date().getFullYear();

    const todayTotal = transactions
      .filter((t) => t.date === today)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthTotal = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    return { todayTotal, monthTotal, total };
  }, [transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="p-6 min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]"
    >
      <h1 className="text-2xl font-semibold mb-6 text-[var(--color-primary)]">Transactions</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Today's Total" value={`₹${totals.todayTotal}`} icon={Calendar} />
        <StatCard title="This Month's Total" value={`₹${totals.monthTotal}`} icon={TrendingUp} />
        <StatCard title="Overall Total" value={`₹${totals.total}`} icon={IndianRupee} />
      </div>

      {/* Filters */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] shadow-md mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-[var(--color-primary)]" size={18} />
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="text-[var(--color-primary)]" size={18} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="text-[var(--color-primary)]" size={18} />
            <Input
              placeholder="Search user, payment type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            onClick={handleFilter}
            className="bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--text-light)] transition-all"
          >
            Apply Filter
          </Button>
        </CardContent>
      </Card>

      {/* Transaction Table */}
      <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <CardContent className="overflow-x-auto">
          <motion.table layout className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-highlight)] text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                <th className="p-3 text-left font-medium">User</th>
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-left font-medium">Amount</th>
                <th className="p-3 text-left font-medium">Payment Type</th>
                <th className="p-3 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <motion.tbody layout>
              {filtered.length > 0 ? (
                filtered.map((t) => (
                  <motion.tr
                    key={t.id}
                    layout
                    whileHover={{ backgroundColor: "var(--bg-highlight)" }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-[var(--border-color)]"
                  >
                    <td className="p-3 flex items-center gap-2 text-[var(--text-primary)]">
                      <User size={16} className="text-[var(--color-secondary)]" />
                      {t.user}
                    </td>
                    <td className="p-3">{t.date}</td>
                    <td className="p-3">₹{t.amount}</td>
                    <td className="p-3">{t.paymentType}</td>
                    <td className="p-3 text-[var(--text-secondary)]">{t.notes || "-"}</td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-[var(--text-secondary)] p-6 italic">
                    No transactions found
                  </td>
                </tr>
              )}
            </motion.tbody>
          </motion.table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
