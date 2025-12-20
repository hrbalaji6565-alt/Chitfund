"use client";

import "../globals.css";
import BottomNav from "./components/bottomnav";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)]">
      <Topbar />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-0 md:p-6 overflow-y-auto bg-[var(--bg-main)] lg:ml-64 pb-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
