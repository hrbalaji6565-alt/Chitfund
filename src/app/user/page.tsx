"use client";

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
    TrendingUp,
    Wallet,
    CreditCard,
    ArrowDownRight,
    ArrowUpRight,
    Clock,
    PlusCircle,
} from "lucide-react";
import Button from "../components/ui/button";

export default function UserPage() {
    const transactions = [
        { id: 1, name: "Payment Received", amount: "+₹2,450", type: "credit", date: "Oct 22, 2025" },
        { id: 2, name: "Subscription Fee", amount: "-₹499", type: "debit", date: "Oct 21, 2025" },
        { id: 3, name: "Savings Added", amount: "+₹1,200", type: "credit", date: "Oct 20, 2025" },
        { id: 4, name: "Service Charge", amount: "-₹120", type: "debit", date: "Oct 18, 2025" },
        { id: 5, name: "Payment Sent", amount: "-₹350", type: "debit", date: "Oct 16, 2025" },
    ];

    const metrics = [
        {
            title: "Total Balance",
            value: "₹1,25,000",
            icon: <Wallet className="w-6 h-6 text-white" />,
            bg: "var(--color-primary)",
        },
        {
            title: "Monthly Income",
            value: "₹45,300",
            icon: <TrendingUp className="w-6 h-6 text-white" />,
            bg: "var(--color-secondary)",
        },
        {
            title: "Active Subscriptions",
            value: "8",
            icon: <CreditCard className="w-6 h-6 text-white" />,
            bg: "var(--color-accent)",
        },
        {
            title: "Pending Bills",
            value: "₹1,250",
            icon: <Clock className="w-6 h-6 text-white" />,
            bg: "var(--color-accent-light)",
        },
    ];

    return (
        <div className="p-4 space-y-5 max-w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1
                    className="text-2xl sm:text-3xl font-semibold"
                    style={{ color: "var(--color-primary)" }}
                >
                    Dashboard Overview
                </h1>
                <Button
                    className="rounded-lg text-white text-sm sm:text-base"
                    style={{
                        background: "var(--gradient-primary)",
                        boxShadow: "0 3px 6px var(--shadow-color)",
                        padding: "8px 14px",
                    }}
                >
                    <PlusCircle className="w-4 h-4 mr-1" /> New
                </Button>
            </div>

            {/* Overview Cards */}
            <div
                className="grid gap-2 sm:gap-4"
                style={{
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                }}
            >
                {metrics.map((item, idx) => (
                    <Card
                        key={idx}
                        className="border-0 shadow-sm transition-transform hover:scale-[1.02]"
                        style={{
                            background: item.bg,
                            color: "var(--text-light)",
                            minHeight: "95px",
                            width: "100%",
                        }}
                    >
                        <CardContent className="flex flex-col justify-between p-3 sm:p-4">
                            <div className="flex justify-between items-center">
                                <p className="text-[11px] sm:text-sm opacity-90">
                                    {item.title}
                                </p>
                                <div className="bg-white/25 p-2 rounded-xl shrink-0">
                                    {item.icon}
                                </div>
                            </div>
                            <h3 className="text-lg sm:text-2xl font-bold mt-1">
                                {item.value}
                            </h3>
                        </CardContent>
                    </Card>
                ))}
            </div>



            {/* Recent Transactions */}
            <Card
                className="shadow-lg border-0"
                style={{
                    width: "100%",
                }}
            >
                <CardHeader
                    style={{
                        background: "var(--bg-highlight)",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <CardTitle style={{ color: "var(--color-secondary)" }}>
                        Recent Transactions
                    </CardTitle>
                </CardHeader>

                <CardContent
                    className="p-0 overflow-x-auto"
                    style={{
                        scrollbarWidth: "thin",
                    }}
                >
                    <table
                        className="min-w-full border-collapse text-sm sm:text-base"
                        style={{ width: "100%" }}
                    >
                        <thead>
                            <tr
                                style={{
                                    background: "var(--bg-highlight)",
                                    color: "var(--text-secondary)",
                                }}
                            >
                                <th className="p-3 text-left font-medium" style={{ width: "80px" }}>
                                    Name
                                </th>
                                <th className="p-3 text-left font-medium" style={{ width: "120px" }}>
                                    Date
                                </th>
                                <th className="p-3 text-left font-medium" style={{ width: "80px" }}>
                                    Status
                                </th>
                                <th className="p-3 text-right font-medium" style={{ width: "80px" }}>
                                    Amount
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {transactions.map((tx) => (
                                <tr
                                    key={tx.id}
                                    className="hover:opacity-90 transition"
                                    style={{
                                        borderBottom: "1px solid var(--border-color)",
                                    }}
                                >
                                    <td className="p-3" style={{ color: "var(--text-primary)" }}>
                                        {tx.name}
                                    </td>
                                    <td className="p-3" style={{ color: "var(--text-secondary)" }}>
                                        {tx.date}
                                    </td>
                                    <td className="p-3">
                                        <Badge
                                            className="rounded-full px-2 py-1 text-xs sm:text-sm"
                                            style={{
                                                background:
                                                    tx.type === "credit"
                                                        ? "var(--btn-secondary-bg)"
                                                        : "var(--btn-primary-bg)",
                                                color: "var(--text-light)",
                                            }}
                                        >
                                            {tx.type === "credit" ? (
                                                <ArrowUpRight className="w-3 h-3 inline mr-1" />
                                            ) : (
                                                <ArrowDownRight className="w-3 h-3 inline mr-1" />
                                            )}
                                            {tx.type === "credit" ? "Credit" : "Debit"}
                                        </Badge>
                                    </td>
                                    <td
                                        className="p-3 text-right font-semibold"
                                        style={{
                                            color:
                                                tx.type === "credit"
                                                    ? "var(--color-secondary)"
                                                    : "var(--color-primary)",
                                        }}
                                    >
                                        {tx.amount}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

        </div>
    );
}
