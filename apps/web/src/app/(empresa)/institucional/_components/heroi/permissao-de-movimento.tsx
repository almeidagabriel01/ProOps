"use client";

import React from "react";

import { useCampoPonteiro } from "@/components/marketing/_shared/pointer-field-provider";

/**
 * O iOS pôs o giroscópio atrás de uma permissão que só pode ser pedida a partir
 * de um gesto, então num iPhone a inclinação não começa sozinha. Oferecer é
 * melhor do que fingir que o recurso não existe ali, e o botão só aparece onde o
 * pedido existe de fato: no Android, no desktop e depois de respondido, some.
 * Recusar não custa nada; o campo cai para a velocidade de rolagem.
 */
export function PermissaoDeMovimento() {
  const { precisaDePermissao, pedirPermissao } = useCampoPonteiro();
  if (!precisaDePermissao) return null;
  return (
    <button
      type="button"
      onClick={() => void pedirPermissao()}
      className="hero-enter mt-8 inline-flex cursor-pointer items-center gap-2 border-b border-white/25 pb-1 text-sm text-white/60 transition-colors hover:text-white"
      style={{ "--hero-delay": "calc(var(--espera, 0s) + 1s)" } as React.CSSProperties}
    >
      Ativar movimento
    </button>
  );
}
