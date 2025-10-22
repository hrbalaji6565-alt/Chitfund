"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  BarChart2,
  FileText,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => setIsOpen(false), [pathname]);

  // Updated link class with gradient for active link
  const linkClass = (href: string) =>
    `flex items-center gap-2 px-3 py-4 rounded-md text-sm font-medium transition-all duration-200 ${
      pathname === href
        ? "bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-xl font-semibold shadow-lg hover:from-blue-600 hover:to-green-600 hover:shadow-xl"
        : "text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-highlight)]"
    }`;

  const links = [
    { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { href: "/admin/chit-groups", label: "Chit Groups", icon: <LayoutDashboard size={16} /> },
    { href: "/admin/members", label: "Members", icon: <Users size={16} /> },
    { href: "/admin/chits", label: "Chit Plans", icon: <Wallet size={16} /> },
    { href: "/admin/transactions", label: "Transactions", icon: <FileText size={16} /> },
    { href: "/admin/collection", label: "Collection", icon: <FileText size={16} /> },
    { href: "/admin/invoice", label: "Invoices", icon: <FileText size={16} /> },
    { href: "/admin/reports", label: "Reports", icon: <BarChart2 size={16} /> },
  ];

  const SidebarContent = () => (
    <nav className="py-6 px-4 flex flex-col justify-between h-full mt-0 lg:mt-15">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-6">
          Cronnis Money Maven Chits
        </h2>
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
        <button className="flex items-center gap-2 px-3 py-2 w-full text-red-600 hover:bg-red-100 rounded-md transition-all duration-200">
          <LogOut size={16} />
          Logout
        </button>
        <footer className="px-3 py-3 text-xs text-gray-500 border-t border-[var(--border-color)] mt-4">
          © {new Date().getFullYear()} Cronnis Money Maven Chits
        </footer>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden fixed top-2 left-0 right-0 z-50 px-4 py-3 w-20">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-[var(--text-primary)]"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col justify-between w-64 bg-[var(--color-white)] border-r border-[var(--border-color)] min-h-screen fixed left-0 top-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
              ref={sidebarRef}
              className="fixed inset-y-0 left-0 z-50 bg-[var(--color-white)] w-64 shadow-lg flex flex-col justify-between"
            >
              <SidebarContent />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setIsOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
