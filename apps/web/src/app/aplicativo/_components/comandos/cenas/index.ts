import type React from "react";

import type { CenaId } from "../../../_content/comandos";
import { CenaDesfazer } from "./cena-desfazer";
import { CenaFatura } from "./cena-fatura";
import { CenaMeta } from "./cena-meta";
import { CenaParcelas } from "./cena-parcelas";
import { CenaSimulacao } from "./cena-simulacao";
import { CenaTransferencia } from "./cena-transferencia";
import type { PropsDaCena } from "./tipos";

/**
 * O diagrama de cada operação. Um `Record` e não um `switch`: uma operação nova
 * em `comandos.ts` com uma `cena` sem entrada aqui não compila.
 */
export const CENAS: Record<CenaId, React.ComponentType<PropsDaCena>> = {
  parcelas: CenaParcelas,
  simulacao: CenaSimulacao,
  fatura: CenaFatura,
  transferencia: CenaTransferencia,
  meta: CenaMeta,
  desfazer: CenaDesfazer,
};

export type { PropsDaCena };
