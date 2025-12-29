// src/app/api/seed/test-member/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import Member from "@/app/models/Member";

export async function POST() {
  try {
    await dbConnect();

    // Check if test member already exists
    const existingMember = await Member.findOne({ userId: "testuser" });
    if (existingMember) {
      return NextResponse.json({
        success: true,
        message: "Test member already exists",
        member: {
          userId: "testuser",
          name: "Test User",
          mobile: "1234567890"
        }
      });
    }

    // Create test member
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("password123", salt);

    const testMember = await Member.create({
      name: "Test User",
      mobile: "1234567890",
      userId: "testuser",
      password: hashedPassword,
      status: "Active",
      totalPaid: 0,
      pendingAmount: 0,
      role: "user"
    });

    return NextResponse.json({
      success: true,
      message: "Test member created successfully",
      member: {
        id: testMember._id,
        userId: testMember.userId,
        name: testMember.name,
        mobile: testMember.mobile,
        status: testMember.status
      }
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating test member:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to create test member",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}