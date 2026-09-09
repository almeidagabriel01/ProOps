import type { Metadata } from "next";

import { APP_NAME } from "@/lib/site/app-brand";

/**
 * The mobile app landing page.
 *
 * Served at `https://app.proops.com.br/` through a host rewrite in the proxy,
 * so the canonical is that host's root and NOT this file's path. See
 * @/lib/site/surfaces for the host policy.
 */
export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Notas, lembretes e controle financeiro pessoal por mensagem. Você escreve ou fala, a IA organiza.",
  alternates: { canonical: "https://app.proops.com.br/" },
  openGraph: {
    title: APP_NAME,
    description:
      "Notas, lembretes e controle financeiro pessoal por mensagem. Você escreve ou fala, a IA organiza.",
    url: "https://app.proops.com.br/",
  },
};

export default function AplicativoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-black/50 dark:text-white/50">
        Página do {APP_NAME}, em construção.
      </p>
    </div>
  );
}
