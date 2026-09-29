"use client";

import { LandingNavbar } from "./landing-navbar";
import { useLandingSession } from "./use-landing-session";

/**
 * A navbar da landing para páginas montadas no servidor (`/funcionalidades` e
 * as landings de nicho): a sessão é lida aqui dentro, na ilha, e a página em
 * volta continua sem nenhum hook.
 */
export function LandingNavbarComSessao() {
  const { currentUser, isAuthLoading, handleSignOut } = useLandingSession();
  return (
    <LandingNavbar
      currentUser={currentUser}
      isAuthLoading={isAuthLoading}
      onSignOut={handleSignOut}
    />
  );
}
