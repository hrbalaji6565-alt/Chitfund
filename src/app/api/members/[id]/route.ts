// app/api/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/app/lib/mongodb";
import Member from "@/app/models/Member";
import ChitGroup from "@/app/models/ChitGroup";
import { uploadBase64Image, destroyByPublicId } from "@/app/lib/cloudinary";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

/** Resolve context.params at runtime (handles Promise params in Next's types). */
async function resolveParams(context: unknown): Promise<{ id: string }> {
  if (!context || typeof context !== "object") throw new Error("Missing route context");
  const ctx = context as Record<string, unknown>;
  const raw = ctx.params as unknown;
  const params = raw instanceof Promise ? (await raw) : raw;
  if (!params || typeof params !== "object" || !("id" in (params as Record<string, unknown>))) {
    throw new Error("Missing params.id");
  }
  return { id: String((params as Record<string, unknown>).id) };
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

type UpdateBody = Partial<{
  name: string;
  mobile: string;
  userId: string;
  password: string;
  joiningDate: string;
  address: string;
  status: "Active" | "Inactive";
  totalPaid: number;
  pendingAmount: number;
  aadhaarImage?: string | null;
  govIdImage?: string | null;
  avatarImage?: string | null;
  group?: string | null | string[];
}>;

// GET /api/members/[id]
export async function GET(_req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: "Invalid member id" }, { status: 400 });

    await dbConnect();
    const member = await Member.findById(id).select("-password").lean();
    if (!member) return NextResponse.json({ success: false, message: "Member not found" }, { status: 404 });
    return NextResponse.json({ success: true, member });
  } catch (err) {
    console.error("GET /api/members/[id] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch member";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// PUT /api/members/[id]
export async function PUT(req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: "Invalid member id" }, { status: 400 });

    const raw: unknown = await req.json().catch(() => ({}));
    const body: UpdateBody = isRecord(raw) ? (raw as UpdateBody) : {};

    await dbConnect();

    const memberDoc = await Member.findById(id);
    if (!memberDoc) return NextResponse.json({ success: false, message: "Member not found" }, { status: 404 });

    // ---------- image handling ----------
    if (typeof body.aadhaarImage === "string" && body.aadhaarImage) {
      if (typeof memberDoc.aadhaarPublicId === "string") await destroyByPublicId(memberDoc.aadhaarPublicId).catch(() => {});
      const r = await uploadBase64Image(body.aadhaarImage, "members/aadhaar");
      memberDoc.aadhaarUrl = r.url;
      memberDoc.aadhaarPublicId = r.public_id;
    }

    if (typeof body.govIdImage === "string" && body.govIdImage) {
      if (typeof memberDoc.govIdPublicId === "string") await destroyByPublicId(memberDoc.govIdPublicId).catch(() => {});
      const r = await uploadBase64Image(body.govIdImage, "members/gov");
      memberDoc.govIdUrl = r.url;
      memberDoc.govIdPublicId = r.public_id;
    }

    if (typeof body.avatarImage === "string" && body.avatarImage) {
      if (typeof memberDoc.avatarPublicId === "string") await destroyByPublicId(memberDoc.avatarPublicId).catch(() => {});
      const r = await uploadBase64Image(body.avatarImage, "members/avatar");
      memberDoc.avatarUrl = r.url;
      memberDoc.avatarPublicId = r.public_id;
    }

    // ---------- simple fields ----------
    if (body.name !== undefined) memberDoc.name = body.name as string;
    if (body.mobile !== undefined) memberDoc.mobile = body.mobile as string;
    if (body.userId !== undefined) memberDoc.userId = body.userId as string;
    if (body.joiningDate !== undefined) memberDoc.joiningDate = body.joiningDate ? new Date(body.joiningDate) : undefined;
    if (body.address !== undefined) memberDoc.address = body.address as string;
    if (body.status !== undefined) memberDoc.status = body.status;
    if (body.totalPaid !== undefined) memberDoc.totalPaid = body.totalPaid as number;
    if (body.pendingAmount !== undefined) memberDoc.pendingAmount = body.pendingAmount as number;

    if (body.password) {
      const salt = await bcrypt.genSalt(10);
      memberDoc.password = await bcrypt.hash(body.password, salt);
    }

    // ---------- membership changes ----------
    if (Object.prototype.hasOwnProperty.call(body, "group")) {
      // normalize previous groups from memberDoc (supports both legacy `group` and new `groups`)
      const prevGroups: string[] = (() => {
        const g = memberDoc.get("groups");
        if (Array.isArray(g)) return g.map(String);
        const single = memberDoc.get("group");
        if (single) return [String(single)];
        return [];
      })();

      const ensureMemberInGroup = async (groupIdStr: string) => {
        if (!isValidObjectId(groupIdStr)) return;
        const g = await ChitGroup.findById(groupIdStr);
        if (!g) throw new Error(`Group ${groupIdStr} not found`);
        const membersArr = Array.isArray(g.members) ? g.members.map(String) : [];
        if (!membersArr.includes(String(memberDoc._id))) {
          await ChitGroup.findByIdAndUpdate(groupIdStr, { $addToSet: { members: memberDoc._id } });
        }
      };

      const removeMemberFromGroupById = async (groupIdStr: string) => {
        if (!isValidObjectId(groupIdStr)) return;
        await ChitGroup.findByIdAndUpdate(groupIdStr, { $pull: { members: memberDoc._id } }).catch(() => {});
      };

      if (Array.isArray(body.group)) {
        const requested = (body.group as Array<unknown>).filter(isValidObjectId).map(String);
        const toAdd = requested.filter((id) => !prevGroups.includes(id));
        const toRemove = prevGroups.filter((id) => !requested.includes(id));

        await Promise.all(toRemove.map((gId) => removeMemberFromGroupById(gId)));
        await Promise.all(toAdd.map((gId) => ensureMemberInGroup(gId)));

        // persist to memberDoc
        if (memberDoc.schema.path("groups")) {
          memberDoc.set("groups", requested.map((id) => new mongoose.Types.ObjectId(id)));
        } else {
          memberDoc.set("group", requested.length ? new mongoose.Types.ObjectId(requested[0]) : undefined);
          memberDoc.set("groupName", undefined);
        }
      } else if (body.group === null) {
        // remove from all
        await Promise.all(prevGroups.map((gId) => removeMemberFromGroupById(gId)));
        if (memberDoc.schema.path("groups")) {
          memberDoc.set("groups", []);
        } else {
          memberDoc.set("group", undefined);
          memberDoc.set("groupName", undefined);
        }
      } else if (typeof body.group === "string") {
        const newGroupId = body.group;
        if (!isValidObjectId(newGroupId)) {
          return NextResponse.json({ success: false, message: "Invalid group id" }, { status: 400 });
        }

        if (!prevGroups.includes(newGroupId)) {
          await ensureMemberInGroup(newGroupId);
          const current = memberDoc.get("groups");
          if (Array.isArray(current)) {
            const merged = Array.from(new Set([...current.map(String), newGroupId]));
            memberDoc.set("groups", merged.map((s) => new mongoose.Types.ObjectId(s)));
          } else if (memberDoc.get("group")) {
            const prev = String(memberDoc.get("group"));
            memberDoc.set("groups", [new mongoose.Types.ObjectId(prev), new mongoose.Types.ObjectId(newGroupId)]);
            memberDoc.set("group", undefined);
          } else {
            if (memberDoc.schema.path("groups")) {
              memberDoc.set("groups", [new mongoose.Types.ObjectId(newGroupId)]);
            } else {
              memberDoc.set("group", new mongoose.Types.ObjectId(newGroupId));
            }
          }
        }

        const newGroup = await ChitGroup.findById(newGroupId).lean();
        if (newGroup && !memberDoc.schema.path("groups")) {
          memberDoc.set("groupName", newGroup.name || undefined);
        } else {
          memberDoc.set("groupName", undefined);
        }
      }
    }

    await memberDoc.save();

    const obj = memberDoc.toObject();
    if (Object.prototype.hasOwnProperty.call(obj, "password")) delete (obj as unknown as Record<string, unknown>).password;
    return NextResponse.json({ success: true, member: obj });
  } catch (err) {
    console.error("PUT /api/members/[id] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update member";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

// DELETE /api/members/[id]
export async function DELETE(_req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: "Invalid member id" }, { status: 400 });

    await dbConnect();
    const member = await Member.findById(id);
    if (!member) return NextResponse.json({ success: false, message: "Member not found" }, { status: 404 });

    const groupsField = member.get("groups");
    if (Array.isArray(groupsField) && groupsField.length) {
      await Promise.all(groupsField.map((gId) => ChitGroup.findByIdAndUpdate(String(gId), { $pull: { members: member._id } }).catch(() => {})));
    } else if (member.get("group")) {
      await ChitGroup.findByIdAndUpdate(String(member.get("group")), { $pull: { members: member._id } }).catch(() => {});
    }

    if (typeof member.aadhaarPublicId === "string") await destroyByPublicId(member.aadhaarPublicId).catch(() => {});
    if (typeof member.govIdPublicId === "string") await destroyByPublicId(member.govIdPublicId).catch(() => {});
    if (typeof member.avatarPublicId === "string") await destroyByPublicId(member.avatarPublicId).catch(() => {});

    await member.deleteOne();

    return NextResponse.json({ success: true, message: "Member deleted" });
  } catch (err) {
    console.error("DELETE /api/members/[id] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to delete member";
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
