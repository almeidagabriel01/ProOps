import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://proops.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/share/",
          "/admin/",
          "/dashboard/",
          "/proposals/",
          "/transactions/",
          "/settings/",
          "/profile/",
          "/products/",
          "/contacts/",
          "/crm/",
          "/team/",
          "/wallets/",
          "/spreadsheets/",
          "/services/",
          "/automation/",
          "/calendar/",
          "/notifications/",
          "/login",
          "/register",
          "/forgot-password",
          "/subscribe",
          "/checkout",
          "/checkout-success",
          "/addon-success",
          "/auth/",
          "/403",
          "/subscription-blocked",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
