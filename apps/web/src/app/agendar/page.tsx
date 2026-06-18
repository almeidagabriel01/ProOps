import type { Metadata } from "next";
import { AgendarClient } from "./_components/agendar-client";

export const metadata: Metadata = {
  title: "Marcar uma reunião - ProOps",
  description:
    "Agende uma conversa de 15, 30 ou 60 minutos com o time ProOps. Escolha o melhor dia e horário.",
  alternates: { canonical: "/agendar" },
  openGraph: {
    title: "Marcar uma reunião - ProOps",
    description: "Escolha um dia e horário e fale com o time ProOps.",
    url: "/agendar",
  },
};

export default function AgendarPage() {
  return <AgendarClient />;
}
