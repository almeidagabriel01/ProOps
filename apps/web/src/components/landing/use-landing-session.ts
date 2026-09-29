"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "@/lib/toast";
import { useAuth } from "@/providers/auth-provider";

/**
 * A sessão que a navbar das páginas de marketing precisa: quem está logado e
 * como sair. Separado de `useLandingPage` porque aquele também busca os planos
 * do Stripe, e as páginas de nicho e `/funcionalidades` não mostram preço: a
 * requisição era feita em toda visita e jogada fora.
 */
export function useLandingSession() {
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Você saiu da sua conta.", {
        title: "Logout realizado",
      });
    } catch {
      toast.error("Não foi possível sair da conta agora.", {
        title: "Erro ao sair",
      });
    }
  };

  return { currentUser, isAuthLoading, handleSignOut };
}
