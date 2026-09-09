import type { Metadata } from "next";

/**
 * The ProOps company page.
 *
 * Served at `https://proops.com.br/` through a host rewrite in the proxy, so
 * the canonical is the apex root and NOT this file's path. See
 * @/lib/site/surfaces for the host policy.
 */
export const metadata: Metadata = {
  // `absolute` escapes the root layout template (`%s | ProOps`), which would
  // otherwise render this page as "ProOps | ProOps".
  title: { absolute: "ProOps: software de gestão para quem vende projeto" },
  description:
    "A ProOps constrói software de gestão para quem vende projeto: um ERP para a operação da empresa e um aplicativo para a vida financeira de cada pessoa.",
  alternates: { canonical: "https://proops.com.br/" },
  openGraph: {
    title: "ProOps",
    description:
      "Software de gestão para quem vende projeto: um ERP para a empresa e um aplicativo para a pessoa.",
    url: "https://proops.com.br/",
  },
};

export default function InstitucionalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-black/50 dark:text-white/50">
        Página institucional da ProOps, em construção.
      </p>
    </div>
  );
}
