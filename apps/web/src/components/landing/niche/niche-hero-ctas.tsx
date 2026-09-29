"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

import { getAuthenticatedHome } from "@/lib/landing/auth-redirect";

import { LandingButton } from "../_shared/landing-button";
import { useLandingSession } from "../use-landing-session";

interface NicheHeroCtasProps {
  primario: { label: string; href: string };
  secundario: { label: string; href: string };
}

/**
 * Os botões do herói. O HTML do servidor sai com os de quem não está logado
 * ("Começar agora", que abre o cadastro com o nicho escolhido), e a ilha só
 * troca o rótulo para "Acessar painel" se houver sessão. Antes havia um
 * skeleton no lugar dos dois enquanto a sessão carregava: o botão principal da
 * página ficava cinza no primeiro segundo para todo visitante. O `min-w` segura
 * a largura, para a troca não empurrar nada.
 */
export function NicheHeroCtas({ primario, secundario }: NicheHeroCtasProps) {
  const { currentUser } = useLandingSession();
  const href = currentUser ? getAuthenticatedHome(currentUser) : primario.href;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <LandingButton
        href={href}
        variant="solid"
        size="lg"
        className="min-w-[13rem] justify-center"
        trailingIcon={<ArrowRight className="h-5 w-5" />}
      >
        {currentUser ? "Acessar painel" : primario.label}
      </LandingButton>
      {currentUser ? null : (
        <LandingButton href={secundario.href} variant="link">
          {secundario.label}
        </LandingButton>
      )}
    </div>
  );
}
