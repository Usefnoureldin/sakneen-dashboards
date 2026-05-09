import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev: tenant subdomains via nip.io magic DNS, e.g. paragonadeer.127.0.0.1.nip.io:3000
  allowedDevOrigins: ["*.127.0.0.1.nip.io", "127.0.0.1.nip.io"],
};

export default nextConfig;
