import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/checkin",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
