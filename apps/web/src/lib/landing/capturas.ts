import type { FuncionalidadeSlug } from "./funcionalidades/slugs";
import type { TenantNicheId } from "@/lib/niches/registry";

/**
 * Os prints de verdade do ERP usados nas páginas de venda. Saem de
 * `tests/capturas-do-erp` (emuladores próprios, a demonstração de cada nicho
 * como empresa de exemplo) e moram em `public/capturas/`. Quando uma tela muda,
 * refaz-se o print pelo mesmo roteiro; o teste `capturas.test.ts` reprova se um
 * arquivo daqui não existir.
 *
 * Os dados nas telas são os das demonstrações: fictícios, e ditos assim na
 * legenda de cada página.
 */

export type FormatoDaCaptura = "desktop" | "celular";

export interface Captura {
  src: `/capturas/${string}.webp`;
  formato: FormatoDaCaptura;
  largura: number;
  altura: number;
  /** O que a tela mostra, para quem não a vê. */
  alt: string;
}

const desktop = (arquivo: string, alt: string): Captura => ({
  src: `/capturas/${arquivo}.webp`,
  formato: "desktop",
  largura: 1600,
  altura: 1000,
  alt,
});

const celular = (arquivo: string, alt: string): Captura => ({
  src: `/capturas/${arquivo}.webp`,
  formato: "celular",
  largura: 780,
  altura: 1688,
  alt,
});

export const CAPTURAS_DAS_FUNCIONALIDADES: Record<FuncionalidadeSlug, Captura> = {
  crm: desktop("funcionalidades/crm", "Tela de leads do CRM da ProOps, com o funil dividido em colunas por etapa."),
  contatos: desktop("funcionalidades/contatos", "Ficha de uma cliente na ProOps, com dados de contato, propostas e financeiro."),
  catalogo: desktop("funcionalidades/catalogo", "Catálogo de produtos da ProOps, com custo, preço de venda e estoque de cada item."),
  propostas: desktop("funcionalidades/propostas", "Lista de propostas da ProOps, com cliente, valor e situação de cada uma."),
  "aceite-online": celular(
    "funcionalidades/aceite-online",
    "Link da proposta aberto no celular do cliente, com os botões Solicitar mudanças e Aceitar proposta.",
  ),
  "pdf-da-proposta": desktop(
    "funcionalidades/pdf-da-proposta",
    "Editor de PDF da ProOps, com as seções da proposta à esquerda e a prévia da capa à direita.",
  ),
  obras: desktop("funcionalidades/obras", "Obra na ProOps, com as etapas, o checklist da etapa atual e a visita marcada."),
  agenda: desktop("funcionalidades/agenda", "Agenda da empresa na ProOps, em visão de mês, com a visita técnica marcada."),
  "pos-venda": celular(
    "funcionalidades/pos-venda",
    "Portal do cliente aberto no celular, com a proposta aprovada e o andamento da obra.",
  ),
  financeiro: desktop(
    "funcionalidades/financeiro",
    "Lançamentos da ProOps agrupados por venda, com as parcelas e o que falta receber.",
  ),
  "fluxo-de-caixa-e-dre": desktop(
    "funcionalidades/fluxo-de-caixa-e-dre",
    "Fluxo de caixa da ProOps, com o saldo projetado dos próximos meses.",
  ),
  "notas-fiscais": desktop("funcionalidades/notas-fiscais", "Lista de notas fiscais emitidas na ProOps, com cliente, valor e situação."),
  lia: desktop("funcionalidades/lia", "Painel da ProOps com a conversa com a Lia aberta ao lado."),
  "equipe-e-seguranca": desktop(
    "funcionalidades/equipe-e-seguranca",
    "Tela de equipe da ProOps, com os membros e as permissões de cada um.",
  ),
  "no-dia-a-dia": celular(
    "funcionalidades/no-dia-a-dia",
    "Painel da ProOps no celular, com o saldo, os atalhos e a barra de navegação embaixo.",
  ),
};

export interface CapturasDoNicho {
  proposta: Captura;
  obra: Captura;
  produtos: Captura;
}

function doNicho(nicho: TenantNicheId, rotulo: string): CapturasDoNicho {
  return {
    proposta: desktop(`nichos/${nicho}/proposta`, `Proposta de ${rotulo} na ProOps, com os itens agrupados e o total.`),
    obra: desktop(`nichos/${nicho}/obra`, `Obra de ${rotulo} na ProOps, com as etapas do segmento e o checklist.`),
    produtos: desktop(`nichos/${nicho}/produtos`, `Catálogo de produtos de ${rotulo} na ProOps, com preço e estoque.`),
  };
}

export const CAPTURAS_DOS_NICHOS: Record<TenantNicheId, CapturasDoNicho> = {
  automacao_residencial: doNicho("automacao_residencial", "automação residencial"),
  cortinas: doNicho("cortinas", "persianas e toldos"),
  seguranca_eletronica: doNicho("seguranca_eletronica", "segurança eletrônica"),
  vidracaria_esquadrias: doNicho("vidracaria_esquadrias", "vidraçaria"),
  marcenaria: doNicho("marcenaria", "marcenaria"),
};
