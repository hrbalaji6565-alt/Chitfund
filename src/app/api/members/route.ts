import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import Member, { IMember } from "@/app/models/Member";
import ChitGroup from "@/app/models/ChitGroup";
import { uploadBase64Image } from "@/app/lib/cloudinary";
import mongoose from "mongoose";

type CreateBody = {
  name: string;
  mobile: string;
  email: string;
  password: string;
  joiningDate?: string;
  address?: string;
  status?: "Active" | "Inactive";
  totalPaid?: number;
  pendingAmount?: number;
  aadhaarImage?: string | null;
  govIdImage?: string | null;
  avatarImage?: string | null;
  groupId?: string | null;
  groups?: string[] | null;
};

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function toString(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return undefined;
}

export async function GET() {
  try {
    await dbConnect();
    const members = await Member.find({})
      .select("-password")
      .populate("group", "name")
      .lean();

    const normalized = (members || []).map((m) => {
      const rec = isRecord(m) ? (m as Record<string, unknown>) : {};

      let groups: string[] = [];
      if (Array.isArray(rec["groups"])) {
        groups = (rec["groups"] as Array<unknown>).map(toString).filter(Boolean) as string[];
      }
      if (Array.isArray(rec["groupIds"])) {
        groups = (rec["groupIds"] as Array<unknown>).map(toString).filter(Boolean) as string[];
      }

      if (isRecord(rec["group"])) {
        const g = rec["group"] as Record<string, unknown>;
        if (typeof g._id === "string") groups.unshift(g._id);
      }

      const memberObj: Record<string, unknown> = { ...rec };

      if (groups.length) {
        memberObj.groups = groups;
        memberObj.groupId = groups[0];
      } else if (typeof rec["group"] === "string") {
        memberObj.groupId = rec["group"];
      }

      return memberObj;
    });

    return NextResponse.json({ success: true, members: normalized });
  } catch (err) {
    console.error("GET /api/members error:", err);
    return NextResponse.json({ success: false, message: "Failed to fetch members" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const raw: unknown = await req.json();
    if (!isRecord(raw)) {
      return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
    }

    const body = raw as Record<string, unknown>;

    const name = toString(body.name) ?? "";
    const email = toString(body.email) ?? "";
    const password = toString(body.password) ?? "";
    const mobile = toString(body.mobile) ?? "";

    if (!name || !email || !password || !mobile) {
      return NextResponse.json({ success: false, message: "name, email, mobile and password are required" }, { status: 400 });
    }

    await dbConnect();

    const exists = await Member.findOne({ email }).lean();
    if (exists) return NextResponse.json({ success: false, message: "Email already registered" }, { status: 409 });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const uploaded: Record<string, string | undefined> = {};

    const aadhaarBase = typeof body.aadhaarImage === "string" ? body.aadhaarImage : undefined;
    const govBase = typeof body.govIdImage === "string" ? body.govIdImage : undefined;
    const avatarBase = typeof body.avatarImage === "string" ? body.avatarImage : undefined;

    if (aadhaarBase) {
      const r = await uploadBase64Image(aadhaarBase, "members/aadhaar");
      uploaded.aadhaarUrl = r.url;
      uploaded.aadhaarPublicId = r.public_id;
    }

    if (govBase) {
      const r = await uploadBase64Image(govBase, "members/gov");
      uploaded.govIdUrl = r.url;
      uploaded.govIdPublicId = r.public_id;
    }

    if (avatarBase) {
      const r = await uploadBase64Image(avatarBase, "members/avatar");
      uploaded.avatarUrl = r.url;
      uploaded.avatarPublicId = r.public_id;
    }

    const memberData: Partial<IMember> = {
      name,
      mobile,
      email,
      password: hashed,
      joiningDate: body.joiningDate ? new Date(String(body.joiningDate)) : undefined,
      address: typeof body.address === "string" ? body.address : undefined,
      status: (body.status === "Inactive" ? "Inactive" : "Active"),
      totalPaid: typeof body.totalPaid === "number" ? body.totalPaid : 0,
      pendingAmount: typeof body.pendingAmount === "number" ? body.pendingAmount : 0,
      aadhaarUrl: uploaded.aadhaarUrl,
      aadhaarPublicId: uploaded.aadhaarPublicId,
      govIdUrl: uploaded.govIdUrl,
      govIdPublicId: uploaded.govIdPublicId,
      avatarUrl: uploaded.avatarUrl,
      avatarPublicId: uploaded.avatarPublicId,
    };

    const groupsToAssign: string[] = [];
    if (Array.isArray(body.groups)) {
      (body.groups as Array<unknown>).forEach((g) => {
        if (isValidObjectId(g)) groupsToAssign.push(String(g));
      });
    } else if (isValidObjectId(body.groupId)) {
      groupsToAssign.push(String(body.groupId));
    }

    if (groupsToAssign.length) {
      (memberData as Record<string, unknown>).groups = groupsToAssign.map((g) => new mongoose.Types.ObjectId(g));
    }

    const newMember = await Member.create(memberData as Partial<IMember>);

    if (groupsToAssign.length) {
      await ChitGroup.updateMany(
        { _id: { $in: groupsToAssign } },
        { $addToSet: { members: newMember._id } }
      );
    }

    // Convert to a broadly-typed plain object for safe manipulation without asserting index signatures on IMember
    const memberPlain = newMember.toObject();
    const memberObj = memberPlain as unknown as Record<string, unknown>;

    // remove sensitive fields
    if (memberObj.password) delete memberObj.password;

    // normalize groups/groupId for frontend convenience
    if (Array.isArray(memberObj.groups)) {
      memberObj.groups = (memberObj.groups as Array<unknown>).map(String);
      memberObj.groupId = (memberObj.groups as string[])[0];
    } else if (memberObj.group) {
      memberObj.groupId = String(memberObj.group);
    }

    return NextResponse.json({ success: true, member: memberObj }, { status: 201 });
  } catch (err) {
    console.error("POST /api/members error:", err);
    return NextResponse.json({ success: false, message: "Failed to create member" }, { status: 500 });
  }
}
