// app/api/collections/collect/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Group from "@/app/models/ChitGroup";
import Payment from "@/app/models/Payment";

type UnknownRecord = Record<string, unknown>;

type Stats = {
    todayTotal: number;
    monthTotal: number;
    yearTotal: number;
};

const isRecord = (v: unknown): v is UnknownRecord =>
    typeof v === "object" && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const computeStats = async (): Promise<Stats> => {
    const now = new Date();
    const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const makeTotal = async (from: Date): Promise<number> => {
        const result = (await Payment.aggregate([
            {
                $match: {
                    status: "approved",
                    createdAt: { $gte: from, $lte: now },
                },
            },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]).exec()) as Array<{ _id: unknown; total: number }>;
        return result.length ? result[0].total : 0;
    };

    const [todayTotal, monthTotal, yearTotal] = await Promise.all([
        makeTotal(startOfDay),
        makeTotal(startOfMonth),
        makeTotal(startOfYear),
    ]);

    return { todayTotal, monthTotal, yearTotal };
};

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = (await req.json().catch(() => ({}))) as UnknownRecord;

        const chitGroupId = String(body.chitGroupId ?? "");
        const memberId = String(body.memberId ?? "");
        const monthIndex = toNumber(body.monthIndex ?? 0);
        const amount = toNumber(body.amount ?? 0);
        const modeInput =
            typeof body.mode === "string" ? body.mode : String(body.mode ?? "cash");

        // sirf do hi allowed values: 'cash' ya 'upi'
        const modeNormalized = modeInput.toLowerCase().includes("cash")
            ? "cash"
            : "upi";

        const paymentType = modeNormalized === "cash" ? "CASH" : "UPI";
        const note =
            typeof body.note === "string" ? body.note : "Collection visit";
        const utr =
            typeof body.utr === "string" ? body.utr : "";
        const collectorRole =
            typeof body.collectorRole === "string"
                ? body.collectorRole
                : "collector";
        const collectedById =
            typeof body.collectedById === "string"
                ? body.collectedById
                : undefined;

        if (!chitGroupId || !memberId || amount <= 0 || monthIndex <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "chitGroupId, memberId, monthIndex and amount are required",
                },
                { status: 400 },
            );
        }

        const groupDoc = await Group.findById(chitGroupId).lean();
        if (!groupDoc || !isRecord(groupDoc)) {
            return NextResponse.json(
                { success: false, error: "Chit group not found" },
                { status: 404 },
            );
        }

        // optional: cap on pending for safety
        const approvedDocs = (await Payment.find({
            groupId: chitGroupId,
            memberId,
            status: "approved",
        }).lean()) as UnknownRecord[];

        const existingPaidForMonth = approvedDocs.reduce((sum, p) => {
            const alloc = isRecord(p.allocation)
                ? p.allocation
                : undefined;
            const mIdx = toNumber(
                alloc?.monthIndex ?? alloc?.month ?? monthIndex,
            );
            if (mIdx === monthIndex) {
                return sum + toNumber(p.amount ?? p.amt ?? 0);
            }
            return sum;
        }, 0);

        const monthlyInstallment = toNumber(
            (groupDoc as UnknownRecord).monthlyInstallment ?? 0,
        );
        let ceiling = monthlyInstallment;
        if (!ceiling) {
            const chitValue = toNumber(
                (groupDoc as UnknownRecord).chitValue ?? 0,
            );
            const totalMonths = Math.max(
                1,
                toNumber((groupDoc as UnknownRecord).totalMonths ?? 1),
            );
            let totalMembers = 1;
            const members = (groupDoc as UnknownRecord).members;

            if (Array.isArray(members)) {
                totalMembers = members.length > 0 ? members.length : 1;
            }

            const baseMonthly =
                totalMonths > 0 ? chitValue / totalMonths : 0;
            ceiling =
                totalMembers > 0
                    ? Math.round(baseMonthly / totalMembers)
                    : 0;
        }

        const remaining = Math.max(0, ceiling - existingPaidForMonth);
        if (remaining <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Installment already fully paid for this month",
                },
                { status: 400 },
            );
        }
        if (amount > remaining) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Amount exceeds pending (${remaining}) for this month`,
                },
                { status: 400 },
            );
        }

        const payment = new Payment({
            memberId,
            groupId: chitGroupId,
            amount,
            type: paymentType,     // ✅ Yahi hona chahiye
            method: modeNormalized,
            note,
            utr,
            status: "approved", // collector verified at source
            approvedAt: new Date(),
            allocationDetails: [
                {
                    monthIndex,
                    principalPaid: amount,
                    penaltyPaid: 0,
                },
            ],
            rawMeta: {
                collectedVia: "collection-screen",
                collectorRole,
                collectedById,
                monthIndex,
                paymentKind: "collection", // yaha safe custom flag rakh sakte ho
            },
        });


        await payment.save();

        // update group's collectedAmount
        await Group.findByIdAndUpdate(chitGroupId, {
            $inc: { collectedAmount: amount },
        }).lean();

        const stats = await computeStats();

        return NextResponse.json({
            success: true,
            payment,
            stats,
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("POST /api/collections/collect error:", err);
        return NextResponse.json(
            {
                success: false,
                error:
                    err instanceof Error
                        ? err.message
                        : "Failed to submit collection",
            },
            { status: 500 },
        );
    }
}
