import type { NextConfig } from "next";

const isCondorLocalBuild = process.env.CONDOR_LOCAL_BUILD === "1";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src https://kauaartx.vercel.app https://sistema-videos.vercel.app https://sat-simulado.vercel.app https://university-path-six.vercel.app",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Permissions-Policy", value: "camera=(), display-capture=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = isCondorLocalBuild
  ? {
      output: "export",
      basePath: "/hub",
      assetPrefix: "/hub",
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_ARTX_BASE_PATH: "/hub" },
    }
  : {
      env: { NEXT_PUBLIC_ARTX_BASE_PATH: "" },
      poweredByHeader: false,
      productionBrowserSourceMaps: false,
      reactStrictMode: true,
      async headers() {
        return [
          { source: "/:path*", headers: securityHeaders },
          { source: "/", headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }] },
        ];
      },
    };

export default nextConfig;
