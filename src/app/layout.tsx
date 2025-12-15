import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cronnis Money Maven Chits",
  description:
    "Your trusted partner for smart savings and transparent chit fund management.",

  manifest: "/manifest.json",
  themeColor: "#1A73E8",

  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cronnis Chits",
  },

  icons: {
    apple: [
      { url: "/icons/ios/180.png", sizes: "180x180" },
      { url: "/icons/ios/152.png", sizes: "152x152" },
      { url: "/icons/ios/167.png", sizes: "167x167" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Mobile viewport (PWA safe) */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
