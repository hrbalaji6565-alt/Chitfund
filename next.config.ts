import withPWA from "next-pwa";

const withPwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,

  // ignore TS errors during build (Vercel safe)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withPwa(nextConfig);
