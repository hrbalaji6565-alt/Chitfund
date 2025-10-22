"use client"

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
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
  },
  {
    title: "Total Customers",
    value: "486",
    icon: Wallet,
    color: "from-green-500 to-green-600",
    bgColor: "bg-green-50",
    textColor: "text-green-600",
  },
  {
    title: "Pending Collections",
    value: "₹2,45,000",
    icon: TrendingUp,
    color: "from-orange-500 to-orange-600",
    bgColor: "bg-orange-50",
    textColor: "text-orange-600",
  },
  {
    title: "Upcoming Auctions",
    value: "8",
    icon: Calendar,
    color: "from-purple-500 to-purple-600",
    bgColor: "bg-purple-50",
    textColor: "text-purple-600",
  },
  {
    title: "Active Bids",
    value: "12",
    icon: Award,
    color: "from-pink-500 to-pink-600",
    bgColor: "bg-pink-50",
    textColor: "text-pink-600",
  },
  {
    title: "Total Revenue",
    value: "₹2,25,00,000",
    icon: TrendingUp,
    color: "from-indigo-500 to-indigo-600",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-600",
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
      <div className="space-y-6 max-w-7xl mx-auto ">
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
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
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
                <CardTitle className="text-xl">Monthly Collection Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyCollectionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => `₹${value.toLocaleString()}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", r: 4 }}
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
                <CardTitle className="text-xl">Bidding Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={biddingSummaryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="group" stroke="#888" fontSize={12} />
                      <YAxis stroke="#888" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => `₹${value.toLocaleString()}`}
                      />
                      <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} />
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
              <CardTitle className="text-xl">Recent Activity</CardTitle>
              <Button variant="outline" size="sm" className="rounded-xl bg-transparent">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Member</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Group</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Action</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((activity) => (
                      <motion.tr
                        key={activity.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.9 + activity.id * 0.05 }}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm font-medium">{activity.member}</td>
                        <td className="py-3 px-4 text-sm">{activity.group}</td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              activity.action === "Won Bid"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {activity.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold">{activity.amount}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{activity.date}</td>
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
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-green-50">
            <CardHeader>
              <CardTitle className="text-xl">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/groups">
                  <Button variant="ghost" className="w-full h-20 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-6 h-6" />
                      <span className="text-sm font-semibold">Manage Groups</span>
                    </div>
                  </Button>
                </Link>
                <Link href="/subscribers">
                  <Button variant="ghost" className="w-full h-20 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <Wallet className="w-6 h-6" />
                      <span className="text-sm font-semibold">Customers</span>
                    </div>
                  </Button>
                </Link>
                <Link href="/collections">
                  <Button variant="ghost" className="w-full h-20 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <IndianRupee className="w-6 h-6" />
                      <span className="text-sm font-semibold">Collections</span>
                    </div>
                  </Button>
                </Link>
                <Link href="/bidding">
                  <Button variant="ghost" className="w-full h-20 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all">
                    <div className="flex flex-col items-center gap-2">
                      <Award className="w-6 h-6" />
                      <span className="text-sm font-semibold">Bidding</span>
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
