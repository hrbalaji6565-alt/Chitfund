"use client";

import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Button from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  TrendingUp,
  Users,
  Award,
  Download,
  Calendar,
  IndianRupee,
} from "lucide-react";
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
} from "recharts";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchGroups } from "@/store/chitGroupSlice";
import { fetchMembers } from "@/store/memberSlice";
import type { ChitGroup } from "@/app/lib/types";

type UnknownRecord = Record<string, unknown>;

type TimeRangeKey = "1month" | "3months" | "6months" | "1year";

type NormalizedPayment = {
  id: string;
  memberId: string | null;
  groupId: string | null;
  amount: number;
  createdAt?: string;
  status?: string | null;
  verified?: boolean;
};

type PendingSummary = {
  totalPending: number;
  overdue: number;
  membersPending: number;
};

type CollectionChartPoint = {
  month: string;
  collected: number;
  pending: number;
};

type GroupPerformancePoint = {
  name: string;
  value: number; // percentage
  groupId: string;
};

type AuctionTrendPoint = {
  month: string;
  auctions: number;
  avgBid: number;
};

type ChitGroupsSlice = {
  list?: unknown;
  items?: unknown;
  groups?: unknown;
};

type MembersSlice = {
  list?: unknown;
  items?: unknown;
  members?: unknown;
};

const COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-accent-light)",
];

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseIsoDate = (iso: string): Date | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMonthShort = (date: Date): string =>
  date.toLocaleString("en-IN", { month: "short" });

const computeFromDate = (range: TimeRangeKey): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "1month") {
    d.setMonth(d.getMonth() - 1);
  } else if (range === "3months") {
    d.setMonth(d.getMonth() - 3);
  } else if (range === "6months") {
    d.setMonth(d.getMonth() - 6);
  } else {
    d.setFullYear(d.getFullYear() - 1);
  }
  return d;
};

const formatCurrency = (value: number): string =>
  `₹${value.toLocaleString("en-IN")}`;

const getGroupId = (group: ChitGroup): string => {
  const withId = group as unknown as { _id?: unknown; id?: unknown };
  const raw = withId._id ?? withId.id ?? "";
  return String(raw);
};

const computeExpectedPerMonthAllGroups = (groups: ChitGroup[]): number => {
  if (!groups.length) return 0;
  let total = 0;

  for (const g of groups) {
    const rec = g as unknown as {
      totalMembers?: number;
      members?: unknown;
      monthlyInstallment?: number;
      chitValue?: number;
      totalMonths?: number;
    };

    let membersCount = 0;
    if (typeof rec.totalMembers === "number" && rec.totalMembers > 0) {
      membersCount = rec.totalMembers;
    } else if (Array.isArray(rec.members)) {
      membersCount = rec.members.length;
    }
    if (membersCount <= 0) membersCount = 1;

    const monthlyInstallment =
      typeof rec.monthlyInstallment === "number" ? rec.monthlyInstallment : 0;
    const chitValue = typeof rec.chitValue === "number" ? rec.chitValue : 0;
    const totalMonths =
      typeof rec.totalMonths === "number" && rec.totalMonths > 0
        ? rec.totalMonths
        : 1;

    const perMember =
      monthlyInstallment && monthlyInstallment > 0
        ? monthlyInstallment
        : chitValue > 0
        ? chitValue / totalMonths / membersCount
        : 0;

    total += perMember * membersCount;
  }

  return total;
};

const isApprovedPayment = (p: NormalizedPayment): boolean => {
  const statusLower = (p.status ?? "").toLowerCase();
  return statusLower === "approved" || p.verified === true;
};

export default function ReportsPage() {
  const dispatch = useDispatch<AppDispatch>();

  const [range, setRange] = useState<TimeRangeKey>("6months");
  const [payments, setPayments] = useState<NormalizedPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [pendingSummary, setPendingSummary] = useState<PendingSummary>({
    totalPending: 0,
    overdue: 0,
    membersPending: 0,
  });
  const [pendingLoading, setPendingLoading] = useState(false);

  // ---- Redux slices ----

  const chitGroupsState = useSelector((state: RootState) => {
    const root = state as unknown as Record<string, unknown>;
    const slice = root.chitGroups;
    if (isRecord(slice)) {
      return slice as ChitGroupsSlice;
    }
    return undefined;
  });

  const groups: ChitGroup[] = useMemo(() => {
    if (!chitGroupsState) return [];
    const base = Array.isArray(chitGroupsState.list)
      ? chitGroupsState.list
      : Array.isArray(chitGroupsState.items)
      ? chitGroupsState.items
      : Array.isArray(chitGroupsState.groups)
      ? chitGroupsState.groups
      : [];
    return (base as unknown[]).filter(isRecord) as unknown as ChitGroup[];
  }, [chitGroupsState]);

  const membersSlice = useSelector((state: RootState) => {
    const root = state as unknown as Record<string, unknown>;
    const slice = root.members;
    if (isRecord(slice)) {
      return slice as MembersSlice;
    }
    return undefined;
  });

  const members = useMemo(() => {
    if (!membersSlice) return [] as unknown[];
    const base = Array.isArray(membersSlice.list)
      ? membersSlice.list
      : Array.isArray(membersSlice.items)
      ? membersSlice.items
      : Array.isArray(membersSlice.members)
      ? membersSlice.members
      : [];
    return base as unknown[];
  }, [membersSlice]);

  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of members) {
      if (!isRecord(item)) continue;
      const idRaw =
        (typeof item._id === "string" && item._id) ||
        (typeof item.id === "string" && item.id) ||
        "";
      const id = String(idRaw);
      if (!id) continue;
      const name =
        (typeof item.name === "string" && item.name) ||
        (typeof item.fullName === "string" && item.fullName) ||
        id;
      map[id] = name;
    }
    return map;
  }, [members]);

  const groupNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of groups) {
      const id = getGroupId(g);
      if (!id) continue;
      const rec = g as unknown as { name?: string };
      const name = rec.name ?? id;
      map[id] = name;
    }
    return map;
  }, [groups]);

  // ---- Initial data fetch ----

  useEffect(() => {
    dispatch(fetchGroups());
    dispatch(fetchMembers());
  }, [dispatch]);

  // transactions from /api/admin/transactions
  useEffect(() => {
    const load = async () => {
      setPaymentsLoading(true);
      setPaymentsError(null);
      try {
        const res = await fetch("/api/admin/transactions?status=all", {
          credentials: "include",
        });
        const json = await res.json();

        let arr: unknown[] = [];
        if (isRecord(json) && Array.isArray(json.payments)) {
          arr = json.payments as unknown[];
        } else if (Array.isArray(json)) {
          arr = json as unknown[];
        }

        const normalized: NormalizedPayment[] = arr.map((item) => {
          if (!isRecord(item)) {
            return {
              id: String(Math.random()),
              memberId: null,
              groupId: null,
              amount: 0,
            };
          }
          const rec = item;

          const id =
            (typeof rec._id === "string" && rec._id) ||
            (typeof rec.id === "string" && rec.id) ||
            String(Math.random());

          const rawMember = rec.member;
          const rawGroup = rec.group;

          const memberId: string | null = (() => {
            if (typeof rec.memberId === "string") return rec.memberId;
            if (isRecord(rawMember)) {
              if (typeof rawMember._id === "string") return rawMember._id;
              if (typeof rawMember.id === "string") return rawMember.id;
            }
            if (typeof rec.userId === "string") return rec.userId;
            return null;
          })();

          const groupId: string | null = (() => {
            if (typeof rec.groupId === "string") return rec.groupId;
            if (isRecord(rawGroup)) {
              if (typeof rawGroup._id === "string") return rawGroup._id;
              if (typeof rawGroup.id === "string") return rawGroup.id;
            }
            return null;
          })();

          const amount = toNumber(rec.amount ?? rec.amt ?? 0);

          const createdAt =
            typeof rec.createdAt === "string"
              ? rec.createdAt
              : typeof rec.date === "string"
              ? rec.date
              : undefined;

          const status =
            typeof rec.status === "string" ? rec.status : undefined;

          const verified =
            typeof rec.verified === "boolean" ? rec.verified : undefined;

          return {
            id: String(id),
            memberId,
            groupId,
            amount,
            createdAt,
            status,
            verified,
          };
        });

        setPayments(normalized);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load transactions";
        setPaymentsError(message);
      } finally {
        setPaymentsLoading(false);
      }
    };

    void load();
  }, []);

  // pending summary from /api/collections/pending
  useEffect(() => {
    const loadPending = async () => {
      setPendingLoading(true);
      try {
        const res = await fetch("/api/collections/pending", {
          credentials: "include",
        });
        const json = await res.json();

        if (!res.ok || !isRecord(json)) {
          setPendingSummary({
            totalPending: 0,
            overdue: 0,
            membersPending: 0,
          });
          return;
        }

        const success = json.success === true;
        const itemsRaw = Array.isArray(json.items)
          ? (json.items as unknown[])
          : [];

        if (!success || !itemsRaw.length) {
          setPendingSummary({
            totalPending: 0,
            overdue: 0,
            membersPending: 0,
          });
          return;
        }

        let total = 0;
        let overdue = 0;
        const memberSet = new Set<string>();
        const currentMonthNumber = new Date().getMonth() + 1;

        for (const item of itemsRaw) {
          if (!isRecord(item)) continue;
          const pending = toNumber(item.pending);
          const memberId =
            typeof item.memberId === "string" ? item.memberId : "";
          const monthIndexNumber = toNumber(item.monthIndex);

          if (pending > 0) {
            total += pending;
            if (memberId) memberSet.add(memberId);
            // approx overdue logic based on month index
            if (monthIndexNumber > 0 && monthIndexNumber < currentMonthNumber) {
              overdue += pending;
            }
          }
        }

        setPendingSummary({
          totalPending: total,
          overdue,
          membersPending: memberSet.size,
        });
      } catch {
        setPendingSummary({
          totalPending: 0,
          overdue: 0,
          membersPending: 0,
        });
      } finally {
        setPendingLoading(false);
      }
    };

    void loadPending();
  }, []);

  // ---- Derived values (filtered by date range) ----

  const filteredApprovedPayments = useMemo(() => {
    if (!payments.length) return [] as NormalizedPayment[];
    const from = computeFromDate(range);
    const now = new Date();

    return payments.filter((p) => {
      if (!p.createdAt) return false;
      const dt = parseIsoDate(p.createdAt);
      if (!dt) return false;
      if (dt < from || dt > now) return false;
      return isApprovedPayment(p);
    });
  }, [payments, range]);

  const totalRevenue = useMemo(
    () =>
      filteredApprovedPayments.reduce(
        (sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0),
        0,
      ),
    [filteredApprovedPayments],
  );

  const activeMembersInRange = useMemo(() => {
    const set = new Set<string>();
    for (const p of filteredApprovedPayments) {
      if (p.memberId) set.add(p.memberId);
    }
    return set.size;
  }, [filteredApprovedPayments]);

  const totalMembersCount = members.length;
  const activeMembers =
    activeMembersInRange > 0 ? activeMembersInRange : totalMembersCount;

  const collectionRate = useMemo(() => {
    const expectedTotal = totalRevenue + pendingSummary.totalPending;
    if (expectedTotal <= 0) return 0;
    return (totalRevenue / expectedTotal) * 100;
  }, [totalRevenue, pendingSummary.totalPending]);

  const expectedPerMonthAllGroups = useMemo(
    () => computeExpectedPerMonthAllGroups(groups),
    [groups],
  );

  const collectionChartData: CollectionChartPoint[] = useMemo(() => {
    if (!filteredApprovedPayments.length) return [];
    const from = computeFromDate(range);
    const now = new Date();

    const monthKeys: string[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);

    while (cursor <= end) {
      monthKeys.push(`${cursor.getFullYear()}-${cursor.getMonth()}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const collectedMap = new Map<string, number>();
    for (const p of filteredApprovedPayments) {
      if (!p.createdAt) continue;
      const dt = parseIsoDate(p.createdAt);
      if (!dt) continue;
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      collectedMap.set(key, (collectedMap.get(key) ?? 0) + p.amount);
    }

    return monthKeys.map((key) => {
      const [yearStr, monthIndexStr] = key.split("-");
      const yearNum = Number(yearStr);
      const monthIndexNum = Number(monthIndexStr);
      const dateObj = new Date(yearNum, monthIndexNum, 1);

      const collected = collectedMap.get(key) ?? 0;
      const expected = expectedPerMonthAllGroups;
      const pending =
        expected > 0 ? Math.max(0, expected - collected) : 0;

      return {
        month: formatMonthShort(dateObj),
        collected,
        pending,
      };
    });
  }, [filteredApprovedPayments, range, expectedPerMonthAllGroups]);

  const groupPerformanceData: GroupPerformancePoint[] = useMemo(() => {
    if (!filteredApprovedPayments.length) return [];
    const totals = new Map<string, number>();

    for (const p of filteredApprovedPayments) {
      const gid = p.groupId ?? "unknown";
      totals.set(gid, (totals.get(gid) ?? 0) + p.amount);
    }

    const overall = Array.from(totals.values()).reduce(
      (sum, v) => sum + v,
      0,
    );
    if (overall <= 0) return [];

    const list: GroupPerformancePoint[] = [];
    for (const [gid, value] of totals.entries()) {
      const group = groups.find((g) => getGroupId(g) === gid);
      const name = groupNameMap[gid] ?? group?.name ?? `Group ${gid}`;
      const percent = (value / overall) * 100;
      list.push({ name, value: percent, groupId: gid });
    }

    return list;
  }, [filteredApprovedPayments, groups, groupNameMap]);

  const topGroup = useMemo(() => {
    if (!groupPerformanceData.length) return undefined;
    const clone = [...groupPerformanceData];
    clone.sort((a, b) => b.value - a.value);
    return clone[0];
  }, [groupPerformanceData]);

  const topGroupMembers = useMemo(() => {
    if (!topGroup) return 0;
    const group = groups.find((g) => getGroupId(g) === topGroup.groupId);
    if (!group) return 0;
    const rec = group as unknown as { members?: unknown; totalMembers?: number };
    if (Array.isArray(rec.members)) return rec.members.length;
    if (typeof rec.totalMembers === "number") return rec.totalMembers;
    return 0;
  }, [topGroup, groups]);

  const auctionTrendsData: AuctionTrendPoint[] = useMemo(() => {
    if (!filteredApprovedPayments.length) return [];
    const byMonth = new Map<
      string,
      { label: string; totalAmount: number; count: number; groups: Set<string> }
    >();

    for (const p of filteredApprovedPayments) {
      if (!p.createdAt) continue;
      const dt = parseIsoDate(p.createdAt);
      if (!dt) continue;

      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const label = formatMonthShort(dt);

      if (!byMonth.has(key)) {
        byMonth.set(key, {
          label,
          totalAmount: 0,
          count: 0,
          groups: new Set<string>(),
        });
      }
      const bucket = byMonth.get(key)!;
      bucket.totalAmount += p.amount;
      bucket.count += 1;
      if (p.groupId) bucket.groups.add(p.groupId);
    }

    const entries = Array.from(byMonth.entries()).sort((a, b) => {
      const [ay, am] = a[0].split("-").map(Number);
      const [by, bm] = b[0].split("-").map(Number);
      if (ay !== by) return ay - by;
      return am - bm;
    });

    return entries.map(([, bucket]) => ({
      month: bucket.label,
      auctions: bucket.groups.size,
      avgBid:
        bucket.count > 0 ? bucket.totalAmount / bucket.count : 0,
    }));
  }, [filteredApprovedPayments]);

  const totalAuctions = useMemo(
    () =>
      auctionTrendsData.reduce((sum, item) => sum + item.auctions, 0),
    [auctionTrendsData],
  );

  const recentAuctionLikePayment = useMemo(() => {
    if (!filteredApprovedPayments.length) return undefined;
    const sorted = [...filteredApprovedPayments].sort((a, b) => {
      const da = a.createdAt ? parseIsoDate(a.createdAt)?.getTime() ?? 0 : 0;
      const db = b.createdAt ? parseIsoDate(b.createdAt)?.getTime() ?? 0 : 0;
      return db - da;
    });
    return sorted[0];
  }, [filteredApprovedPayments]);

  const handleRangeChange = (value: string) => {
    setRange(value as TimeRangeKey);
  };

  return (
    <div className="space-y-6" style={{ background: "var(--bg-main)" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--color-primary)" }}
          >
            Reports &amp; Analytics
          </h1>
          <p
            className="mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Comprehensive insights into your chit fund operations
          </p>
          {paymentsError && (
            <p className="mt-1 text-sm text-red-500">
              {paymentsError}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Select value={range} onValueChange={handleRangeChange}>
            <SelectTrigger
              className="w-40 h-12 rounded-xl"
              style={{
                borderColor: "var(--border-color)",
                background: "var(--bg-card)",
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            >
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            style={{
              background: "var(--gradient-primary)",
              color: "var(--text-light)",
              borderRadius: "1rem",
              height: "3rem",
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: "Total Revenue",
            value: formatCurrency(totalRevenue),
            icon: <IndianRupee className="w-8 h-8" />,
            gradientFrom: "var(--color-primary)",
            gradientTo: "var(--color-secondary)",
          },
          {
            title: "Active Members",
            value: String(activeMembers),
            icon: <Users className="w-8 h-8" />,
            gradientFrom: "var(--color-secondary)",
            gradientTo: "var(--color-accent)",
          },
          {
            title: "Total Auctions",
            value: String(totalAuctions),
            icon: <Award className="w-8 h-8" />,
            gradientFrom: "var(--color-accent)",
            gradientTo: "var(--color-accent-light)",
          },
          {
            title: "Collection Rate",
            value: `${collectionRate.toFixed(0)}%`,
            icon: <Calendar className="w-8 h-8" />,
            gradientFrom: "var(--color-accent-light)",
            gradientTo: "var(--color-accent)",
          },
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
                <p className="text-sm mb-1 text-white">
                  {metric.title}
                </p>
                <h3 className="text-3xl font-bold text-white">
                  {metric.value}
                </h3>
              
              </div>
              <div className="bg-white p-4 rounded-2xl">
                {metric.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle
              className="text-xl"
              style={{ color: "var(--text-primary)" }}
            >
              Collection Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collectionChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-color)"
                />
                <XAxis
                  dataKey="month"
                  stroke="var(--text-secondary)"
                />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    padding: "12px",
                    color: "var(--text-primary)",
                  }}
                  formatter={(val: unknown, name: unknown) => {
                    const label =
                      typeof name === "string" ? name : "";
                    const num = toNumber(val);
                    return [formatCurrency(num), label];
                  }}
                />
                <Legend />
                <Bar
                  dataKey="collected"
                  fill="var(--color-primary)"
                  name="Collected"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="pending"
                  fill="var(--color-secondary)"
                  name="Pending (approx)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle
              className="text-xl"
              style={{ color: "var(--text-primary)" }}
            >
              Group Performance Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={groupPerformanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({
                    name,
                    value,
                  }: {
                    name?: string;
                    value?: number;
                  }) =>
                    typeof name === "string" &&
                    typeof value === "number"
                      ? `${name}: ${value.toFixed(0)}%`
                      : name ?? ""
                  }
                  outerRadius={100}
                  fill="var(--color-accent)"
                  dataKey="value"
                >
                  {groupPerformanceData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    padding: "12px",
                    color: "var(--text-primary)",
                  }}
                  formatter={(val: unknown, name: unknown) => {
                    const label =
                      typeof name === "string" ? name : "";
                    const num = toNumber(val);
                    return [`${num.toFixed(1)}%`, label];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle
            className="text-xl"
            style={{ color: "var(--text-primary)" }}
          >
            Auction Trends &amp; Average Bid Amount
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={auctionTrendsData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-color)"
              />
              <XAxis
                dataKey="month"
                stroke="var(--text-secondary)"
              />
              <YAxis
                yAxisId="left"
                stroke="var(--text-secondary)"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--text-secondary)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "12px",
                  padding: "12px",
                  color: "var(--text-primary)",
                }}
                formatter={(val: unknown, name: unknown) => {
                  const label =
                    typeof name === "string" ? name : "";
                  if (label.includes("Average")) {
                    return [formatCurrency(toNumber(val)), label];
                  }
                  return [toNumber(val), label];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="auctions"
                stroke="var(--color-accent)"
                strokeWidth={3}
                name="Number of Auctions (approx)"
                dot={{ fill: "var(--color-accent)", r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgBid"
                stroke="var(--color-primary)"
                strokeWidth={3}
                name="Average Amount (₹)"
                dot={{ fill: "var(--color-primary)", r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Performing Group */}
        <Card
          className="border-0 shadow-lg"
          style={{ background: "var(--bg-highlight)" }}
        >
          <CardContent className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Top Performing Group
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Group Name:
                </span>
                <span
                  style={{
                    color: "var(--color-primary)",
                    fontWeight: "bold",
                  }}
                >
                  {topGroup?.name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Collection Share:
                </span>
                <span
                  style={{
                    color: "var(--color-accent)",
                    fontWeight: "bold",
                  }}
                >
                  {topGroup
                    ? `${topGroup.value.toFixed(0)}%`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Total Members:
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {topGroup ? topGroupMembers : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Auction Winner (approx from last payment) */}
        <Card
          className="border-0 shadow-lg"
          style={{ background: "var(--bg-highlight)" }}
        >
          <CardContent className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Recent Auction Winner
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Winner:
                </span>
                <span
                  style={{
                    color: "var(--color-secondary)",
                    fontWeight: "bold",
                  }}
                >
                  {recentAuctionLikePayment?.memberId
                    ? memberNameMap[recentAuctionLikePayment.memberId] ??
                      recentAuctionLikePayment.memberId
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Bid Amount:
                </span>
                <span
                  style={{
                    color: "var(--color-accent)",
                    fontWeight: "bold",
                  }}
                >
                  {recentAuctionLikePayment
                    ? formatCurrency(recentAuctionLikePayment.amount)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Group:
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {recentAuctionLikePayment?.groupId
                    ? groupNameMap[recentAuctionLikePayment.groupId] ??
                      recentAuctionLikePayment.groupId
                    : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Collections */}
        <Card
          className="border-0 shadow-lg"
          style={{ background: "var(--bg-highlight)" }}
        >
          <CardContent className="p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Pending Collections
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Total Pending:
                </span>
                <span
                  style={{
                    color: "var(--color-accent)",
                    fontWeight: "bold",
                  }}
                >
                  {pendingLoading
                    ? "Loading..."
                    : formatCurrency(pendingSummary.totalPending)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Overdue (approx):
                </span>
                <span
                  style={{
                    color: "var(--color-secondary)",
                    fontWeight: "bold",
                  }}
                >
                  {pendingLoading
                    ? "Loading..."
                    : formatCurrency(pendingSummary.overdue)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--text-secondary)" }}>
                  Members:
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {pendingLoading ? "..." : pendingSummary.membersPending}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {paymentsLoading && (
        <p className="text-xs text-gray-500">Loading transactions…</p>
      )}
    </div>
  );
}
