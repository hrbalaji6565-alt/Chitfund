import dbConnect from "@/app/lib/mongodb";
import ChitGroup from "@/app/models/ChitGroup";
import Member from "@/app/models/Member";
import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import {
  createSlotId,
  normalizeGroupMemberSlots,
  slotsToStoredMembers,
  uniqueMemberIds,
} from "@/app/lib/groupSlots";

/**
 * Helper: runtime-safe extractor for `context.params`.
 * Next's internal types sometimes use `params` as a Promise<{ id: string }>.
 * We accept `unknown` and safely resolve it to `{ id: string }`.
 */
async function resolveParams(context: unknown): Promise<{ id: string }> {
  if (!context || typeof context !== "object") {
    throw new Error("Missing route context");
  }
  const ctx = context as Record<string, unknown>;
  const raw = ctx.params as unknown;

  // if params is a Promise, await it
  const params = raw instanceof Promise ? (await raw) : raw;

  if (!params || typeof params !== "object" || !("id" in (params as Record<string, unknown>))) {
    throw new Error("Missing params.id");
  }

  const id = String((params as Record<string, unknown>).id);
  return { id };
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

// GET /api/chitgroups/[id]
export async function GET(_req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid group id" }, { status: 400 });
    }

    await dbConnect();
    const group = await ChitGroup.findById(id).lean();
    if (!group) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

    const slots = normalizeGroupMemberSlots((group as Record<string, unknown>).members);
    const memberIds = uniqueMemberIds(slots);
    const memberDocs = memberIds.length
      ? await Member.find({ _id: { $in: memberIds } }).select("name email mobile").lean()
      : [];
    const memberMap = new Map<string, Record<string, unknown>>();
    for (const m of memberDocs as Record<string, unknown>[]) {
      memberMap.set(String(m._id), m);
    }

    const membersWithProfile = slots.map((s) => {
      const profile = memberMap.get(s.memberId);
      return {
        memberId: s.memberId,
        _id: s.memberId,
        slotId: s.slotId,
        name: profile?.name,
        email: profile?.email,
        mobile: profile?.mobile,
      };
    });

    return NextResponse.json({
      success: true,
      group: {
        ...group,
        members: membersWithProfile,
      },
    });
  } catch (error) {
    console.error("Error fetching group:", error);
    const msg = error instanceof Error ? error.message : "Failed to fetch group";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT /api/chitgroups/[id]
export async function PUT(request: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid group id" }, { status: 400 });
    }

    await dbConnect();

    const rawBody = await request.json().catch(() => ({}));
    const updatesObj = (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody))
      ? (rawBody as Record<string, unknown>)
      : {};

    // if members provided, reconcile member lists (supports duplicate member slots)
    if (Array.isArray(updatesObj.members)) {
      const incomingMemberIds = (updatesObj.members as unknown[]).map((m) => {
        if (typeof m === "string" || typeof m === "number") return String(m);
        if (m && typeof m === "object") {
          const rec = m as Record<string, unknown>;
          return String(rec.memberId ?? rec._id ?? rec.id ?? "");
        }
        return "";
      }).filter(isValidObjectId);

      const group = await ChitGroup.findById(id).lean();
      if (!group) {
        return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
      }

      const currentSlots = normalizeGroupMemberSlots((group as Record<string, unknown>).members);
      const existingByMember = new Map<string, string[]>();
      for (const slot of currentSlots) {
        const arr = existingByMember.get(slot.memberId) ?? [];
        arr.push(slot.slotId);
        existingByMember.set(slot.memberId, arr);
      }

      const nextSlots = incomingMemberIds.map((mid, idx) => {
        const arr = existingByMember.get(mid) ?? [];
        const existingSlot = arr.shift();
        if (arr.length) existingByMember.set(mid, arr);
        else existingByMember.delete(mid);
        return {
          memberId: mid,
          slotId: existingSlot ?? createSlotId(mid, idx + 1),
        };
      });

      const prevUnique = new Set(uniqueMemberIds(currentSlots));
      const nextUnique = new Set(uniqueMemberIds(nextSlots));

      const toAdd = Array.from(nextUnique).filter((x) => !prevUnique.has(x));
      const toRemove = Array.from(prevUnique).filter((x) => !nextUnique.has(x));

      // update group's members array
      await ChitGroup.findByIdAndUpdate(id, { members: slotsToStoredMembers(nextSlots) }, { new: true });

      // add group id to newly added members
      if (toAdd.length) {
        await Member.updateMany(
          { _id: { $in: toAdd } },
          { $addToSet: { groups: new mongoose.Types.ObjectId(id) } }
        );
      }

      // pull group id from removed members
      if (toRemove.length) {
        await Member.updateMany(
          { _id: { $in: toRemove } },
          { $pull: { groups: new mongoose.Types.ObjectId(id) } }
        );
      }
    }

    // apply other updates but avoid overwriting members again
    const filteredUpdates: Record<string, unknown> = { ...updatesObj };
    if (Object.prototype.hasOwnProperty.call(filteredUpdates, "members")) {
      delete filteredUpdates.members;
    }

    const updatedGroup = await ChitGroup.findByIdAndUpdate(id, filteredUpdates, { new: true });
    if (!updatedGroup) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, group: updatedGroup });
  } catch (error) {
    console.error("Error updating group:", error);
    const msg = error instanceof Error ? error.message : "Failed to update group";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/chitgroups/[id]
export async function DELETE(_req: NextRequest, context: unknown) {
  try {
    const { id } = await resolveParams(context);
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid group id" }, { status: 400 });
    }

    await dbConnect();
    const deletedGroup = await ChitGroup.findByIdAndDelete(id);
    if (!deletedGroup) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }

    // remove this group from all members.groups
    await Member.updateMany(
      { groups: deletedGroup._id },
      { $pull: { groups: deletedGroup._id } }
    );

    return NextResponse.json({ success: true, message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error deleting group:", error);
    const msg = error instanceof Error ? error.message : "Failed to delete group";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
