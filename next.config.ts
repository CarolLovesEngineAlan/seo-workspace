import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**/*": ["./lib/production/html-templates/**/*.html"],
    "/prompt-system/**/*": ["./lib/production/html-templates/**/*.html"],
  },
};

export default nextConfig;
