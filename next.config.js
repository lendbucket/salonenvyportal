/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["bcryptjs"],
  experimental: {
    turbo: {
      enabled: false
    }
  }
}

module.exports = nextConfig
