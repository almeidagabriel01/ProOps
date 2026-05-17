import type { Metadata } from "next";
import { ContatoFormClient } from "./_components/contato-form-client";

export const metadata: Metadata = {
  title: "Fale com a gente - ProOps",
  description: "Entre em contato com o time ProOps. Adaptamos o ERP ao seu nicho.",
  alternates: { canonical: "/contato" },
  openGraph: {
    title: "Fale com a gente - ProOps",
    description: "Entre em contato com o time ProOps.",
    url: "/contato",
  },
};

export default function ContatoPage() {
  return <ContatoFormClient />;
}
