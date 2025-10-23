"use client";
import { Home, User, Layers } from "lucide-react";
import Link from "next/link";

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around bg-white border-t border-[var(--border-color)] py-2 shadow-md">
      <Link href="/user" className="flex flex-col items-center text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition">
        <User size={20} />
        <span className="text-xs">User</span>
      </Link>
      <Link href="/collection" className="flex flex-col items-center text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition">
        <Layers size={20} />
        <span className="text-xs">Collection</span>
      </Link>
    </nav>
  );
}
