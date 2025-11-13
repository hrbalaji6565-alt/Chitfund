// src/app/user/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import BottomNav from "./components/bottomnav";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { hydrateMember, setClientToken } from "@/store/memberAuthSlice";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function extractString(x: unknown, fallback = ""): string {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return fallback;
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  // read member from redux (fast)
  const reduxMember = useSelector((s: RootState) => {
    const raw = (s as unknown as { auth?: unknown }).auth;
    if (isRecord(raw) && raw.member !== undefined && raw.member !== null) {
      // keep the shape but don't assume deeper types
      return raw.member as unknown;
    }
    return null;
  }) as unknown | null;

  // clientToken: undefined = resolving, null = no token, string = token present
  const [clientToken, setClientTokenLocal] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    // If redux already has member, use token from redux or localStorage
    if (reduxMember) {
      try {
        const globalState = (typeof window !== "undefined" ? (window as unknown) : undefined) as unknown;
        let maybeToken: string | null | undefined = undefined;

        if (isRecord(globalState)) {
          const reduxState = globalState as Record<string, unknown>;
          const authSlice = reduxState.__REDUX_STATE__ as unknown;
          if (isRecord(authSlice)) {
            const token = authSlice.token;
            if (typeof token === "string") maybeToken = token;
          }
        }

        if (!maybeToken) {
          const lsToken = typeof window !== "undefined" ? localStorage.getItem("memberToken") : null;
          if (lsToken) maybeToken = lsToken;
        }

        setClientTokenLocal(maybeToken ?? "present");

        // ensure slice token is set too
        if (maybeToken) dispatch(setClientToken(maybeToken));
      } catch {
        setClientTokenLocal("present");
      }
      return;
    }

    // try to hydrate redux from localStorage
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("member") : null;
      const token = typeof window !== "undefined" ? localStorage.getItem("memberToken") : null;

      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (isRecord(parsed)) {
            const maybeId = parsed.id ?? parsed._id;
            const idStr = extractString(maybeId, "");
            if (idStr) {
              const memberObj: { id: string; name: string; email: string } = {
                id: idStr,
                name: extractString(parsed.name, ""),
                email: extractString(parsed.email, ""),
              };
              dispatch(hydrateMember(memberObj));
            }
          }
        } catch {
          // ignore JSON parse
        }
      }

      if (token) {
        setClientTokenLocal(token);
        dispatch(setClientToken(token));
      } else {
        setClientTokenLocal(null);
      }
    } catch {
      setClientTokenLocal(null);
    }
  }, [reduxMember, dispatch]);

  // redirect when resolved and no token
  useEffect(() => {
    if (clientToken === null) {
      router.replace("/");
    }
  }, [clientToken, router]);

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
