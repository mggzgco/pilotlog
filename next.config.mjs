/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";

const contentSecurityPolicy = `
  default-src 'self';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'self';
  script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com;
  font-src 'self' data:;
  connect-src 'self';
  object-src 'none';
`.replace(/\s{2,}/g, " ").trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" }
];

if (isProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  });
}

const nextConfig = {
  experimental: {
    serverActions: {
      // Allows larger multipart/form-data payloads for form posts / server actions.
      // We support up to 20MB per uploaded file (plus overhead).
      bodySizeLimit: "25mb",
      allowedOrigins: (() => {
        const configured = process.env.NEXT_ALLOWED_ORIGINS
          ? process.env.NEXT_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        const derived = [];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
        if (appUrl) {
          try {
            derived.push(new URL(appUrl).host);
          } catch {
            // ignore
          }
        }
        const base = ["localhost:3000", "127.0.0.1:3000"];
        // In production, if nothing was configured, fall back to allowing the deployed host via APP_URL/NEXT_PUBLIC_APP_URL.
        // Set NEXT_ALLOWED_ORIGINS explicitly for stricter control.
        const out = Array.from(new Set([...configured, ...derived, ...base].filter(Boolean)));
        return out.length > 0 ? out : base;
      })()
    }
  },
  images: {
    remotePatterns: []
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
