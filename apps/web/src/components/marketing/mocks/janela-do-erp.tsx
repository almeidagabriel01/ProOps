import React from "react";

import { MolduraNavegador } from "@/components/marketing/_shared/moldura-navegador";
import { cn } from "@/lib/utils";

interface JanelaDoErpProps {
  children: React.ReactNode;
  /** Proporção da área da tela, no formato do `aspect-ratio` ("16 / 10.5"). */
  proporcao?: string;
  className?: string;
}

/**
 * Uma tela codada do ERP dentro da janela do navegador, no tema da página.
 *
 * A `MolduraNavegador` nasceu para o site da empresa, que é escuro, e a sombra
 * dela (preto a 75%) vira uma mancha cinza sob a janela quando a página está
 * clara. Aqui a sombra é calibrada para cada tema, e a proporção fica num lugar
 * só em vez de repetida em cada cena.
 */
export function JanelaDoErp({ children, proporcao = "16 / 10.5", className }: JanelaDoErpProps) {
  return (
    <MolduraNavegador
      tom="claro"
      className={cn(
        "shadow-[0_24px_60px_-32px_rgba(0,0,0,0.28)] dark:border-white/12 dark:bg-neutral-900 dark:shadow-[0_40px_110px_-40px_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      <div className="relative" style={{ aspectRatio: proporcao }}>
        {children}
      </div>
    </MolduraNavegador>
  );
}
