"use client";

import React, { useEffect, useState } from "react";
import BottomNav from "./components/bottomnav";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { hydrateMember, setClientToken } from "@/store/memberAuthSlice";

/* ---------- small helpers ---------- */
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function extractString(x: unknown, fallback = ""): string {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return fallback;
}

/* ---------- layout ---------- */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  // redux member
  const reduxMember = useSelector((s: RootState) => s.auth.member);

  // undefined = checking, null = no auth, string = token
  const [clientToken, setClientTokenLocal] =
    useState<string | null | undefined>(undefined);

  /* ---------- hydrate on reload ---------- */
  useEffect(() => {
    // case 1: redux already has member
    if (reduxMember) {
      const token = localStorage.getItem("memberToken");

      if (token) {
        dispatch(setClientToken(token));
        setClientTokenLocal(token);
      } else {
        // redux member exists → don't logout immediately
        setClientTokenLocal("present");
      }
      return;
    }

    // case 2: hydrate from localStorage
    try {
      const raw = localStorage.getItem("member");
      const token = localStorage.getItem("memberToken");

      if (raw && token) {
        const parsed = JSON.parse(raw);
        if (isRecord(parsed)) {
          dispatch(
            hydrateMember({
              id: extractString(parsed.id ?? parsed._id),
              name: extractString(parsed.name),
              email: extractString(parsed.email),
            } as any)
          );
          dispatch(setClientToken(token));
          setClientTokenLocal(token);
          return;
        }
      }

      setClientTokenLocal(null);
    } catch {
      setClientTokenLocal(null);
    }
  }, [reduxMember, dispatch]);

  /* ---------- redirect if not logged in ---------- */
  useEffect(() => {
    if (clientToken === null) {
      router.replace("/");
    }
  }, [clientToken, router]);

  /* ---------- loading skeleton ---------- */
  if (clientToken === undefined) {
    return (
      <>
        <div className="h-14 bg-[var(--bg-card)]/30 animate-pulse" />
        <div className="flex">
          <aside className="w-64 hidden lg:block bg-[var(--bg-card)]/30 animate-pulse" />
          <main className="flex-1 p-6">
            <div className="h-6 bg-[var(--bg-card)]/30 rounded mb-4 animate-pulse" />
            <div className="space-y-3">
              <div className="h-40 bg-[var(--bg-card)]/30 rounded animate-pulse" />
            </div>
          </main>
        </div>
      </>
    );
  }

  if (clientToken === null) return null;

  /* ---------- authenticated layout ---------- */
  return (
    <>
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-0 md:p-6 overflow-y-auto bg-[var(--bg-main)] lg:ml-64 pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
