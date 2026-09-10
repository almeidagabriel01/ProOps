import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { InstitucionalAbertura } from "./_components/institucional-abertura";
import { InstitucionalHero } from "./_components/institucional-hero";
import { InstitucionalFrase } from "./_components/institucional-frase";
import { InstitucionalJsonLd } from "./_components/institucional-json-ld";
import { canonicalFor } from "@/lib/site/host-seo";

/**
 * Everything below the second scene is code-split, imported BY DIRECT PATH and
 * never through a barrel, which is what makes webpack actually split it. The ERP
 * landing records the same rule next to its own dynamic imports: a barrel import
 * pulls the whole module graph into the first chunk and the split silently does
 * nothing.
 *
 * `ssr` is left at its default (true), so every scene is server-rendered and
 * present in the HTML. The split is about when the JAVASCRIPT arrives, not about
 * when the content does: these sections are authored in their final state, so
 * the markup is complete and readable before a single scene has hydrated.
 */
const InstitucionalProblema = dynamic(() =>
  import("./_components/institucional-problema").then(
    (m) => m.InstitucionalProblema,
  ),
);
const InstitucionalProdutos = dynamic(() =>
  import("./_components/institucional-produtos").then(
    (m) => m.InstitucionalProdutos,
  ),
);
const InstitucionalManifesto = dynamic(() =>
  import("./_components/institucional-manifesto").then(
    (m) => m.InstitucionalManifesto,
  ),
);
const InstitucionalHistoria = dynamic(() =>
  import("./_components/institucional-historia").then(
    (m) => m.InstitucionalHistoria,
  ),
);
const InstitucionalCta = dynamic(() =>
  import("./_components/institucional-cta").then((m) => m.InstitucionalCta),
);

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
  alternates: { canonical: canonicalFor("institucional", "/") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "ProOps",
    description:
      "Software de gestão para quem vende projeto: um ERP para a empresa e um aplicativo para a pessoa.",
    url: canonicalFor("institucional", "/"),
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "ProOps",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProOps",
    description:
      "Software de gestão para quem vende projeto: um ERP para a empresa e um aplicativo para a pessoa.",
  },
};

export default function InstitucionalPage() {
  return (
    <>
      <InstitucionalJsonLd />
      <InstitucionalAbertura />
      <main>
        <InstitucionalHero />
        <InstitucionalFrase />
        <InstitucionalProblema />
        <InstitucionalProdutos />
        <InstitucionalManifesto />
        <InstitucionalHistoria />
        <InstitucionalCta />
      </main>
    </>
  );
}
