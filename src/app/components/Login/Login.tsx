"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { loginAdmin } from "@/store/adminSlice";
import { loginMember, hydrateMember } from "@/store/memberAuthSlice";
import Button from "../ui/button";
import type { Member as MemberType } from "@/app/lib/types";

// Local shapes for thunk results
interface AdminLoginResult {
  token?: string;
}

interface MemberLoginResult {
  token?: string;
  member?: MemberType;
}

interface CollectionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "collector" | "admin";
  active: boolean;
  assignedGroupIds?: string[];
}

interface CollectionLoginResponse {
  success: boolean;
  user?: CollectionUser;
  token?: string;
  error?: string;
}

type LoginType = "admin" | "user" | "collector";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>("user");
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { loading: adminLoading, error: adminError, token: adminToken } = useSelector(
    (state: RootState) => state.admin,
  );
  const {
    loading: memberLoading,
    error: memberError,
    token: memberToken,
  } = useSelector((state: RootState) => state.auth);

  // Existing redirects (admin / user)
  useEffect(() => {
    if (adminToken) {
      try {
        localStorage.setItem("adminToken", adminToken || "");
      } catch {}
      router.replace("/admin");
    }
  }, [adminToken, router]);

  useEffect(() => {
    if (memberToken) {
      try {
        localStorage.setItem("memberToken", memberToken);
      } catch {}
      router.replace("/user");
    }
  }, [memberToken, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollectionError(null);

    if (!formData.email || !formData.password) return;

    setIsSubmitting(true);

    try {
      if (loginType === "admin") {
        // 🔹 ADMIN LOGIN ONLY
        const adminResult = (await dispatch(
          loginAdmin({ email: formData.email, password: formData.password }),
        )) as { payload?: AdminLoginResult };

        if (adminResult?.payload?.token) {
          try {
            localStorage.setItem("adminToken", adminResult.payload.token);
          } catch {}
          router.replace("/admin");
        }
        return;
      }

      if (loginType === "user") {
        // 🔹 USER LOGIN ONLY
        const memberResult = (await dispatch(
          loginMember({ email: formData.email, password: formData.password }),
        )) as { payload?: MemberLoginResult };

        const token = memberResult?.payload?.token ?? null;
        if (token) {
          try {
            localStorage.setItem("memberToken", token);
          } catch {}
        }

        if (memberResult?.payload?.member) {
          const m = memberResult.payload.member;

          const storeObj: Partial<MemberType> = {
            id: (m.id ?? m._id) ?? "",
            name: m.name ?? "",
            email: m.email ?? "",
            mobile: (m as Partial<MemberType>).mobile,
            status: (m as Partial<MemberType>).status,
            role:
              m.role ??
              (Array.isArray((m as Partial<MemberType>).roles)
                ? (m as Partial<MemberType>).roles?.[0]
                : "user"),
            avatarUrl: m.avatarUrl ?? (m as Partial<MemberType>).photo ?? undefined,
            _id: m._id,
            roles: m.roles,
            photo: m.photo,
          };

          try {
            localStorage.setItem("member", JSON.stringify(storeObj));
          } catch {}

          dispatch(hydrateMember(m as MemberType));
          router.replace("/user");
        }
        return;
      }

      if (loginType === "collector") {
        // 🔹 COLLECTION LOGIN ONLY
        const response = await fetch("/api/collections/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const data = (await response.json()) as CollectionLoginResponse;

        if (!response.ok || !data.success || !data.user) {
          setCollectionError(data.error ?? "Invalid collection credentials");
          return;
        }

        try {
          localStorage.setItem("collectionUser", JSON.stringify(data.user));
        } catch {}

        // cookie collectionToken backend se already set ho raha hai
        router.replace("/collection");
        return;
      }
    } catch {
      // individual error messages already handled with adminError/memberError/collectionError
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading =
    loginType === "admin"
      ? adminLoading || isSubmitting
      : loginType === "user"
      ? memberLoading || isSubmitting
      : isSubmitting;

  const errorMessage =
    loginType === "admin"
      ? (adminError ? String(adminError) : null)
      : loginType === "user"
      ? (memberError ? String(memberError) : null)
      : collectionError;

  return (
    <section className="bg-[var(--bg-main)] text-[var(--text-primary)] font-sans overflow-hidden min-h-screen">
      <div className="max-w-7xl mx-auto min-h-screen flex flex-col md:flex-row relative transition-all duration-700 ease-in-out">
        <div className="hidden md:flex w-1/2 relative overflow-hidden">
          <motion.img
            key="auth-illustration"
            src="/auth/logo.png"
            alt="Chit Fund Illustration"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover blur-sm brightness-75"
          />
          <AnimatePresence mode="wait">
            <motion.div
              key="auth-text"
              initial={{ opacity: 0, x: -80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.7 }}
              className="absolute inset-0 flex flex-col justify-center items-center text-center px-10 text-[var(--text-light)]"
            >
              <h2 className="text-4xl font-bold text-[var(--color-accent)] mb-4 drop-shadow-md">
                Secure Your Future
              </h2>
              <p className="text-lg max-w-md text-gray-100">
                Join Cronnis Money Maven Chits — your trusted partner for smart savings and
                transparent chit fund management.
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          key="auth-form"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 bg-[var(--bg-card)] shadow-2xl z-10 h-screen md:h-auto"
        >
          <div className="w-full max-w-md">
            <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-[var(--color-primary)]">
              CRONNIS <span className="text-[var(--color-accent)]">MONEY MAVEN CHITS</span>
            </h1>
            <p className="text-center text-gray-600 mb-4">
              {isLogin ? "Login to continue your journey" : "Create your secure account"}
            </p>

            {/* 🔹 LOGIN TYPE SELECTOR */}
            <div className="flex justify-center mb-4 gap-2">
              <button
                type="button"
                onClick={() => setLoginType("admin")}
                className={`px-3 py-1 text-sm rounded-full border ${
                  loginType === "admin"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setLoginType("user")}
                className={`px-3 py-1 text-sm rounded-full border ${
                  loginType === "user"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]"
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setLoginType("collector")}
                className={`px-3 py-1 text-sm rounded-full border ${
                  loginType === "collector"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-transparent text-[var(--text-secondary)] border-[var(--border-color)]"
                }`}
              >
                Collection
              </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
                required
                autoComplete="email"
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
                required
                autoComplete="current-password"
              />

              <Button type="submit" className="w-full h-12" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>

            {errorMessage && (
              <div className="text-red-600 text-center font-medium mt-4">
                {errorMessage}
              </div>
            )}

            

            
          </div>
        </motion.div>
      </div>
    </section>
  );
}
