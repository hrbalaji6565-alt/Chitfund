"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Wallet,
  TrendingUp,
  Calendar,
  Award,
  IndianRupee,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import Button from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchGroups } from "@/store/chitGroupSlice";
import { fetchMembers } from "@/store/memberSlice";

type UnknownRecord = Record<string, unknown>;

type MonthlyPoint = { month: string; amount: number };
type BiddingSummaryItem = { group: string; amount: number };
type RecentActivityItem = {
  id: string;
  member: string;
  group: string;
  action: string;
  amount: number;
  date?: string;
};

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toStr = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v);

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const extractArray = (obj: unknown, keys: string[]): unknown[] => {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (isRecord(obj)) {
    for (const key of keys) {
      const value = obj[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
};

export default function DashboardPage() {
  const dispatch = useDispatch<AppDispatch>();

  // groups list
  const chitGroupsSlice = useSelector(
    (s: RootState) =>
      (s as unknown as Record<string, unknown>)["chitGroups"] as
        | Record<string, unknown>
        | undefined,
  );

  const groups = useMemo(() => {
    if (!chitGroupsSlice) return [] as UnknownRecord[];
    const slice = chitGroupsSlice;
    const raw =
      (Array.isArray(slice.list)
        ? slice.list
        : Array.isArray(slice.items)
        ? slice.items
        : Array.isArray(slice.groups)
        ? slice.groups
        : []) ?? [];
    return raw.filter(isRecord);
  }, [chitGroupsSlice]);

  // members list
  const membersFromStore = useSelector((s: RootState) => {
    const ms = (s as unknown as Record<string, unknown>)["members"] as
      | Record<string, unknown>
      | undefined;
    const arr = Array.isArray(ms?.list)
      ? ms.list
      : Array.isArray(ms?.items)
      ? ms.items
      : Array.isArray(ms?.members)
      ? ms.members
      : [];
    return arr;
  }) as unknown[];

  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const it of membersFromStore) {
      if (isRecord(it)) {
        const id = String(it._id ?? it.id ?? "");
        const name =
          typeof it.name === "string"
            ? it.name
            : id;
        if (id) map[id] = name;
      } else {
        const id = String(it ?? "");
        if (id) map[id] = id;
      }
    }
    return map;
  }, [membersFromStore]);

  const totalGroups = groups.length;
  const totalCustomers = membersFromStore.length;

  // collections stats
  const [pendingCollections, setPendingCollections] = useState(0);
  const [todayCollected, setTodayCollected] = useState(0);
  const [monthCollected, setMonthCollected] = useState(0);
  const [yearCollected, setYearCollected] = useState(0);

  // transactions stats
  const [monthlyCollectionData, setMonthlyCollectionData] = useState<
    MonthlyPoint[]
  >(
    monthLabels.map((label) => ({
      month: label,
      amount: 0,
    })),
  );
  const [totalRevenue, setTotalRevenue] = useState(0);

  // bidding + recent winners
  const [biddingSummary, setBiddingSummary] = useState<
    BiddingSummaryItem[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<
    RecentActivityItem[]
  >([]);

  // initial loads
  useEffect(() => {
    const status =
      (chitGroupsSlice?.status as string | undefined) ?? "idle";
    if (status === "idle") {
      dispatch(fetchGroups());
    }
  }, [dispatch, chitGroupsSlice]);

  useEffect(() => {
    if (!membersFromStore.length) {
      dispatch(fetchMembers());
    }
  }, [dispatch, membersFromStore.length]);

  // collections/pending API → pending + today/month/year
  useEffect(() => {
    const loadCollectionsStats = async () => {
      try {
        const res = await fetch("/api/collections/pending", {
          credentials: "include",
        });
        const json: unknown = await res.json().catch(() => ({}));
        if (!res.ok || !isRecord(json)) return;

        const items = Array.isArray(json.items)
          ? json.items
          : [];
        let pending = 0;
        for (const r of items) {
          if (!isRecord(r)) continue;
          pending += toNumber(r.pending);
        }
        setPendingCollections(pending);

        if (isRecord(json.stats)) {
          const st = json.stats as UnknownRecord;
          setTodayCollected(toNumber(st.todayTotal));
          setMonthCollected(toNumber(st.monthTotal));
          setYearCollected(toNumber(st.yearTotal));
        }
      } catch {
        // ignore, show zeros
      }
    };

    void loadCollectionsStats();
  }, []);

  // admin transactions → monthly chart + total revenue
  useEffect(() => {
    const loadTxnStats = async () => {
      try {
        const res = await fetch(
          "/api/admin/transactions?status=all",
          { credentials: "include" },
        );
        const body: unknown = await res
          .json()
          .catch(() => ({}));

        const list: unknown[] = Array.isArray(body)
          ? body
          : isRecord(body) && Array.isArray(body.payments)
          ? (body.payments as unknown[])
          : [];

        const now = new Date();
        const currentYear = now.getFullYear();
        const monthSums = Array(12).fill(0);
        let revenue = 0;

        for (const item of list) {
          if (!isRecord(item)) continue;
          const amount = toNumber(item.amount);
          const status = String(
            item.status ?? "",
          ).toLowerCase();
          if (status !== "approved") continue;

          revenue += amount;

          const createdAtStr =
            typeof item.createdAt === "string"
              ? item.createdAt
              : typeof item.date === "string"
              ? item.date
              : undefined;

          if (!createdAtStr) continue;
          const d = new Date(createdAtStr);
          if (Number.isNaN(d.getTime())) continue;
          if (d.getFullYear() !== currentYear) continue;

          const mIndex = d.getMonth();
          monthSums[mIndex] += amount;
        }

        const points: MonthlyPoint[] = monthLabels.map(
          (label, idx) => ({
            month: label,
            amount: monthSums[idx],
          }),
        );

        setMonthlyCollectionData(points);
        setTotalRevenue(revenue);
      } catch {
        // ignore
      }
    };

    void loadTxnStats();
  }, []);

  // bidding summary + recent winners (this month)
  useEffect(() => {
    if (!groups.length) return;

    const loadBiddingAndWinners = async () => {
      const biddingItems: BiddingSummaryItem[] = [];
      const activityItems: RecentActivityItem[] = [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      for (const g of groups) {
        const gid = String(g._id ?? g.id ?? "");
        if (!gid) continue;
        const groupName =
          typeof g.name === "string" ? g.name : gid;

        // Bids for summary
        try {
          const bidsRes = await fetch(
            `/api/chitgroups/${encodeURIComponent(
              gid,
            )}/bids?all=true`,
            { credentials: "include" },
          );
          const bidsJson: unknown = await bidsRes
            .json()
            .catch(() => ({}));

          const bidsArr = extractArray(bidsJson, [
            "bids",
            "data",
          ]);

          let maxDiscount = 0;

          for (const b of bidsArr) {
            if (!isRecord(b)) continue;

            const createdAtStr =
              typeof b.createdAt === "string"
                ? b.createdAt
                : typeof b.date === "string"
                ? b.date
                : undefined;

            if (createdAtStr) {
              const d = new Date(createdAtStr);
              if (
                !Number.isNaN(d.getTime()) &&
                (d.getFullYear() !== currentYear ||
                  d.getMonth() !== currentMonth)
              ) {
                continue;
              }
            }

            const discount = toNumber(
              (b as UnknownRecord).discountOffered ??
                (b as UnknownRecord).discount ??
                (b as UnknownRecord).amount,
            );
            if (discount > maxDiscount) maxDiscount = discount;
          }

          if (maxDiscount > 0) {
            biddingItems.push({
              group: groupName,
              amount: maxDiscount,
            });
          }
        } catch {
          // ignore this group
        }

        // Auction outcome for recent activity
        try {
          const aucRes = await fetch(
            `/api/chitgroups/${encodeURIComponent(
              gid,
            )}/auction?all=true`,
            { credentials: "include" },
          );
          const aucJson: unknown = await aucRes
            .json()
            .catch(() => ({}));

          let auctionObj: UnknownRecord | null = null;
          if (isRecord(aucJson)) {
            if (isRecord(aucJson.auction)) {
              auctionObj = aucJson.auction as UnknownRecord;
            } else if (isRecord(aucJson.data)) {
              auctionObj = aucJson.data as UnknownRecord;
            }
          }

          if (!auctionObj) continue;

          const createdAtStr =
            typeof auctionObj.createdAt === "string"
              ? auctionObj.createdAt
              : typeof auctionObj.date === "string"
              ? auctionObj.date
              : undefined;

          if (createdAtStr) {
            const d = new Date(createdAtStr);
            if (
              !Number.isNaN(d.getTime()) &&
              (d.getFullYear() !== currentYear ||
                d.getMonth() !== currentMonth)
            ) {
              continue;
            }
          }

          const winningMemberId = toStr(
            auctionObj.winningMemberId ??
              auctionObj.winningMember ??
              auctionObj.winner,
          );
          if (!winningMemberId) continue;

          const memberName =
            memberNameMap[winningMemberId] ??
            winningMemberId;

          const winningPayout = toNumber(
            (auctionObj as UnknownRecord).winningPayout ??
              (auctionObj as UnknownRecord).payout ??
              0,
          );
          const winningDiscount = toNumber(
            (auctionObj as UnknownRecord).winningDiscount ??
              (auctionObj as UnknownRecord).discountOffered ??
              0,
          );
          const amount = winningPayout || winningDiscount;

          activityItems.push({
            id: `${gid}-${winningMemberId}-${createdAtStr ?? ""}`,
            member: memberName,
            group: groupName,
            action: "Won Bid",
            amount,
            date: createdAtStr,
          });
        } catch {
          // ignore this group's auction
        }
      }

      biddingItems.sort((a, b) => b.amount - a.amount);
      setBiddingSummary(biddingItems);

      activityItems.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return db - da;
      });
      setRecentActivity(activityItems.slice(0, 10));
    };

    void loadBiddingAndWinners();
  }, [groups, memberNameMap]);

  const statsCards = useMemo(
    () => [
      {
        title: "Total Chit Groups",
        value: String(totalGroups),
        icon: Users,
        bgColor: "bg-[var(--bg-highlight)]",
        textColor: "text-[var(--color-primary)]",
      },
      {
        title: "Total Customers",
        value: String(totalCustomers),
        icon: Wallet,
        bgColor: "bg-[var(--bg-highlight)]",
        textColor: "text-[var(--color-secondary)]",
      },
      {
        title: "Pending Collections",
        value: `₹${pendingCollections.toLocaleString("en-IN")}`,
        icon: TrendingUp,
        bgColor: "bg-[var(--bg-highlight)]",
        textColor: "text-[var(--color-accent)]",
      },
      {
        title: "Total Revenue (Approved)",
        value: `₹${totalRevenue.toLocaleString("en-IN")}`,
        icon: IndianRupee,
        bgColor: "bg-[var(--bg-highlight)]",
        textColor: "text-[var(--color-accent)]",
      },
    ],
    [
      totalGroups,
      totalCustomers,
      pendingCollections,
      totalRevenue,
    ],
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
          >
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--text-secondary)] mb-1">
                      {stat.title}
                    </p>
                    <h3 className="text-3xl font-bold text-[var(--text-primary)]">
                      {stat.value}
                    </h3>
                  </div>
                  <div className={`${stat.bgColor} p-4 rounded-2xl`}>
                    <stat.icon
                      className={`w-8 h-8 ${stat.textColor}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Extra collection stats row (today / month / year) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                Today collected
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                ₹{todayCollected.toLocaleString("en-IN")}
              </h3>
            </div>
            <Calendar className="w-8 h-8 text-[var(--color-primary)]" />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                This month
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                ₹{monthCollected.toLocaleString("en-IN")}
              </h3>
            </div>
            <Calendar className="w-8 h-8 text-[var(--color-secondary)]" />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                This year
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">
                ₹{yearCollected.toLocaleString("en-IN")}
              </h3>
            </div>
            <TrendingUp className="w-8 h-8 text-[var(--color-accent)]" />
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Collection Trend (this year) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[var(--text-primary)]">
                Monthly Collection Trend (This Year)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyCollectionData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-color)"
                    />
                    <XAxis
                      dataKey="month"
                      stroke="var(--text-secondary)"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      fontSize={12}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-card)",
                        border:
                          "1px solid var(--border-color)",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) =>
                        `₹${value.toLocaleString("en-IN")}`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--color-primary)"
                      strokeWidth={3}
                      dot={{
                        fill: "var(--color-primary)",
                        r: 4,
                      }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bidding Summary (highest discount per group this month) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl text-[var(--text-primary)]">
                Bidding Summary (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {biddingSummary.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
                    No bids placed this month.
                  </div>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart data={biddingSummary}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border-color)"
                      />
                      <XAxis
                        dataKey="group"
                        stroke="var(--text-secondary)"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="var(--text-secondary)"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-card)",
                          border:
                            "1px solid var(--border-color)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) =>
                          `₹${value.toLocaleString(
                            "en-IN",
                          )}`
                        }
                      />
                      <Bar
                        dataKey="amount"
                        fill="var(--color-secondary)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity (auction winners) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl text-[var(--text-primary)]">
              Recent Activity (Bid Winners)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl bg-transparent text-[var(--color-primary)] border-[var(--border-color)]"
            >
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)]">
                No auctions completed recently.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">
                        Member
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">
                        Group
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">
                        Action
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--text-secondary)]">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((activity, index) => (
                      <motion.tr
                        key={activity.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          delay: 0.9 + index * 0.05,
                        }}
                        className="border-b border-[var(--border-color)] hover:bg-[var(--bg-highlight)] transition-colors"
                      >
                        <td className="py-3 px-4 text-sm font-medium text-[var(--text-primary)]">
                          {activity.member}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-primary)]">
                          {activity.group}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--btn-secondary-bg)] text-[var(--text-light)]">
                            {activity.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-[var(--text-primary)]">
                          ₹{activity.amount.toLocaleString(
                            "en-IN",
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                          {activity.date
                            ? new Date(
                                activity.date,
                              ).toLocaleString()
                            : "-"}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions same as before */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <Card className="border-0 shadow-lg bg-[var(--bg-highlight)]">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text-primary)]">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/chit-groups">
                <Button className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-6 h-6 text-[var(--color-primary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Manage Groups
                    </span>
                  </div>
                </Button>
              </Link>
              <Link href="/admin/members">
                <Button className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                  <div className="flex flex-col items-center gap-2">
                    <Wallet className="w-6 h-6 text-[var(--color-secondary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Customers
                    </span>
                  </div>
                </Button>
              </Link>
              <Link href="/admin/collections">
                <Button className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                  <div className="flex flex-col items-center gap-2">
                    <IndianRupee className="w-6 h-6 text-[var(--color-accent)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Collections
                    </span>
                  </div>
                </Button>
              </Link>
              <Link href="/admin/chits">
                <Button className="w-full h-20 bg-[var(--color-white)] hover:bg-[var(--bg-main)] text-[var(--text-primary)] rounded-2xl shadow-md hover:shadow-lg transition-all">
                  <div className="flex flex-col items-center gap-2">
                    <Award className="w-6 h-6 text-[var(--color-accent)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      Bidding
                    </span>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
// update
