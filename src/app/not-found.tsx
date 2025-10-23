"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/app/components/ui/card";
import Button from "@/app/components/ui/button";
import { useRouter } from "next/navigation";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-main)] text-center p-6"
    >
      <Swiper
        spaceBetween={30}
        slidesPerView={1}
        loop
        autoplay={{ delay: 3000 }}
        className="w-full max-w-md mb-8"
      >
        <SwiperSlide>
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg rounded-2xl">
              <CardContent className="p-10 flex flex-col items-center gap-4">
                <h1 className="text-6xl font-bold text-[var(--color-primary)]">
                  404
                </h1>
                <p className="text-lg text-[var(--text-secondary)]">
                  Oops! The page you’re looking for doesn’t exist.
                </p>
                <div className="w-16 h-1 bg-[var(--color-accent)] rounded-full mt-2"></div>
              </CardContent>
            </Card>
          </motion.div>
        </SwiperSlide>

        <SwiperSlide>
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg rounded-2xl">
              <CardContent className="p-10 flex flex-col items-center gap-4">
                <h2 className="text-4xl font-semibold text-[var(--color-secondary)]">
                  Lost your way?
                </h2>
                <p className="text-[var(--text-secondary)] text-base">
                  Let’s get you back to where you belong.
                </p>
                <div className="w-12 h-1 bg-[var(--color-primary)] rounded-full mt-2"></div>
              </CardContent>
            </Card>
          </motion.div>
        </SwiperSlide>
      </Swiper>

      <Button
        onClick={() => router.back()}
        className="mt-4 px-6 py-3 bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--text-light)] font-medium rounded-xl transition-[var(--transition-fast)] shadow-md"
      >
        Back to Home
      </Button>

      <p className="mt-6 text-sm text-[var(--text-secondary)]">
        Need help? Contact support for assistance.
      </p>
    </motion.div>
  );
}
