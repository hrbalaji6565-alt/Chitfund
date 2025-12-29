"use client";

import {
  LayoutDashboard,
  Users,
  Wallet,
  FileText,
  Funnel,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function BottomNav() {
  const pathname = usePathname();
  const [loanOpen, setLoanOpen] = useState(false);

  const links = [
    { href: "/user", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { href: "/user/chit-funds", label: "Chit Funds", icon: <Funnel size={20} /> },
    { href: "/user/profile", label: "Profile", icon: <Users size={20} /> },
    { href: "/user/active-funds", label: "Active Funds", icon: <Wallet size={20} /> },
    { href: "/user/transactions", label: "Txns", icon: <FileText size={20} /> },
  ];

  const isLoanActive =
    pathname.startsWith("/user/loans") ||
    pathname.startsWith("/user/loan-transactions");

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border-color)] shadow-md">
      <div className="relative flex justify-around py-2">
        {/* Normal Links */}
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

        {/* Loan Dropdown */}
        <div className="relative flex flex-col items-center w-20">
          {/* Dropdown Menu */}
          <div
            className={`absolute right-5 bottom-14 w-40 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg overflow-hidden transform transition-all duration-300 ${
              loanOpen
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-2 scale-95 pointer-events-none"
            }`}
          >
            <Link
              href="/user/loans"
              onClick={() => setLoanOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-[var(--bg-highlight)] transition-colors"
            >
              My Loans
            </Link>
            <Link
              href="/user/loan-transactions"
              onClick={() => setLoanOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-[var(--bg-highlight)] transition-colors"
            >
              Loan Transactions
            </Link>
          </div>

          {/* Loan Button */}
          <button
            onClick={() => setLoanOpen((prev) => !prev)}
            className={`flex flex-col items-center text-xs font-medium transition-all ${
              isLoanActive
                ? "text-[var(--color-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
            }`}
          >
            <div className="flex items-center gap-1">
              <FileText size={20} />
              <ChevronUp
                size={14}
                className={`transition-transform duration-300 ${
                  loanOpen ? "rotate-180" : "rotate-0"
                }`}
              />
            </div>
            <span>Loan</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
