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
import { useDispatch } from "react-redux";
import { logout } from "@/store/adminSlice";
import toast from "react-hot-toast";

const Topbar: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();

  const handleLogout = () => {
  dispatch(logout());
  localStorage.removeItem("adminToken");
  toast.success("Logged out successfully!");
  router.push("/");
};

  return (
    <header className="w-full sticky top-0 z-50 bg-[var(--color-white)] border-b border-[var(--border-color)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2 mx-7 lg:mx-0">
          <User />
          <h1 className="text-lg font-bold text-[var(--color-primary)]">
            Cronnis <span className="text-[var(--color-secondary)]">Chits</span>
          </h1>
        </div>

        <div className="flex items-center gap-4 mt-2 md:mt-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search Members, Chits, Transactions..."
              className="pl-9 pr-4 py-2 text-sm rounded-md border border-[var(--border-color)] w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            />
          </div>

          <Button variant="ghost" size="icon" className="relative rounded-full">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarFallback className="text-white">AD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Admin User</p>
                  <p className="text-xs text-muted-foreground">
                    admin@chitfund.com
                  </p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/admin/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
                

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
