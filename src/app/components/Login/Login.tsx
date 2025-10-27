"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Button from "../ui/button";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/admin"); // ✅ Redirects to admin page after login/signup
  };

  return (
    <section className="bg-[var(--bg-main)] text-[var(--text-primary)] font-sans overflow-hidden min-h-screen">
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
              CRONNIS{" "}
              <span className="text-[var(--color-accent)]">MONEY MAVEN CHITS</span>
            </h1>
            <p className="text-center text-gray-600 mb-8">
              {isLogin ? "Login to continue your journey" : "Create your secure account"}
            </p>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {!isLogin && (
                <>
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
                  />
                </>
              )}

              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
              />

              {!isLogin && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full p-3 border rounded-md border-[var(--border-color)] focus:border-[var(--color-primary)] outline-none transition"
                />
              )}

              {isLogin && (
                <div className="text-right text-sm text-[var(--color-primary)] hover:underline cursor-pointer">
                  Forgot Password?
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 "
              >
                {isLogin ? "Login" : "Sign Up"}
              </Button>
            </form>
                 <Button className="mt-5" onClick={() => router.push('/user')}>
                User Portal
              </Button>
                 <Button className="mx-4 mt-5" onClick={() => router.push('/collection')}>
                Collection Portal
              </Button>

            <p className="text-center mt-6 text-gray-700">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <span
                onClick={() => setIsLogin(!isLogin)}
                className="text-[var(--color-accent)] ml-2 cursor-pointer hover:underline transition"
              >
                {isLogin ? "Sign Up" : "Login"}
              </span>

           
            </p>
          </div>
          
        </motion.div>
        
      </div>
    </section>
  );
}
