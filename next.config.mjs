// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token",
    "rpc-websockets",
  ],
  // LAN-device dev access (e.g. testing the dApp on a phone via the host
  // machine's local IP). Next.js 15+ blocks cross-origin requests to the
  // dev server unless the origin is whitelisted here.
  allowedDevOrigins: ["192.168.18.46"],
};

export default nextConfig;
