import type { MetadataRoute } from "next";

// Only the public pages may be indexed. Everything behind sign-in (listings, students,
// moderation, analytics) is disallowed and also sends noindex.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/safety", "/privacy", "/terms"],
        disallow: ["/tickets", "/events", "/listings", "/sell", "/selling", "/inquiries", "/account", "/admin", "/welcome", "/sign-in", "/auth", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
