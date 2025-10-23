"use client";
import React from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileText,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      pathname === href
        ? "bg-[var(--btn-primary-bg)] text-[var(--text-light)] shadow-md"
        : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-highlight)]"
    }`;

  const links = [
    { href: "/user", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { href: "/user/chit-funds", label: "Chit Funds", icon: <Users size={16} /> },
    { href: "/user/profile", label: "Profile", icon: <Users size={16} /> },
    { href: "/user/active-funds", label: "Active Funds", icon: <Wallet size={16} /> },
    { href: "/user/transactions", label: "Transactions", icon: <FileText size={16} /> },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 bg-[var(--bg-card)] border-r border-[var(--border-color)] min-h-screen fixed left-0 top-0">
      <nav className="py-6 px-4 flex flex-col justify-between h-full mt-12">
        <div>
          <ul className="space-y-1">
            {links.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass(item.href)}>
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <button className="flex items-center gap-2 px-3 py-2 w-full text-[var(--color-primary)] hover:bg-[var(--bg-highlight)] rounded-md transition-all duration-200">
            <LogOut size={16} />
            Logout
          </button>
          <footer className="px-3 py-3 text-xs text-[var(--text-secondary)] border-t border-[var(--border-color)] mt-4">
            © {new Date().getFullYear()} Cronnis Money Maven Chits
          </footer>
        </div>
      </nav>
    </aside>
  );
};

export default Sidebar;
