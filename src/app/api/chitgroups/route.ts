import dbConnect from "@/app/lib/mongodb";
import ChitGroup, { IChitGroup } from "@/app/models/ChitGroup";
import { NextResponse } from "next/server";

// Create a new chit group
export async function POST(request: Request) {
  try {
    await dbConnect();
    const data: Omit<IChitGroup, "_id"> = await request.json();

    const newGroup = await ChitGroup.create(data);
    return NextResponse.json({ success: true, group: newGroup }, { status: 201 });
  } catch (error) {
    console.error("Error creating chit group:", error);
    return NextResponse.json({ success: false, error: "Failed to create chit group" }, { status: 500 });
  }
}

// Get all chit groups
export async function GET() {
  try {
    await dbConnect();
    const groups = await ChitGroup.find({});
    return NextResponse.json({ success: true, groups });
  } catch (error) {
    console.error("Error fetching chit groups:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch chit groups" }, { status: 500 });
  }
}
