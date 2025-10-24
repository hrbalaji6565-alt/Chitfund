"use client";

import { LayoutDashboard, Users, Wallet, FileText, Funnel } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const links = [
    { href: "/user", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { href: "/user/chit-funds", label: "Chit Funds", icon: <Funnel size={20} /> },
    { href: "/user/profile", label: "Profile", icon: <Users size={20} /> },
    { href: "/user/active-funds", label: "Active Funds", icon: <Wallet size={20} /> },
    { href: "/user/transactions", label: "Txns", icon: <FileText size={20} /> },
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
