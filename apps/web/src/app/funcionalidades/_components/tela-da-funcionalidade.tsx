import React from "react";

import { CenaDoDestaque } from "@/components/landing/recursos/palco-dos-destaques";
import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { etapasDaObra } from "@/components/marketing/mocks/dados";
import { JanelaDoErp } from "@/components/marketing/mocks/janela-do-erp";
import { TelaAgendamento } from "@/components/marketing/mocks/telas/telas-do-cliente";
import {
  TelaCatalogo,
  TelaContato,
  TelaEquipe,
  TelaLancamentos,
  TelaPainelNoCelular,
  TelaPropostaEmPassos,
} from "@/components/marketing/mocks/telas/telas-da-operacao";
import {
  TelaDocumento,
  TelaLeads,
  TelaNotaFiscal,
  TelaObraInterna,
} from "@/components/marketing/mocks/telas/telas-do-erp";
import type { FuncionalidadeSlug } from "@/lib/landing/funcionalidades";
import { DEFAULT_NICHE, NICHE_REGISTRY } from "@/lib/niches/registry";

import { VitrineLia } from "./vitrine-lia";
import { VitrineFluxo } from "./vitrines";

const ETAPAS = etapasDaObra(NICHE_REGISTRY[DEFAULT_NICHE].stageTemplate, 1);

function Janela({ children }: { children: React.ReactNode }) {
  return <JanelaDoErp proporcao="16 / 11">{children}</JanelaDoErp>;
}

function Celular({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <DeviceFrame className="w-[62%] max-w-[290px]">
        <div className="absolute inset-0">{children}</div>
      </DeviceFrame>
    </div>
  );
}

/**
 * Uma cena do palco da home (o celular com o aviso de abertura, o leque dos
 * links), com a entrada que ela já tem: o CSS de `.destaque-camada` toca a
 * animação quando a camada está ativa, e aqui ela está sempre.
 */
function CenaDaHome({ id }: { id: string }) {
  return (
    <div className="aspect-[4/3.4]">
      <div className="destaque-camada h-full" data-ativo="">
        <CenaDoDestaque id={id} etapas={ETAPAS} />
      </div>
    </div>
  );
}

/**
 * A tela que ilustra cada funcionalidade, sempre uma réplica codada do ERP ou
 * do link que o cliente recebe. `Record` de propósito: funcionalidade nova sem
 * tela não compila.
 */
const TELAS: Record<FuncionalidadeSlug, () => React.ReactNode> = {
  crm: () => (
    <Janela>
      <TelaLeads />
    </Janela>
  ),
  contatos: () => (
    <Janela>
      <TelaContato />
    </Janela>
  ),
  catalogo: () => (
    <Janela>
      <TelaCatalogo />
    </Janela>
  ),
  propostas: () => (
    <Janela>
      <TelaPropostaEmPassos />
    </Janela>
  ),
  "aceite-online": () => <CenaDaHome id="proposta" />,
  "pdf-da-proposta": () => (
    <Janela>
      <TelaDocumento />
    </Janela>
  ),
  obras: () => (
    <Janela>
      <TelaObraInterna etapas={ETAPAS} />
    </Janela>
  ),
  agenda: () => (
    <Celular>
      <TelaAgendamento tipoDeVisita={NICHE_REGISTRY[DEFAULT_NICHE].defaultVisitType.label} />
    </Celular>
  ),
  "pos-venda": () => <CenaDaHome id="pos-venda" />,
  financeiro: () => (
    <Janela>
      <TelaLancamentos />
    </Janela>
  ),
  "fluxo-de-caixa-e-dre": () => <VitrineFluxo />,
  "notas-fiscais": () => (
    <Janela>
      <TelaNotaFiscal />
    </Janela>
  ),
  lia: () => <VitrineLia />,
  "equipe-e-seguranca": () => (
    <Janela>
      <TelaEquipe />
    </Janela>
  ),
  "no-dia-a-dia": () => (
    <Celular>
      <TelaPainelNoCelular />
    </Celular>
  ),
};

export function TelaDaFuncionalidade({ slug }: { slug: FuncionalidadeSlug }) {
  return <>{TELAS[slug]()}</>;
}
