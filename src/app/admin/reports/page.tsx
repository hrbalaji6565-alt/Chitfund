"use client"

import Button from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { TrendingUp, Users, DollarSign, Award, Download, Calendar, IndianRupee } from "lucide-react"
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

// Sample data
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

const COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-accent)", "var(--color-accent-light)"]

export default function ReportsPage() {
  return (
    <div className="space-y-6" style={{ background: "var(--bg-main)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>Reports & Analytics</h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>Comprehensive insights into your chit fund operations</p>
        </div>
        <div className="flex gap-3">
          <Select defaultValue="6months">
            <SelectTrigger className="w-40 h-12 rounded-xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button style={{ background: "var(--gradient-primary)", color: "var(--text-light)", borderRadius: "1rem", height: "3rem" }}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  {[
    { title: "Total Revenue", value: "₹3.08L", icon: <IndianRupee className="w-8 h-8 " />, gradientFrom: "var(--color-primary)", gradientTo: "var(--color-secondary)" },
    { title: "Active Members", value: "248", icon: <Users className="w-8 h-8 " />, gradientFrom: "var(--color-secondary)", gradientTo: "var(--color-accent)" },
    { title: "Total Auctions", value: "31", icon: <Award className="w-8 h-8 " />, gradientFrom: "var(--color-accent)", gradientTo: "var(--color-accent-light)" },
    { title: "Collection Rate", value: "94%", icon: <Calendar className="w-8 h-8 " />, gradientFrom: "var(--color-accent-light)", gradientTo: "var(--color-accent)" },
  ].map((metric, idx) => (
    <Card
      key={idx}
      className="border-0 shadow-lg"
      style={{
        background: `linear-gradient(to bottom right, ${metric.gradientFrom}, ${metric.gradientTo})`,
      }}
    >
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm mb-1 text-white">{metric.title}</p>
          <h3 className="text-3xl font-bold text-white">{metric.value}</h3>
          <p className="text-xs mt-1 flex items-center gap-1 text-white">
            <TrendingUp className="w-3 h-3" /> +12.5%
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl">{metric.icon}</div>
      </CardContent>
    </Card>
  ))}
</div>


      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl" style={{ color: "var(--text-primary)" }}>Collection Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px", color: "var(--text-primary)" }} />
                <Legend />
                <Bar dataKey="collected" fill="var(--color-primary)" name="Collected" radius={[8,8,0,0]} />
                <Bar dataKey="pending" fill="var(--color-secondary)" name="Pending" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl" style={{ color: "var(--text-primary)" }}>Group Performance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={groupPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""}: ${((percent ?? 0)*100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="var(--color-accent)"
                  dataKey="value"
                >
                  {groupPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px", color: "var(--text-primary)" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl" style={{ color: "var(--text-primary)" }}>Auction Trends & Average Bid Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={auctionTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" stroke="var(--text-secondary)" />
              <YAxis yAxisId="left" stroke="var(--text-secondary)" />
              <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" />
              <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px", color: "var(--text-primary)" }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="auctions" stroke="var(--color-accent)" strokeWidth={3} name="Number of Auctions" dot={{ fill: "var(--color-accent)", r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="avgBid" stroke="var(--color-primary)" strokeWidth={3} name="Average Bid (₹)" dot={{ fill: "var(--color-primary)", r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-lg" style={{ background: "var(--bg-highlight)" }}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Top Performing Group</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Group Name:</span>
                <span style={{ color: "var(--color-primary)", fontWeight: "bold" }}>Group A - Premium</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Collection Rate:</span>
                <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>98%</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Total Members:</span>
                <span style={{ fontWeight: "bold" }}>65</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg" style={{ background: "var(--bg-highlight)" }}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Auction Winner</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Winner:</span>
                <span style={{ color: "var(--color-secondary)", fontWeight: "bold" }}>Priya Sharma</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Bid Amount:</span>
                <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>₹45,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Group:</span>
                <span style={{ fontWeight: "bold" }}>Group A</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg" style={{ background: "var(--bg-highlight)" }}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Pending Collections</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Total Pending:</span>
                <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>₹52,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Overdue:</span>
                <span style={{ color: "var(--color-secondary)", fontWeight: "bold" }}>₹12,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>Members:</span>
                <span style={{ fontWeight: "bold" }}>15</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
