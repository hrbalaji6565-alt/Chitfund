"use client";

import React from "react";
import { Bell, LogOut, Search, Settings, User } from "lucide-react";
import Button from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdownMenu";
import { Avatar, AvatarFallback } from "@/app/components/ui/avtar";
import { useRouter } from "next/navigation";

export default function Topbar() {
  const router = useRouter();
  return (
    <header className="w-full sticky top-0 z-50 bg-[var(--bg-main)] border-b border-[var(--border-color)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between px-6 py-3">
        {/* Logo Section */}
        <div className="flex items-center gap-2 lg:mx-0">
          <User className="text-[var(--color-primary)]" />
          <h1 className="text-lg font-bold text-[var(--color-primary)]">
            Cronnis <span className="text-[var(--color-secondary)]">Chits</span>
          </h1>
        </div>
        {/* Actions Section */}
        <div className="flex items-center gap-4 mt-2 md:mt-0">
      {/* Search Box */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          type="text"
          placeholder="Search Members, Chits, Transactions..."
          className="pl-9 pr-4 py-2 text-sm rounded-md border border-[var(--border-color)] w-full
                     bg-[var(--bg-main)] text-[var(--text-primary)]
                     focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                     transition-all"
        />
      </div>

      {/* Notification Button */}
      <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-[var(--bg-highlight)]">
        <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-secondary)] rounded-full"></span>
      </Button>

      {/* User Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar>
              <AvatarFallback className="bg-[var(--gradient-primary)] text-[var(--text-light)]">
                AD
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-[var(--bg-main)] border border-[var(--border-color)] shadow-md" align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">User</p>
              <p className="text-xs text-[var(--text-secondary)]">user@chitfund.com</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[var(--border-color)]" />
          <DropdownMenuItem className="hover:bg-[var(--bg-highlight)]">
            <User className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:bg-[var(--bg-highlight)]">
            <Settings className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--border-color)]" />
          <DropdownMenuItem
            className="hover:bg-[var(--bg-highlight)]"
            onClick={() => {
              router.push('/');
            }}
          >
            <LogOut className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
  </header>
  );
}