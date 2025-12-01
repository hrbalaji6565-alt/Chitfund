// app/api/chitgroups/[id]/payments/request/route.ts
import { NextResponse, type NextRequest } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Payment from "@/app/models/Payment";
import { uploadBase64Image } from "@/app/lib/cloudinary";
import mongoose from "mongoose";

type FormDataLike = Record<string, FormDataEntryValue | null>;
type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toOptString = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  try {
    return String(v);
  } catch {
    return undefined;
  }
};

async function parseRequest(req: NextRequest): Promise<FormDataLike> {
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data") || ct.includes("form-data")) {
    const fd = await req.formData();
    const out: FormDataLike = {};
    for (const key of Array.from(fd.keys())) {
      out[key] = fd.get(key);
    }
    return out;
  }

  try {
    const json = (await req.json()) as unknown;
    if (!isRecord(json)) return {};
    const out: FormDataLike = {};
    for (const [k, v] of Object.entries(json)) {
      out[k] = v === null ? null : String(v);
    }
    return out;
  } catch {
    return {};
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

type AllocatedItem = {
  ledgerId?: string;
  monthIndex?: number;
  amount?: number;
  penaltyApplied?: number;
};

type ImageInfo = {
  url?: string;
  public_id?: string;
};

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: routeId } = await context.params;
    const groupId = String(routeId ?? "");
    if (!groupId) {
      return NextResponse.json(
        { error: "Missing group id in route" },
        { status: 400 },
      );
    }

    await dbConnect();

    const parsed = await parseRequest(req);

    const memberIdRaw = parsed["memberId"];
    const amountRaw = parsed["amount"];
    const noteRaw =
      parsed["note"] ?? parsed["adminNote"] ?? parsed["rawMeta"];
    const utrRaw =
      parsed["utr"] ??
      parsed["reference"] ??
      parsed["txn"] ??
      parsed["txnid"];
    const rawMetaRaw =
      parsed["rawMeta"] ??
      parsed["rawmeta"] ??
      parsed["allocationSummary"] ??
      parsed["allocationsummary"];

    const memberId = memberIdRaw ? String(memberIdRaw) : undefined;
    const amount =
      amountRaw !== undefined && amountRaw !== null
        ? Number(String(amountRaw))
        : undefined;
    const note = noteRaw
      ? typeof noteRaw === "string"
        ? noteRaw
        : JSON.stringify(noteRaw)
      : undefined;
    const reference = utrRaw ? String(utrRaw) : undefined;

    if (!memberId || !amount || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "memberId and positive amount are required" },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json(
        { error: "Invalid group id" },
        { status: 400 },
      );
    }
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return NextResponse.json(
        { error: "Invalid member id" },
        { status: 400 },
      );
    }

    const status = "pending";

    let allocated: AllocatedItem[] = [];
    try {
      let allocationSummary: unknown;

      if (rawMetaRaw) {
        allocationSummary =
          typeof rawMetaRaw === "string"
            ? JSON.parse(rawMetaRaw)
            : rawMetaRaw;
      } else {
        const alloc = parsed["allocationSummary"];
        if (alloc) {
          allocationSummary =
            typeof alloc === "string"
              ? JSON.parse(String(alloc))
              : alloc;
        }
      }

      if (
        allocationSummary &&
        (typeof allocationSummary === "object" ||
          Array.isArray(allocationSummary))
      ) {
        let sourceArray: unknown[] | null = null;

        if (Array.isArray(allocationSummary)) {
          sourceArray = allocationSummary;
        } else if (isRecord(allocationSummary)) {
          const summaryRecord = allocationSummary;
          const maybeAlloc =
            summaryRecord.allocation ??
            summaryRecord.alloc ??
            summaryRecord.allocationSummary;
          if (Array.isArray(maybeAlloc)) {
            sourceArray = maybeAlloc;
          }
        }

        if (sourceArray) {
          allocated = sourceArray
            .map((it): AllocatedItem | null => {
              if (!isRecord(it)) return null;

              let parsedMonthIndex: number | undefined;
              const monthIndexVal = it.monthIndex;
              if (typeof monthIndexVal === "number") {
                parsedMonthIndex = monthIndexVal;
              } else if (typeof monthIndexVal === "string") {
                const n = Number(monthIndexVal);
                if (!Number.isNaN(n)) parsedMonthIndex = n;
              }

              let amountVal: number | undefined;
              if (typeof it.amount === "number") {
                amountVal = it.amount;
              } else if (typeof it.principalPaid === "number") {
                amountVal = it.principalPaid;
              } else if (typeof it.apply === "number") {
                amountVal = it.apply;
              }

              let penaltyVal = 0;
              if (typeof it.penaltyPaid === "number") {
                penaltyVal = it.penaltyPaid;
              } else if (typeof it.penaltyApplied === "number") {
                penaltyVal = it.penaltyApplied;
              }

              const ledgerIdVal = toOptString(it.ledgerId);

              return {
                ledgerId: ledgerIdVal,
                monthIndex:
                  typeof parsedMonthIndex === "number" &&
                  !Number.isNaN(parsedMonthIndex)
                    ? Math.round(parsedMonthIndex)
                    : undefined,
                amount:
                  typeof amountVal === "number" &&
                  !Number.isNaN(amountVal)
                    ? amountVal
                    : undefined,
                penaltyApplied:
                  typeof penaltyVal === "number" &&
                  !Number.isNaN(penaltyVal)
                    ? penaltyVal
                    : 0,
              };
            })
            .filter(
              (x): x is AllocatedItem =>
                x !== null &&
                typeof x.amount === "number" &&
                !Number.isNaN(x.amount),
            );
        }
      }
    } catch (e) {
      // non-fatal — ignore parse error and continue
      // eslint-disable-next-line no-console
      console.warn("Failed to parse allocationSummary:", e);
    }

    let imageInfo: ImageInfo | undefined;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      try {
        const fd = await req.formData();
        const file = fd.get("file") as File | null;
        if (file && typeof file.arrayBuffer === "function") {
          const buf = Buffer.from(await file.arrayBuffer());
          const b64 = buf.toString("base64");
          const dataUrl = `data:${file.type || "image/jpeg"};base64,${b64}`;
          try {
            const r = (await uploadBase64Image(
              dataUrl,
              "payments",
            )) as UnknownRecord;
            imageInfo = {
              url: toOptString(r.url),
              public_id: toOptString(r.public_id),
            };
          } catch (e) {
            // non-fatal — continue without image
            // eslint-disable-next-line no-console
            console.warn("cloud upload failed", e);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("error handling multipart file", e);
      }
    }

    type PaymentAllocatedForDoc = {
      ledgerId?: mongoose.Types.ObjectId | string;
      monthIndex?: number;
      amount?: number;
      penaltyApplied?: number;
    };

    const doc: {
      memberId: mongoose.Types.ObjectId;
      groupId: mongoose.Types.ObjectId;
      amount: number;
      type: string;
      reference?: string;
      adminNote?: string;
      allocated?: PaymentAllocatedForDoc[];
      rawMeta: { image?: ImageInfo; createdFrom: string };
      verified: boolean;
      status: string;
      approvedAt: null;
    } = {
      memberId: new mongoose.Types.ObjectId(memberId),
      groupId: new mongoose.Types.ObjectId(groupId),
      amount: Number(amount),
      type: "UPI",
      reference,
      adminNote: note,
      allocated: allocated.length
        ? allocated.map(
            (a): PaymentAllocatedForDoc => ({
              ledgerId:
                a.ledgerId &&
                mongoose.Types.ObjectId.isValid(
                  String(a.ledgerId),
                )
                  ? new mongoose.Types.ObjectId(
                      String(a.ledgerId),
                    )
                  : a.ledgerId,
              monthIndex: a.monthIndex,
              amount: a.amount,
              penaltyApplied: a.penaltyApplied ?? 0,
            }),
          )
        : undefined,
      rawMeta: {
        ...(imageInfo ? { image: imageInfo } : {}),
        createdFrom: "member-request",
      },
      verified: false,
      status,
      approvedAt: null,
    };

    const payment = await Payment.create(doc);
    const saved = await Payment.findById(payment._id).lean();

    return NextResponse.json(
      { success: true, payment: saved },
      { status: 201 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "POST /api/chitgroups/[id]/payments/request error:",
      err,
    );
    const msg =
      err instanceof Error && err.message
        ? err.message
        : String(err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
