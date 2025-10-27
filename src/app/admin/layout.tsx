"use client";

import "../globals.css";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useEffect } from "react";



export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Get token from Redux or localStorage (fallback)
 const token =
  useSelector((state: unknown) => (state as { admin: { token: string | null } }).admin.token) ||
  (typeof window !== "undefined" && localStorage.getItem("adminToken"));


  // 🔒 Redirect to login if no token
  useEffect(() => {
    if (!token) {
      router.replace("/");
    }
  }, [token, router]);

  // If token not found yet, avoid flashing content
  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
      {/* Topbar */}
      <Topbar />

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6 lg:ml-64 overflow-y-auto bg-[var(--color-neutral)]">
          {children}
        </main>
      </div>
    </div>
  );
}
