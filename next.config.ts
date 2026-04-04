import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
