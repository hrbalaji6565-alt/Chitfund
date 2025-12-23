// /app/api/admin/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/app/lib/mongodb";
import User from "@/app/models/User";
import { signToken } from "@/app/lib/jwt";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        await dbConnect();

        // Find only admin user
        const admin = await User.findOne({ email, role: "admin" });
        if (!admin) {
            return NextResponse.json(
                { success: false, message: "Admin not found or not authorized" },
                { status: 401 }
            );
        }

        // Check password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return NextResponse.json(
                { success: false, message: "Invalid password" },
                { status: 401 }
            );
        }

        // Generate JWT token
        const token = signToken({
            id: admin._id,
            email: admin.email,
            role: admin.role,
        });

        // Send cookie
        const response = NextResponse.json({
            success: true,
            message: "Login successful",
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
            },
        });

        response.cookies.set("adminToken", token, {
            httpOnly: true,        // secure server-only
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 24 * 60 * 60 * 30,  // 30 days
        });

        return response;
    } catch (error) {
        console.error("Admin Login Error:", error);
        return NextResponse.json(
            { success: false, message: "Server error" },
            { status: 500 }
        );
    }
} 
