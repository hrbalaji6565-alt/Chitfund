"use client";
import { Menu } from "lucide-react";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-white border-b border-[var(--border-color)] shadow-sm px-4 py-3">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">
        Dashboard
      </h1>
      <button className="lg:hidden p-2 rounded-md hover:bg-[var(--bg-highlight)] transition">
        <Menu className="w-6 h-6 text-[var(--text-secondary)]" />
      </button>
    </header>
  );
}
