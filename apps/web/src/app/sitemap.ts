import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/automacao-residencial`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE}/decoracao`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
