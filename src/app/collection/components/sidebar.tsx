"use client";
import { Home, User, Layers } from "lucide-react";
import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:w-64 flex-col bg-white border-r border-[var(--border-color)] shadow-sm">
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/user" className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-highlight)] transition">
          <User size={18} /> User Dashboard
        </Link>
        <Link href="/collection" className="flex items-center gap-2 p-2 rounded-md hover:bg-[var(--bg-highlight)] transition">
          <Layers size={18} /> Collection Dashboard
        </Link>
      </nav>
    </aside>
  );
}
