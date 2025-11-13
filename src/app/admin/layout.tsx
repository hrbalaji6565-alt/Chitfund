"use client";

import "../globals.css";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  // Read token from Redux store (may be undefined on initial render)
  const reduxToken = useSelector((state: unknown) =>
    (state as { admin?: { token?: string | null } })?.admin?.token ?? null
  ) as string | null;

  // Keep clientToken as undefined while we haven't resolved it yet.
  // undefined = loading / unresolved, null = explicitly no token, string = token present
  const [clientToken, setClientToken] = useState<string | null | undefined>(undefined);

  // Resolve token on client — prefer Redux value, fallback to localStorage
  useEffect(() => {
    // If redux already has a token, use it immediately
    if (reduxToken) {
      setClientToken(reduxToken);
      return;
    }

    // Otherwise attempt to read localStorage on client
    try {
      const ls = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
      setClientToken(ls);
    } catch (err) {
      // fail-safe: treat as no token
      setClientToken(null);
    }
  }, [reduxToken]);

  // Redirect to login if we know there is no token (do it in effect)
  useEffect(() => {
    if (clientToken === null) {
      // replace so user can't go back to protected route
      router.replace("/");
    }
  }, [clientToken, router]);

  // While we don't know token yet, render a stable skeleton to avoid hydration mismatch.
  // IMPORTANT: return a consistent DOM shape instead of `null` to reduce hydration mismatches.
  if (clientToken === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-neutral)]">
        {/* Topbar skeleton */}
        <div className="h-14 bg-[var(--bg-card)]/30 animate-pulse" />
        <div className="flex flex-1">
          {/* Sidebar skeleton */}
          <aside className="w-64 hidden lg:block bg-[var(--bg-card)]/30 animate-pulse" />
          {/* Main content skeleton */}
          <main className="flex-1 p-6">
            <div className="h-6 bg-[var(--bg-card)]/30 rounded mb-4 animate-pulse" />
            <div className="space-y-3">
              <div className="h-40 bg-[var(--bg-card)]/30 rounded animate-pulse" />
              <div className="h-40 bg-[var(--bg-card)]/30 rounded animate-pulse" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // If clientToken is null, we've triggered redirect; render nothing to avoid flashing protected UI.
  if (clientToken === null) {
    return null;
  }

  // At this point, clientToken is a string and user is authorized — render the real layout.
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
