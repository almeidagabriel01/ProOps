import React from "react";
import { BellRing } from "lucide-react";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { CLIENTE_DEMO, type EtapaDemo } from "@/components/marketing/mocks/dados";
import { JanelaDoErp } from "@/components/marketing/mocks/janela-do-erp";
import {
  TelaEntregaObra,
  TelaPortal,
  TelaPropostaLink,
  TelaRecibo,
} from "@/components/marketing/mocks/telas/telas-do-cliente";
import { TelaFluxoDeCaixa, TelaLia, TelaObraInterna } from "@/components/marketing/mocks/telas/telas-do-erp";
import { cn } from "@/lib/utils";

/**
 * O que o palco mostra para cada destaque. Uma cena por destaque, todas no
 * HTML, e o CSS (`.destaque-camada` em `app/vitrine.css`) troca a camada ativa
 * e toca a entrada dela: a assinatura se desenha, o leque de celulares abre, o
 * gráfico corre, as etapas enchem, a Lia confirma. Nenhuma delas usa
 * JavaScript de animação; o componente pai só escreve qual está ativa.
 */
export function CenaDoDestaque({ id, etapas }: { id: string; etapas: readonly EtapaDemo[] }) {
  switch (id) {
    case "proposta":
      return (
        <div className="relative flex h-full items-center justify-center">
          <DeviceFrame className="destaque-celular w-[46%] max-w-[270px]">
            <div className="absolute inset-0">
              <TelaPropostaLink />
            </div>
          </DeviceFrame>
          <div
            data-mk="aviso"
            className="absolute right-[2%] top-[14%] flex w-[15rem] items-start gap-3 rounded-2xl border border-black/10 bg-white p-3.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.35)] dark:border-white/12 dark:bg-neutral-900"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
              <BellRing className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 text-[13px] leading-snug">
              <span className="block font-semibold text-black dark:text-white">{CLIENTE_DEMO} abriu a proposta</span>
              <span className="block text-black/50 dark:text-white/50">agora, pelo celular</span>
            </span>
          </div>
        </div>
      );
    case "pos-venda":
      return (
        <div className="destaque-leque relative flex h-full items-center justify-center">
          {[
            { tela: <TelaRecibo />, classe: "destaque-leque-esq" },
            { tela: <TelaEntregaObra etapas={etapas} />, classe: "destaque-leque-dir" },
            { tela: <TelaPortal />, classe: "destaque-leque-centro" },
          ].map(({ tela, classe }) => (
            <DeviceFrame key={classe} className={cn("absolute w-[36%] max-w-[230px]", classe)}>
              <div className="absolute inset-0">{tela}</div>
            </DeviceFrame>
          ))}
        </div>
      );
    case "financeiro":
      return (
        <div className="flex h-full items-center">
          <JanelaDoErp proporcao="16 / 9.4" className="w-full">
            <TelaFluxoDeCaixa />
          </JanelaDoErp>
        </div>
      );
    case "obra":
      return (
        <div className="flex h-full items-center">
          <JanelaDoErp proporcao="16 / 10" className="w-full">
            <TelaObraInterna etapas={etapas} />
          </JanelaDoErp>
        </div>
      );
    case "lia":
      return (
        <div className="flex h-full items-center">
          <JanelaDoErp proporcao="16 / 10" className="w-full">
            <TelaLia />
          </JanelaDoErp>
        </div>
      );
    default:
      return null;
  }
}
