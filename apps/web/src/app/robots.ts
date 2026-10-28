import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://axiona.world";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/saved", "/account", "/auth/", "/login"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
