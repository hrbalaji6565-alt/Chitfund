// src/app/api/seed/test-admin/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import User from "@/app/models/User";

export async function POST() {
  try {
    await dbConnect();

    // Check if test admin already exists
    const existingAdmin = await User.findOne({ email: "admin@test.com" });
    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: "Test admin already exists",
        admin: {
          email: "admin@test.com",
          name: "Test Admin",
          role: "admin"
        }
      });
    }

    // Create test admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    const testAdmin = await User.create({
      name: "Test Admin",
      email: "admin@test.com",
      password: hashedPassword,
      phone: "9876543210",
      verified: true,
      role: "admin"
    });

    return NextResponse.json({
      success: true,
      message: "Test admin created successfully",
      admin: {
        id: testAdmin._id,
        email: testAdmin.email,
        name: testAdmin.name,
        role: testAdmin.role
      }
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating test admin:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to create test admin",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}