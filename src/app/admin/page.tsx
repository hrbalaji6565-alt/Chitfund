"use client";

import { motion } from "framer-motion"
import { Users, Wallet, TrendingUp, Calendar, Award, IndianRupee } from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import Link from "next/link"
import Button from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"

const statsCards = [
  {
    title: "Total Chit Groups",
    value: "24",
    icon: Users,
    bgColor: "bg-[var(--bg-highlight)]",
    textColor: "text-[var(--color-primary)]",
  },
  {
    title: "Total Customers",
    value: "486",
    icon: Wallet,
    bgColor: "bg-[var(--bg-highlight)]",
    textColor: "text-[var(--color-secondary)]",
  },
  {
    title: "Pending Collections",
    value: "₹2,45,000",
    icon: TrendingUp,
    bgColor: "bg-[var(--bg-highlight)]",
    textColor: "text-[var(--color-accent)]",
  },
  {
    title: "Upcoming Auctions",
    value: "8",
    icon: Calendar,
    bgColor: "bg-[var(--bg-highlight)]",
    textColor: "text-[var(--color-primary)]",
  },
  {
    title: "Active Bids",
    value: "12",
    icon: Award,
    bgColor: "bg-[var(--bg-highlight)]",
    textColor: "text-[var(--color-secondary)]",
  },
  {
    title: "Total Revenue",
    value: "₹2,25,00,000",
    icon: TrendingUp,
    bgColor: "bg-[var(--bg-highlight)]",
    textColor: "text-[var(--color-accent)]",
  },
]

const recentActivity = [
  { id: 1, member: "Rajesh Kumar", group: "Group A", action: "Paid Installment", amount: "₹5,000", date: "2024-01-15" },
  { id: 2, member: "Priya Sharma", group: "Group B", action: "Won Bid", amount: "₹45,000", date: "2024-01-14" },
  { id: 3, member: "Amit Patel", group: "Group C", action: "Paid Installment", amount: "₹3,000", date: "2024-01-14" },
  { id: 4, member: "Sneha Reddy", group: "Group A", action: "Paid Installment", amount: "₹5,000", date: "2024-01-13" },
  { id: 5, member: "Vikram Singh", group: "Group D", action: "Won Bid", amount: "₹30,000", date: "2024-01-12" },
]

const monthlyCollectionData = [
  { month: "Jan", amount: 150000 },
  { month: "Feb", amount: 180000 },
  { month: "Mar", amount: 165000 },
  { month: "Apr", amount: 195000 },
  { month: "May", amount: 210000 },
  { month: "Jun", amount: 185000 },
  { month: "Jul", amount: 220000 },
  { month: "Aug", amount: 205000 },
  { month: "Sep", amount: 230000 },
  { month: "Oct", amount: 215000 },
  { month: "Nov", amount: 240000 },
  { month: "Dec", amount: 187500 },
]

const biddingSummaryData = [
  { group: "Group A", amount: 45000 },
  { group: "Group B", amount: 38000 },
  { group: "Group C", amount: 52000 },
  { group: "Group D", amount: 30000 },
  { group: "Group E", amount: 41000 },
  { group: "Group F", amount: 35000 },
]

export default function DashboardPage() {
  return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-1">{stat.title}</p>
                      <h3 className="text-3xl font-bold text-[var(--text-primary)]">{stat.value}</h3>
                    </div>
                    <div className={`${stat.bgColor} p-4 rounded-2xl`}>
                      <stat.icon className={`w-8 h-8 ${stat.textColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-[var(--text-primary)]">Monthly Collection Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyCollectionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} />
                      <YAxis stroke="var(--text-secondary)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-card)",
                          border: `1px solid var(--border-color)`,
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => `₹${value.toLocaleString()}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        dot={{ fill: "var(--color-primary)", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-[var(--text-primary)]">Bidding Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={biddingSummaryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="group" stroke="var(--text-secondary)" fontSize={12} />
                      <YAxis stroke="var(--text-secondary)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-card)",
                          border: `1px solid var(--border-color)`,
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => `₹${value.toLocaleString()}`}
                      />
                      <Bar dataKey="amount" fill="var(--color-secondary)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl text-[var(--text-primary)]">Recent Activity</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl bg-transparent text-[var(--color-primary)] border-[var(--border-color)]">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">Member</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">Group</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">Action</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((activity) => (
                      <motion.tr
                        key={activity.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.9 + activity.id * 0.05 }}
                        className="border-b border-[var(--border-color)] hover:bg-[var(--bg-highlight)] transition-colors"
                      >
                        <td className="py-3 px-4 text-sm font-medium text-[var(--text-primary)]">{activity.member}</td>
                        <td className="py-3 px-4 text-sm text-[var(--text-primary)]">{activity.group}</td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              activity.action === "Won Bid"
                                ? "bg-[var(--btn-secondary-bg)] text-[var(--text-light)]"
                                : "bg-[var(--btn-accent-bg)] text-[var(--text-light)]"
                            }`}
                          >
                            {activity.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">{activity.amount}</td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{activity.date}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <Card className="border-0 shadow-lg bg-[var(--bg-highlight)]">
            <CardHeader>
              <CardTitle className="text-xl text-[var(--text-primary)]">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/groups">
                  <Button variant="ghost" className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-6 h-6 text-[var(--color-primary)]" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Manage Groups</span>
                    </div>
                  </Button>
                </Link>
                <Link href="/subscribers">
                  <Button variant="ghost" className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <Wallet className="w-6 h-6 text-[var(--color-secondary)]" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Customers</span>
                    </div>
                  </Button>
                </Link>
                <Link href="/collections">
                  <Button variant="ghost" className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <IndianRupee className="w-6 h-6 text-[var(--color-accent)]" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Collections</span>
                    </div>
                  </Button>
                </Link>
                <Link href="/bidding">
                  <Button variant="ghost" className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <Award className="w-6 h-6 text-[var(--color-accent)]" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Bidding</span>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
  )
}
