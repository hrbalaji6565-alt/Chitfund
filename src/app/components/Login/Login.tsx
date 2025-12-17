"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { loginAdmin } from "@/store/adminSlice";
import { loginMember, hydrateMember } from "@/store/memberAuthSlice";
import Button from "../ui/button";
import type { Member as MemberType } from "@/app/lib/types";

type LoginType = "admin" | "user" | "collector";

export default function AuthPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const [loginType, setLoginType] = useState<LoginType>("user");
  const [formData, setFormData] = useState({
    email: "",     // 👈 userId bhi yahin aayega
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const { loading: adminLoading, error: adminError, token: adminToken } =
    useSelector((state: RootState) => state.admin);

  const {
    loading: memberLoading,
    error: memberError,
    token: memberToken,
  } = useSelector((state: RootState) => state.auth);

  /* ---------- REDIRECTS ---------- */

  useEffect(() => {
    if (adminToken) router.replace("/admin");
  }, [adminToken, router]);

  useEffect(() => {
    if (memberToken) router.replace("/user");
  }, [memberToken, router]);

  /* ---------- HANDLERS ---------- */

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCollectionError(null);

    try {
      /* ADMIN LOGIN */
      if (loginType === "admin") {
        const result = await dispatch(
          loginAdmin({
            email: formData.email,
            password: formData.password,
          })
        );

        // 🔑 IMPORTANT: persist token (same as old code)
        if (
          typeof result.payload === "object" &&
          result.payload !== null &&
          "token" in result.payload &&
          typeof result.payload.token === "string"
        ) {
          try {
            localStorage.setItem("adminToken", result.payload.token);
          } catch { }
          router.replace("/admin");
        }

        return;
      }


      /* USER LOGIN (USER ID + PASSWORD) */
      if (loginType === "user") {
        const result = await dispatch(
          loginMember({
            userId: formData.email, // ✅ userId yahin se ja raha
            password: formData.password,
          })
        );

        // ✅ TYPE GUARD
        if (
          typeof result.payload === "object" &&
          result.payload !== null &&
          "member" in result.payload
        ) {
          dispatch(hydrateMember(result.payload.member as MemberType));
          router.replace("/user");
        }

        return;
      }

      /* COLLECTION LOGIN */
      if (loginType === "collector") {
        const res = await fetch("/api/collections/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setCollectionError(data.error || "Invalid credentials");
          return;
        }

        router.replace("/collection");
      }
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
      ? adminError
      : loginType === "user"
        ? memberError
        : collectionError;

  /* ---------- UI (UNCHANGED) ---------- */

  return (
    <section className="bg-[var(--bg-main)] text-[var(--text-primary)] min-h-screen">
      <div className="max-w-7xl mx-auto min-h-screen flex flex-col md:flex-row">
        <div className="hidden md:flex w-1/2 relative overflow-hidden">
          <motion.img
            src="/auth/logo.png"
            alt="Auth"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        <div className="w-full md:w-1/2 flex items-center justify-center p-6 bg-[var(--bg-card)]">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-bold text-center mb-2 text-[var(--color-primary)]">
              CRONNIS MONEY MAVEN CHITS
            </h1>

            <div className="flex justify-center gap-2 mb-4">
              {(["admin", "user", "collector"] as LoginType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLoginType(type)}
                  className={`px-3 py-1 text-sm rounded-full border ${loginType === type
                      ? "bg-[var(--color-primary)] text-white"
                      : "border-[var(--border-color)] text-gray-600"
                    }`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type={loginType === "user" ? "text" : "email"}
                name="email"
                placeholder={loginType === "user" ? "User ID" : "Email"}
                value={formData.email}
                onChange={handleChange}
                className="w-full p-3 border rounded-md border-[var(--border-color)]"
                required
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                className="w-full p-3 border rounded-md border-[var(--border-color)]"
                required
              />

              <Button type="submit" className="w-full h-12" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>

            {errorMessage && (
              <div className="text-red-600 text-center mt-4">
                {String(errorMessage)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
