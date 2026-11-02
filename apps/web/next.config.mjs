/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";

// В dev Next использует eval для react-refresh, поэтому строгий CSP включаем
// только в production — иначе гидрация в локальной разработке падает.
const contentSecurityPolicy = {
  key: "Content-Security-Policy",
  value:
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
};

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          ...(isProduction ? [contentSecurityPolicy] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
