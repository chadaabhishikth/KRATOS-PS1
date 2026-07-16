import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Monaco Editor loads its worker scripts via inline blob/eval in some
// configurations, so 'unsafe-eval' is required for the code editor to work.
// Supabase auth calls go to *.supabase.co, and AI grading calls go server-side
// (not from the browser) so generativelanguage.googleapis.com does not need
// to be whitelisted here.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-eval'${isDev ? " 'unsafe-inline'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
