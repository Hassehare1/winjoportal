import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./features/analytics/assets/**/*"]
  }
};

export default nextConfig;
