import React from "react";

import { JanelaDoErp } from "@/components/marketing/mocks/janela-do-erp";
import { TelaFluxoDeCaixa } from "@/components/marketing/mocks/telas/telas-do-erp";

/**
 * O fluxo de caixa, na página de Fluxo de caixa e DRE. Componente de servidor:
 * o gráfico se revela pela rolagem com CSS (`.vitrine-fluxo` em
 * `app/vitrine.css`), sem hidratar nada.
 */
export function VitrineFluxo() {
  return (
    <figure className="vitrine-fluxo">
      <JanelaDoErp proporcao="16 / 8.4">
        <TelaFluxoDeCaixa />
      </JanelaDoErp>
      <figcaption className="mt-4 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/55">
        O saldo projetado dos próximos doze meses nos três cenários, com as parcelas das vendas que você já fechou.
        Valores de exemplo.
      </figcaption>
    </figure>
  );
}
