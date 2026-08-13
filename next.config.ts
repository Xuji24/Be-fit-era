import type { NextConfig } from "next";

// CartoCDN serves the MapLibre basemap style JSON + tiles (components/ui/map.tsx);
// Supabase is both the data API (https) and realtime channel (wss); hCaptcha
// guards signup/login (app/actions/auth-actions.ts) and needs its script,
// challenge iframe, and Sentry error-reporting endpoint all allowed —
// verified live in dev, since a wrong CSP here silently breaks login.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.hcaptcha.com",
  "style-src 'self' 'unsafe-inline' https://*.hcaptcha.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://www.gstatic.com https://*.cartocdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.cartocdn.com https://*.hcaptcha.com",
  "frame-src 'self' https://*.hcaptcha.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
        ],
      },
    ];
  },
};

export default nextConfig;
