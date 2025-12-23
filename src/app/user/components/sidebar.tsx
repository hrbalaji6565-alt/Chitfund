"use client";
import React, { useState } from "react";
import type { JSX } from 'react';
import {
  LayoutDashboard,
  Users,
  Wallet,
  FileText,
  LogOut,
  ListCollapseIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { logoutMember } from "@/store/memberAuthSlice";
import type { AppDispatch } from "@/store/store";
import { useDispatch } from "react-redux";

interface SidebarLink {
  href: string;
  label: string;
  icon: JSX.Element;
}

interface SidebarLinkWithChildren extends SidebarLink {
  children?: SidebarLink[];
}

const Sidebar: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      pathname === href
        ? "bg-[var(--btn-primary-bg)] text-[var(--text-light)] shadow-md"
        : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-highlight)]"
    }`;

  const links: SidebarLinkWithChildren[] = [
    { href: "/user", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { href: "/user/chit-funds", label: "Chit Funds", icon: <Users size={16} /> },
    { href: "/user/profile", label: "Profile", icon: <Users size={16} /> },
    { href: "/user/active-funds", label: "Active Funds", icon: <Wallet size={16} /> },
    { href: "/user/transactions", label: "Transactions", icon: <FileText size={16} /> },
    { 
      href: "/user/loan", 
      label: "Loan", 
      icon: <FileText size={16} />,
      children: [
        { href: "/user/loans", label: "My Loans", icon: <FileText size={14} /> },
        { href: "/user/loan-transactions", label: "Loan Transaction", icon: <FileText size={14} /> },
      ]
    },
  ];
   const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
    const handleLogout = async () => {
        try {
          await dispatch(logoutMember()).unwrap();
        } catch {
          // continue cleaning client state even if logout request failed
        }
        try {
          localStorage.removeItem("member");
          localStorage.removeItem("memberToken");
        } catch {}
        toast.success("Logged out successfully!");
        // go to unified auth page (root). middleware will prevent /user access afterward.
        router.replace("/");
      };

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 bg-[var(--bg-card)] border-r border-[var(--border-color)] min-h-screen fixed left-0 top-0">
      <nav className="py-6 px-4 flex flex-col justify-between h-full mt-12">
        <div>
          <ul className="space-y-1">
            {links.map((item) => (
              <li key={item.href}>
                {item.children ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedSections((prev) => ({ ...prev, [item.href]: !prev[item.href] }))}
                      className={`w-full text-left flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${((item.children || []).some(c => c.href === pathname) || pathname === item.href) ? "bg-[var(--btn-primary-bg)] text-[var(--text-light)] shadow-md" : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-highlight)]"}`}
                    >
                      <span className="flex items-center gap-2">
                        {item.icon}
                        {item.label}
                      </span>
                      <span className="opacity-70">
                        <ListCollapseIcon size={14} className={`${expandedSections[item.href] ? 'rotate-90 transform' : ''} transition-transform`} />
                      </span>
                    </button>
                    <AnimatePresence>
                      {expandedSections[item.href] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                          className="overflow-hidden mt-1 ml-4"
                        >
                          <ul className="space-y-1">
                            {item.children.map((c) => (
                              <li key={c.href}>
                                <Link
                                  href={c.href}
                                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${pathname === c.href ? "bg-[var(--btn-primary-bg)] text-[var(--text-light)] shadow-md" : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-highlight)]"}`}
                                >
                                  {c.icon}
                                  <span className="text-sm">{c.label}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link href={item.href} className={linkClass(item.href)}>
                    {item.icon}
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <button onClick={() => handleLogout()} className="flex items-center gap-2 px-3 py-2 w-full text-[var(--color-primary)] hover:bg-[var(--bg-highlight)] rounded-md transition-all duration-200">
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
