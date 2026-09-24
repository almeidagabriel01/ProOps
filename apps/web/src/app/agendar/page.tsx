import type { Metadata } from "next";
import { canonicalFor } from "@/lib/site/host-seo";
import { AgendarClient } from "./_components/agendar-client";

export const metadata: Metadata = {
  title: "Marcar demonstração",
  description:
    "Agende uma demonstração de 15, 30 ou 60 minutos com o time ProOps. Escolha o melhor dia e horário.",
  alternates: { canonical: canonicalFor("erp", "/agendar") },
  openGraph: {
    title: "Marcar demonstração | ProOps",
    description: "Escolha um dia e horário e veja a ProOps em uma demonstração.",
    url: canonicalFor("erp", "/agendar"),
  },
};

export default function AgendarPage() {
  return <AgendarClient />;
}
