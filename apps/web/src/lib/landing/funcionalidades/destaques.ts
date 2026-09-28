import type { Destaque } from "./tipos";

/**
 * Os cinco destaques da seção "Recursos" da home, na ordem do ciclo que a
 * ProOps cobre: vender, entregar pelo link, receber, executar a obra e
 * delegar para a Lia.
 *
 * Cada um abre a página da funcionalidade correspondente. Os itens antigos
 * (contatos, catálogo, permissões, planilhas) estão na lista de
 * `/funcionalidades`: todo ERP tem, e nenhum explica por que alguém trocaria
 * de sistema.
 */
export const DESTAQUES: readonly Destaque[] = [
  {
    id: "proposta",
    titulo: "Proposta que fecha pelo link",
    frase:
      "O cliente abre no celular, pede ajustes ou aceita com nome e CPF, e você sabe no mesmo minuto.",
    principal: "aceite-online",
    recursos: ["aceite-online", "pedido-de-mudancas", "alertas-de-proposta", "editor-de-pdf"],
    funcionalidade: "aceite-online",
  },
  {
    id: "pos-venda",
    titulo: "Pós-venda por link",
    frase:
      "Recibo, Pix, obra, agendamento e portal: o cliente acompanha tudo sem ligar para perguntar.",
    principal: "portal-do-cliente",
    recursos: ["portal-do-cliente", "pagamento-online", "link-da-obra", "link-de-agendamento", "link-do-contador"],
    funcionalidade: "pos-venda",
  },
  {
    id: "financeiro",
    titulo: "O financeiro nasce da venda",
    frase:
      "Aprovou, as parcelas e as comissões já estão lançadas. O fluxo de caixa mostra os próximos meses em três cenários.",
    principal: "lancamentos",
    recursos: ["lancamentos", "comissoes", "fluxo-de-caixa", "dre", "carteiras"],
    funcionalidade: "financeiro",
  },
  {
    id: "obra",
    titulo: "Obra do início à entrega",
    frase:
      "As etapas do seu segmento, com checklist, fotos e visita marcada, até o cliente aceitar a entrega.",
    principal: "projetos",
    recursos: ["projetos", "visita-da-etapa", "google-agenda", "aceite-da-entrega"],
    funcionalidade: "obras",
  },
  {
    id: "lia",
    titulo: "A Lia faz, você confirma",
    frase:
      "Peça em português: ela cria a proposta, dá baixa na parcela ou move o lead, e só grava depois do seu ok.",
    principal: "lia-acoes",
    recursos: ["lia-acoes", "lia-textos"],
    funcionalidade: "lia",
  },
];
