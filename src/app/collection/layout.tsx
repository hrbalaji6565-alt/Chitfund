"use client";

import "../globals.css";
import BottomNav from "./components/bottomnav";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  // undefined = loading / unresolved, false = explicitly not logged in, true = logged in
  const [hasCollectionUser, setHasCollectionUser] = useState<boolean | undefined>(undefined);

  // Client par collection user check karo (sirf localStorage, koi URL hit nahi)
  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        setHasCollectionUser(false);
        return;
      }

      const raw = localStorage.getItem("collectionUser");
      if (raw) {
        // Optional: basic JSON validate
        try {
          const parsed = JSON.parse(raw) as {
            id?: string;
            name?: string;
            email?: string;
          };
          if (parsed && (parsed.id || parsed.email || parsed.name)) {
            setHasCollectionUser(true);
            return;
          }
        } catch {
          // parse fail -> treat as not logged in
        }
      }
      setHasCollectionUser(false);
    } catch {
      setHasCollectionUser(false);
    }
  }, []);

  // Agar confirm ho gaya ki collection user nahi hai to login pe bhej do
  useEffect(() => {
    if (hasCollectionUser === false) {
      router.replace("/");
    }
  }, [hasCollectionUser, router]);

  // Loading state: same idea as AdminLayout — skeleton dikhate hain
  if (hasCollectionUser === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-main)]">
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

  // Redirect trigger ho chuka hoga, protected UI flash nahi karna
  if (hasCollectionUser === false) {
    return null;
  }

  // Yaha tak aaya matlab collection user logged-in hai
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)]">
     <Topbar />
      <div className="flex flex-1">
        {/* Sidebar visible only on large screens */}
        <Sidebar />

        {/* Main content adjusts padding when sidebar visible */}
        <main className="flex-1 p-0 md:p-6 overflow-y-auto bg-[var(--bg-main)] lg:ml-64 pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
