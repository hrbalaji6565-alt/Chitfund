"use client";

import { LayoutDashboard, Users, Wallet, FileText, Funnel } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const links = [
      { href: "/collection", label: "Collection Dhd", icon: <LayoutDashboard size={16} /> },
      { href: "/collection/Profile", label: "Profile", icon: <Users size={16} /> },
      { href: "/collection/Collection", label: "Collection", icon: <FileText size={16} /> },
    ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-around bg-[var(--bg-card)] border-t border-[var(--border-color)] py-2 shadow-md">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center text-xs font-medium transition-all w-20 ${
            pathname === item.href
              ? "text-[var(--color-primary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
