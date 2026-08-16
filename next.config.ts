import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Dev-only: allow devices on the LAN to load dev resources (HMR, chunks).
   * Next.js blocks cross-origin dev requests by default. Override with:
   *   ALLOWED_DEV_ORIGINS=192.168.1.50,my-laptop.local npm run dev
   */
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["192.168.29.169"],
};

export default nextConfig;
