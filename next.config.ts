import type { NextConfig } from "next";

// Allow owner photos served from the configured R2 public host (if set).
const r2Host = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: r2Host ? [{ protocol: "https", hostname: r2Host }] : [],
  },
};

export default nextConfig;
