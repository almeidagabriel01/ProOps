import type { Metadata } from "next";
import { canonicalFor } from "@/lib/site/host-seo";
import { OG_IMAGES_PADRAO } from "@/lib/site/og-image";
import { ContatoFormClient } from "./_components/contato-form-client";

export const metadata: Metadata = {
  title: "Fale com a gente",
  description: "Entre em contato com o time ProOps. Adaptamos o ERP ao seu nicho.",
  alternates: { canonical: canonicalFor("erp", "/contato") },
  openGraph: {
    title: "Fale com a gente | ProOps",
    description: "Entre em contato com o time ProOps.",
    url: canonicalFor("erp", "/contato"),
    images: OG_IMAGES_PADRAO,
  },
};

export default function ContatoPage() {
  return <ContatoFormClient />;
}
