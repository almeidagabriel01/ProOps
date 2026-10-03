import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadBlockedSession } from "./_lib/blocked-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Layout({ children }: { children: ReactNode }) {
  // Superadmin vai ao painel, conta free e assinatura ativa voltam para a raiz;
  // quem está bloqueado (ou sem sessão) fica e vê a mensagem.
  const { redirectTo } = await loadBlockedSession();
  // redirect() fora de try/catch para o sinal NEXT_REDIRECT não ser engolido.
  if (redirectTo !== null) redirect(redirectTo);

  return <>{children}</>;
}
