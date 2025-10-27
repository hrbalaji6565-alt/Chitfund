"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { loginAdmin, registerAdmin } from "@/store/adminSlice";
import Button from "../ui/button";
import { Toaster } from "react-hot-toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const { loading, error, token } = useSelector(
    (state: RootState) => state.admin
  );

  // ✅ Redirect when token available
  useEffect(() => {
    if (token) {
      console.log("✅ Redirecting to /admin...");
      router.push("/admin");
    }
  }, [token, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🟢 handleSubmit triggered", formData);

    if (isLogin) {
      dispatch(loginAdmin({ email: formData.email, password: formData.password }));
    } else {
      if (formData.password !== formData.confirmPassword) {
        alert("Passwords do not match");
        return;
      }

      dispatch(
        registerAdmin({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          address: "",
        })
      );
    }
  };

  return (
    <section className="bg-[var(--bg-main)] text-[var(--text-primary)] font-sans overflow-hidden min-h-screen">
      <Toaster position="top-center" />
      <div className="max-w-7xl mx-auto min-h-screen flex flex-col md:flex-row relative transition-all duration-700 ease-in-out">
        
        {/* LEFT IMAGE SECTION */}
        <div className="hidden md:flex w-1/2 relative overflow-hidden">
          <motion.img
            key={isLogin ? "login-bg" : "signup-bg"}
            src={isLogin ? "/auth/logo.png" : "/auth/chitfund.png"}
            alt="Chit Fund Illustration"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover blur-sm brightness-75"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login-text" : "signup-text"}
              initial={{ opacity: 0, x: isLogin ? -80 : 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 80 : -80 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
              className="absolute inset-0 flex flex-col justify-center items-center text-center px-10 text-[var(--text-light)]"
            >
              {isLogin ? (
                <>
                  <h2 className="text-4xl font-bold text-[var(--color-accent)] mb-4 drop-shadow-md">
                    Secure Your Future
                  </h2>
                  <p className="text-lg max-w-md text-gray-100">
                    Join <span className="font-semibold text-[var(--color-accent)]">Cronnis Money Maven Chits</span> — your trusted partner for smart savings and transparent chit fund management.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-bold text-[var(--color-accent)] mb-4 drop-shadow-md">
                    Grow with Confidence
                  </h2>
                  <p className="text-lg max-w-md text-gray-100">
                    Become a part of <span className="font-semibold text-[var(--color-accent)]">Cronnis Money Maven Chits</span> and start your secure financial journey today.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT FORM SECTION */}
        <motion.div
          key={isLogin ? "login-form" : "signup-form"}
          initial={{ x: isLogin ? 100 : -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isLogin ? -100 : 100, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 bg-[var(--bg-card)] shadow-2xl z-10 h-screen md:h-auto"
        >
          <div className="w-full max-w-md">
            <h1 className="text-3xl md:text-4xl font-bold text-center mb-2 text-[var(--color-primary)]">
              CRONNIS <span className="text-[var(--color-accent)]">MONEY MAVEN CHITS</span>
            </h1>
            <p className="text-center text-gray-600 mb-8">
              {isLogin ? "Login to continue your journey" : "Create your secure account"}
            </p>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {!isLogin && (
                <>
                  <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition" />
                  <input type="text" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition" />
                </>
              )}

              <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition" />
              <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition" />

              {!isLogin && (
                <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition" />
              )}

              <Button type="submit" className="w-full h-12" disabled={loading}>
                {loading ? (isLogin ? "Logging in..." : "Signing up...") : (isLogin ? "Login" : "Sign Up")}
              </Button>
            </form>

            <div className="flex justify-center gap-4 mt-5">
              <Button onClick={() => router.push("/user")}>User Portal</Button>
              <Button onClick={() => router.push("/collection")}>Collection Portal</Button>
            </div>

            <p className="text-center mt-6 text-gray-700">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <span onClick={() => setIsLogin(!isLogin)} className="text-[var(--color-accent)] ml-2 cursor-pointer hover:underline transition">
                {isLogin ? "Sign Up" : "Login"}
              </span>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
