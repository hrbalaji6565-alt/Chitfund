import dbConnect from "@/app/lib/mongodb";
import ChitGroup from "@/app/models/ChitGroup";
import Member from "@/app/models/Member";
import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";

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
    const group = await ChitGroup.findById(id).populate("members", "name email mobile").lean();
    if (!group) {
      return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, group });
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

    // if members provided, reconcile member lists
    if (Array.isArray(updatesObj.members)) {
      const incomingMemberIds = (updatesObj.members as unknown[])
        .filter(isValidObjectId)
        .map(String);

      const group = await ChitGroup.findById(id).lean();
      if (!group) {
        return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
      }

      const currentMembers = Array.isArray(group.members) ? (group.members as unknown[]).map(String) : [];

      const toAdd = incomingMemberIds.filter((x) => !currentMembers.includes(x));
      const toRemove = currentMembers.filter((x) => !incomingMemberIds.includes(x));

      // update group's members array
      await ChitGroup.findByIdAndUpdate(id, { members: incomingMemberIds }, { new: true });

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
