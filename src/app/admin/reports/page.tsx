"use client"

import Button from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { TrendingUp, Users, DollarSign, Award, Download, Calendar } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const collectionData = [
  { month: "Jan", collected: 45000, pending: 15000 },
  { month: "Feb", collected: 52000, pending: 8000 },
  { month: "Mar", collected: 48000, pending: 12000 },
  { month: "Apr", collected: 55000, pending: 5000 },
  { month: "May", collected: 50000, pending: 10000 },
  { month: "Jun", collected: 58000, pending: 2000 },
]

const groupPerformance = [
  { name: "Group A", value: 35 },
  { name: "Group B", value: 25 },
  { name: "Group C", value: 20 },
  { name: "Group D", value: 20 },
]

const auctionTrends = [
  { month: "Jan", auctions: 4, avgBid: 42000 },
  { month: "Feb", auctions: 5, avgBid: 45000 },
  { month: "Mar", auctions: 4, avgBid: 43000 },
  { month: "Apr", auctions: 6, avgBid: 47000 },
  { month: "May", auctions: 5, avgBid: 46000 },
  { month: "Jun", auctions: 7, avgBid: 48000 },
]

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"]

export default function ReportsPage() {
  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
            <p className="text-gray-600 mt-1">Comprehensive insights into your chit fund operations</p>
          </div>
          <div className="flex gap-3">
            <Select defaultValue="6months">
              <SelectTrigger className="w-40 h-12 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white rounded-xl h-12">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 mb-1">Total Revenue</p>
                  <h3 className="text-3xl font-bold text-blue-800">₹3.08L</h3>
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +12.5% from last period
                  </p>
                </div>
                <div className="bg-blue-200 p-4 rounded-2xl">
                  <DollarSign className="w-8 h-8 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </div>

          <div className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 mb-1">Active Members</p>
                  <h3 className="text-3xl font-bold text-green-800">248</h3>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +8 new this month
                  </p>
                </div>
                <div className="bg-green-200 p-4 rounded-2xl">
                  <Users className="w-8 h-8 text-green-700" />
                </div>
              </div>
            </CardContent>
          </div>

          <div className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-700 mb-1">Total Auctions</p>
                  <h3 className="text-3xl font-bold text-purple-800">31</h3>
                  <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                    <Award className="w-3 h-3" />7 this month
                  </p>
                </div>
                <div className="bg-purple-200 p-4 rounded-2xl">
                  <Award className="w-8 h-8 text-purple-700" />
                </div>
              </div>
            </CardContent>
          </div>

          <div className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700 mb-1">Collection Rate</p>
                  <h3 className="text-3xl font-bold text-orange-800">94%</h3>
                  <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +3% improvement
                  </p>
                </div>
                <div className="bg-orange-200 p-4 rounded-2xl">
                  <Calendar className="w-8 h-8 text-orange-700" />
                </div>
              </div>
            </CardContent>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Collection Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={collectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="collected" fill="#10b981" name="Collected" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </div>

          <div className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Group Performance Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                  <Pie
                    data={groupPerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {groupPerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Auction Trends & Average Bid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={auctionTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis yAxisId="left" stroke="#6b7280" />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "12px",
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="auctions"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="Number of Auctions"
                  dot={{ fill: "#8b5cf6", r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgBid"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  name="Average Bid (₹)"
                  dot={{ fill: "#3b82f6", r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-green-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Performing Group</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Group Name:</span>
                  <span className="font-bold text-blue-600">Group A - Premium</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Collection Rate:</span>
                  <span className="font-bold text-green-600">98%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Members:</span>
                  <span className="font-bold">65</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Auction Winner</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Winner:</span>
                  <span className="font-bold text-purple-600">Priya Sharma</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bid Amount:</span>
                  <span className="font-bold text-green-600">₹45,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Group:</span>
                  <span className="font-bold">Group A</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-yellow-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Collections</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Pending:</span>
                  <span className="font-bold text-orange-600">₹52,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Overdue:</span>
                  <span className="font-bold text-red-600">₹12,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Members:</span>
                  <span className="font-bold">15</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
