"use client";

import React, { useEffect, useState } from "react";
import { Bell, LogOut, Search, Settings, User as UserIcon } from "lucide-react";
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
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { logoutMember } from "@/store/memberAuthSlice";
import type { AppDispatch, RootState } from "@/store/store";

/**
 * Topbar shows current member (from redux). If member is not present, it shows generic UI.
 * Logout calls logoutMember thunk (which calls server logout) and then removes client-side items,
 * finally navigates to root.
 */

interface AuthSliceShape {
  member?: { name?: string; userId?: string } | null;
  loading?: boolean;
  error?: string | null;
}

export default function Topbar() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const auth = useSelector((s: RootState) => {
    const raw = (s as unknown as { auth?: unknown }).auth;

    if (raw && typeof raw === "object") {
      return raw as AuthSliceShape;
    }

    return { member: null, loading: false, error: null } as AuthSliceShape;
  });

  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (auth?.member) {
      setDisplayName(auth.member.name ?? auth.member.userId ?? "User");
    } else {
      setDisplayName(null);
    }
  }, [auth?.member]);

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
    <header className="w-full sticky top-0 z-50 bg-[var(--bg-main)] border-b border-[var(--border-color)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between px-6 py-3">
        {/* Logo Section */}
        <div className="flex items-center gap-2 lg:mx-0">
          <UserIcon className="text-[var(--color-primary)]" />
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
            <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-secondary)] rounded-full" />
          </Button>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarFallback className="text-[var(--text-light)]">
                    {displayName ? displayName.slice(0, 2).toUpperCase() : "AD"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56 bg-[var(--bg-main)] border border-[var(--border-color)] shadow-md" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{displayName ?? "Guest"}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{auth?.member?.userId ?? "Not signed in"}</p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-[var(--border-color)]" />
              <DropdownMenuItem onClick={() => router.push("/user/profile")} className="hover:bg-[var(--bg-highlight)]">
                <UserIcon className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
                <span>Profile</span>
              </DropdownMenuItem>
              

              <DropdownMenuSeparator className="bg-[var(--border-color)]" />
              <DropdownMenuItem
                className="hover:bg-[var(--bg-highlight)]"
                onClick={handleLogout}
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
