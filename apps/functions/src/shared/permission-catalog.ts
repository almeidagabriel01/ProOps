/**
 * Catálogo das permissões de membro: a fonte única do que a tela de Equipe
 * concede, do que o backend aceita gravar e de como cada chave é lida.
 *
 * Cada página (o doc `users/{uid}/permissions/{pageId}`) tem:
 *
 * - as quatro ações básicas (`canView`, `canCreate`, `canEdit`, `canDelete`);
 * - **ações finas** (`kind: "action"`): o que hoje cabe num "Editar" grosso
 *   demais, como aprovar proposta ou dar baixa. Valem só com "Ver" ligado;
 * - **dados sensíveis** (`kind: "data"`): o que o membro vê DENTRO de uma tela
 *   (custo, estoque, saldo). Independem do "Ver" da página, porque o dado
 *   aparece em outras telas também (o custo do produto aparece na proposta);
 * - opcionalmente um **escopo** (`scope`): "da equipe toda" ou "só os meus".
 *
 * **Chave ausente vale o `fallback`**: a ação básica que cobre a ação hoje
 * (`canEdit`, `canView`...), `true` (o dado sensível que todo mundo via) ou
 * `false` (o que hoje é só do dono). É isso que faz um membro antigo, sem a
 * chave gravada, continuar exatamente como estava no dia em que a chave
 * nasceu, sem backfill. É uma exceção deliberada à regra "chave ausente fecha":
 * aqui ela REPRODUZ o que já vale, e o teste do catálogo cobra o fallback de
 * cada chave.
 *
 * Puro, sem import: o front espelha este arquivo em
 * `apps/web/src/lib/permissions/catalog.ts`, com paridade testada.
 */

export type BasePermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete";

export const BASE_PERMISSION_ACTIONS: readonly BasePermissionAction[] = [
  "canView",
  "canCreate",
  "canEdit",
  "canDelete",
];

export type PermissionArea = "geral" | "comercial" | "catalogo" | "operacao" | "financeiro";

export const PERMISSION_AREAS: ReadonlyArray<{ id: PermissionArea; label: string }> = [
  { id: "geral", label: "Geral" },
  { id: "comercial", label: "Comercial" },
  { id: "catalogo", label: "Catálogo" },
  { id: "operacao", label: "Operação" },
  // Notas Fiscais fica dentro do Financeiro: na tela de Equipe é uma aba por área.
  { id: "financeiro", label: "Financeiro" },
];

export interface PermissionExtra {
  key: string;
  kind: "action" | "data";
  label: string;
  description: string;
  /** O que a chave vale quando não está gravada (ver o cabeçalho). */
  fallback: BasePermissionAction | boolean;
}

export interface PermissionScopeOption {
  value: string;
  label: string;
  description: string;
}

export interface PermissionScope {
  /** O valor quando o doc não tem `scope`: sempre o que vale hoje. */
  default: string;
  /** O mais restrito, usado quando o membro perde o "Ver". */
  narrowest: string;
  options: readonly PermissionScopeOption[];
}

export interface PermissionPageDef {
  id: string;
  name: string;
  description: string;
  area: PermissionArea;
  /** Só "Ver" é oferecido. */
  viewOnly?: boolean;
  /** Só aparece para empresas com o módulo financeiro. */
  requiresFinancial?: boolean;
  /** Não é tela: amplia o que o membro vê dentro da página indicada. */
  scopeOf?: string;
  /** Sem doc gravado, "Ver" vale `true` (a Lia, que todo membro já usava). */
  viewWhenMissing?: boolean;
  extras: readonly PermissionExtra[];
  scope?: PermissionScope;
}

const OWN_OR_ALL = (noun: string, owner: string): PermissionScope => ({
  default: "all",
  narrowest: "own",
  options: [
    { value: "all", label: "Da equipe toda", description: `Vê ${noun} de todos.` },
    { value: "own", label: "Só os meus", description: `Vê só ${noun} em que é ${owner}.` },
  ],
});

export const PERMISSION_CATALOG: readonly PermissionPageDef[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Visão geral do dia: tarefas, vendas do mês e, com o financeiro, saldo e fluxo de caixa.",
    area: "geral",
    viewOnly: true,
    extras: [],
  },
  {
    id: "tasks",
    name: "Tarefas",
    description: "O que fazer, com responsável, prazo e @menção.",
    area: "geral",
    extras: [],
  },
  {
    id: "calendar",
    name: "Calendário",
    description: "Agenda da empresa, compromissos e pedidos de visita do link de agendamento.",
    area: "geral",
    extras: [],
  },
  {
    id: "spreadsheets",
    name: "Planilhas",
    description: "Planilhas da empresa.",
    area: "geral",
    extras: [
      {
        key: "import",
        kind: "action",
        label: "Importar planilha",
        description: "Trazer arquivos do Excel ou CSV.",
        fallback: "canCreate",
      },
    ],
    scope: OWN_OR_ALL("as planilhas", "quem criou"),
  },
  {
    id: "lia",
    name: "Lia (assistente)",
    description: "Conversar com a Lia. Ela só faz o que as outras permissões do membro deixam.",
    area: "geral",
    viewOnly: true,
    viewWhenMissing: true,
    extras: [],
  },
  {
    id: "kanban",
    name: "CRM",
    description: "Leads, quadro de propostas e atividades. A aba Lançamentos pede também ver Lançamentos.",
    area: "comercial",
    extras: [
      {
        key: "columns",
        kind: "action",
        label: "Mexer nas colunas",
        description: "Criar, renomear, reordenar e excluir colunas do quadro (a coluna decide o que conta como venda).",
        fallback: "canEdit",
      },
      {
        key: "reassignLead",
        kind: "action",
        label: "Trocar o dono do lead",
        description: "Passar um lead para outra pessoa da equipe.",
        fallback: "canEdit",
      },
    ],
    scope: OWN_OR_ALL("os leads", "o dono"),
  },
  {
    id: "proposals",
    name: "Propostas",
    description: "Criar e acompanhar propostas.",
    area: "comercial",
    extras: [
      {
        key: "approve",
        kind: "action",
        label: "Aprovar e reverter",
        description: "Aprovar (gera os lançamentos, o projeto e o contrato), reverter a aprovação e confirmar o aceite do cliente.",
        fallback: "canEdit",
      },
      {
        key: "share",
        kind: "action",
        label: "Enviar ao cliente",
        description: "Gerar o link público da proposta, com aceite online.",
        fallback: "canView",
      },
      {
        key: "discount",
        kind: "action",
        label: "Dar desconto",
        description: "Desconto em percentual e valor fechado da proposta.",
        fallback: "canEdit",
      },
      {
        key: "changeSeller",
        kind: "action",
        label: "Trocar o responsável",
        description: "Mudar quem vendeu e os parceiros da proposta (conta na meta de cada um).",
        fallback: "canEdit",
      },
      {
        key: "commissions",
        kind: "action",
        label: "Editar comissões",
        description: "Mudar quem recebe comissão na proposta e o percentual.",
        fallback: "canEdit",
      },
    ],
    scope: OWN_OR_ALL("as propostas", "o responsável pela venda"),
  },
  {
    id: "clients",
    name: "Clientes",
    description: "Contatos: clientes, fornecedores e parceiros.",
    area: "comercial",
    extras: [
      {
        key: "portal",
        kind: "action",
        label: "Portal do cliente",
        description: "Criar, trocar e mandar o link do portal (pede também ver Propostas ou Lançamentos).",
        fallback: "canEdit",
      },
      {
        key: "reassign",
        kind: "action",
        label: "Trocar o responsável",
        description: "Mudar quem da equipe cuida do contato e os parceiros dele.",
        fallback: "canEdit",
      },
      {
        key: "priceTable",
        kind: "action",
        label: "Tabela de preço do cliente",
        description: "Escolher a tabela de preço que vale nas propostas do contato.",
        fallback: "canEdit",
      },
    ],
    scope: OWN_OR_ALL("os contatos", "o responsável"),
  },
  {
    id: "products",
    name: "Produtos",
    description: "Catálogo de produtos e tabelas de preço.",
    area: "catalogo",
    extras: [
      {
        key: "editPrice",
        kind: "action",
        label: "Mudar preço",
        description: "Custo, markup e preço por faixa (sem isso, edita só o resto do cadastro).",
        fallback: "canEdit",
      },
      {
        key: "adjustStock",
        kind: "action",
        label: "Ajustar estoque",
        description: "Mudar a quantidade em estoque à mão.",
        fallback: "canEdit",
      },
      {
        key: "import",
        kind: "action",
        label: "Importar planilha",
        description: "Cadastrar produtos em lote por planilha.",
        fallback: "canCreate",
      },
      {
        key: "viewCost",
        kind: "data",
        label: "Ver custo, markup e lucro",
        description: "Em Produtos, Soluções, Propostas, no CRM e na Lia. Sem isso, vê só o preço final.",
        fallback: true,
      },
      {
        key: "viewStock",
        kind: "data",
        label: "Ver estoque",
        description: "Quantidades e saldos em estoque, em Produtos, na proposta e na OS.",
        fallback: true,
      },
    ],
  },
  {
    id: "services",
    name: "Serviços",
    description: "Catálogo de serviços.",
    area: "catalogo",
    extras: [
      {
        key: "import",
        kind: "action",
        label: "Importar planilha",
        description: "Cadastrar serviços em lote por planilha.",
        fallback: "canCreate",
      },
    ],
  },
  {
    id: "solutions",
    name: "Soluções",
    description: "Sistemas, ambientes e modelos usados nas propostas.",
    area: "catalogo",
    extras: [],
  },
  {
    id: "projects",
    name: "Projetos",
    description: "Obras de instalação: etapas, fotos e entrega.",
    area: "operacao",
    extras: [
      {
        key: "assign",
        kind: "action",
        label: "Trocar o responsável",
        description: "Mudar quem cuida da obra.",
        fallback: "canEdit",
      },
      {
        key: "cancel",
        kind: "action",
        label: "Cancelar obra",
        description: "Mudar a obra para cancelada.",
        fallback: "canEdit",
      },
      {
        key: "deliveryLink",
        kind: "action",
        label: "Link de entrega",
        description: "Gerar o link público em que o cliente aceita a entrega.",
        fallback: "canEdit",
      },
      {
        key: "schedule",
        kind: "action",
        label: "Agendar visita",
        description: "Marcar a visita de uma etapa na Agenda.",
        fallback: "canEdit",
      },
    ],
    scope: OWN_OR_ALL("as obras", "o responsável"),
  },
  {
    id: "service_orders",
    name: "Ordens de serviço",
    description: "Chamados técnicos: agenda, execução e assinatura do cliente.",
    area: "operacao",
    extras: [
      {
        key: "complete",
        kind: "action",
        label: "Concluir com assinatura",
        description: "Fechar a OS com a assinatura do cliente (baixa o estoque).",
        fallback: "canEdit",
      },
      {
        key: "share",
        kind: "action",
        label: "Link e PDF da OS",
        description: "Gerar o link público e o PDF da OS.",
        fallback: "canView",
      },
      {
        key: "reopen",
        kind: "action",
        label: "Reabrir OS concluída",
        description: "Destravar uma OS já assinada (fica registrado o motivo).",
        fallback: false,
      },
      {
        key: "viewPrices",
        kind: "data",
        label: "Ver valores da OS",
        description: "Preço das peças e serviços e o total da OS.",
        fallback: true,
      },
    ],
  },
  {
    id: "service_orders_all",
    name: "Todas as ordens de serviço",
    description: "Ver e coordenar as OS da equipe inteira, e não só as atribuídas a ele.",
    area: "operacao",
    viewOnly: true,
    scopeOf: "service_orders",
    extras: [],
  },
  {
    id: "equipment",
    name: "Equipamentos",
    description: "Aparelhos instalados nos clientes, com garantia e histórico.",
    area: "operacao",
    extras: [],
  },
  {
    id: "contracts",
    name: "Contratos",
    description: "Mensalidades de manutenção e monitoramento, com visitas preventivas.",
    area: "operacao",
    extras: [
      {
        key: "lifecycle",
        kind: "action",
        label: "Ativar, suspender e encerrar",
        description: "Ligar e desligar a cobrança do contrato (ligar pede também criar lançamentos).",
        fallback: "canEdit",
      },
      {
        key: "editBilling",
        kind: "action",
        label: "Mudar a cobrança",
        description: "Valor, dia de cobrança, carteira e NFS-e de um contrato que já cobra.",
        fallback: "canEdit",
      },
      {
        key: "pmocShare",
        kind: "action",
        label: "Link e PDF do PMOC",
        description: "Gerar o documento do PMOC para a fiscalização.",
        fallback: "canView",
      },
      {
        key: "viewValues",
        kind: "data",
        label: "Ver valores dos contratos",
        description: "Mensalidade, itens cobrados e a receita mensal somada.",
        fallback: true,
      },
    ],
  },
  {
    id: "transactions",
    name: "Lançamentos",
    description: "Contas a pagar e a receber.",
    area: "financeiro",
    requiresFinancial: true,
    extras: [
      {
        key: "settle",
        kind: "action",
        label: "Dar baixa",
        description: "Marcar como pago e registrar pagamento parcial (move o saldo).",
        fallback: "canEdit",
      },
      {
        key: "revert",
        kind: "action",
        label: "Estornar pagamento",
        description: "Voltar um lançamento pago para pendente.",
        fallback: "canEdit",
      },
      {
        key: "extraCosts",
        kind: "action",
        label: "Custos extras",
        description: "Acrescentar e mudar custos extras de um lançamento.",
        fallback: "canEdit",
      },
      {
        key: "share",
        kind: "action",
        label: "Link de cobrança",
        description: "Gerar o link público com Pix e boleto.",
        fallback: "canEdit",
      },
      {
        key: "export",
        kind: "action",
        label: "Exportar",
        description: "Baixar os lançamentos e o DRE em planilha.",
        fallback: "canView",
      },
      {
        key: "viewCommissions",
        kind: "data",
        label: "Ver comissões",
        description: "Relatório de comissões e o painel do Dashboard (sem isso, cada parceiro vê só as próprias).",
        fallback: false,
      },
    ],
    scope: {
      default: "all",
      narrowest: "mine",
      options: [
        { value: "all", label: "Tudo", description: "Receitas e despesas da empresa." },
        { value: "income", label: "Só receitas", description: "Sem despesas nem comissões, e sem o saldo das carteiras." },
        { value: "mine", label: "Só das minhas vendas", description: "Só as receitas das propostas em que é o responsável." },
      ],
    },
  },
  {
    id: "wallet",
    name: "Carteiras",
    description: "Contas e caixas da empresa.",
    area: "financeiro",
    requiresFinancial: true,
    extras: [
      {
        key: "transfer",
        kind: "action",
        label: "Transferir",
        description: "Passar valor de uma carteira para outra.",
        fallback: "canEdit",
      },
      {
        key: "adjustBalance",
        kind: "action",
        label: "Ajustar saldo",
        description: "Corrigir o saldo à mão.",
        fallback: "canEdit",
      },
      {
        key: "archive",
        kind: "action",
        label: "Arquivar",
        description: "Tirar a carteira de uso sem apagar o histórico.",
        fallback: "canEdit",
      },
      {
        key: "viewBalance",
        kind: "data",
        label: "Ver saldo",
        description: "Saldo das carteiras, no Dashboard e em Lançamentos.",
        fallback: true,
      },
    ],
  },
  {
    id: "invoices",
    name: "Notas Fiscais",
    description: "Emissão e acompanhamento de notas.",
    area: "financeiro",
    requiresFinancial: true,
    extras: [
      {
        key: "cancel",
        kind: "action",
        label: "Cancelar nota",
        description: "Cancelar uma nota autorizada.",
        fallback: "canDelete",
      },
      {
        key: "correct",
        kind: "action",
        label: "Carta de correção",
        description: "Corrigir uma NF-e autorizada.",
        fallback: "canEdit",
      },
      {
        key: "manifest",
        kind: "action",
        label: "Responder nota de entrada",
        description: "Manifestar (confirmar, desconhecer) uma nota recebida perante a Receita.",
        fallback: "canEdit",
      },
      {
        key: "launchReceived",
        kind: "action",
        label: "Lançar nota de entrada",
        description: "Lançar uma nota recebida como despesa (pede também criar lançamentos).",
        fallback: "canEdit",
      },
    ],
  },
];

const PAGE_BY_ID = new Map(PERMISSION_CATALOG.map((page) => [page.id, page]));

export function getPermissionPageDef(pageId: string): PermissionPageDef | undefined {
  return PAGE_BY_ID.get(pageId);
}

export function isBasePermissionAction(key: string): key is BasePermissionAction {
  return (BASE_PERMISSION_ACTIONS as readonly string[]).includes(key);
}

export function getPermissionExtra(pageId: string, key: string): PermissionExtra | undefined {
  return PAGE_BY_ID.get(pageId)?.extras.find((extra) => extra.key === key);
}

/** As chaves que o doc de uma página pode guardar (sem `scope`). */
export function permissionKeysOf(pageId: string): string[] {
  const page = PAGE_BY_ID.get(pageId);
  if (!page) return [];
  return [...BASE_PERMISSION_ACTIONS, ...page.extras.map((extra) => extra.key)];
}

type PermissionDoc = Record<string, unknown> | null | undefined;

/**
 * O que uma chave vale para um membro, a partir do doc gravado. Não conhece
 * dono nem administrador: quem chama decide o bypass.
 */
export function resolvePermissionKey(pageId: string, doc: PermissionDoc, key: string): boolean {
  const page = PAGE_BY_ID.get(pageId);
  if (!page) return false;
  const canView = doc ? doc.canView === true : page.viewWhenMissing === true;

  // As quatro ações básicas são lidas como sempre foram (a cascata "sem Ver
  // não há o resto" é aplicada na gravação): um doc antigo com "Criar" e sem
  // "Ver" continua valendo o que valia.
  if (isBasePermissionAction(key)) {
    return key === "canView" ? canView : doc?.[key] === true;
  }

  const extra = page.extras.find((item) => item.key === key);
  if (!extra) return false;
  const stored = doc?.[key];
  if (extra.kind === "data") {
    // Dado sensível independe do "Ver" da página: o custo do produto aparece
    // na proposta de quem nem abre Produtos.
    if (typeof stored === "boolean") return stored;
    return typeof extra.fallback === "boolean" ? extra.fallback : doc?.[extra.fallback] === true;
  }
  if (typeof stored === "boolean") return canView && stored;
  if (typeof extra.fallback === "boolean") return canView && extra.fallback;
  return extra.fallback === "canView" ? canView : doc?.[extra.fallback] === true;
}

/** O escopo de uma página para um membro (só páginas com `scope`). */
export function resolvePermissionScope(pageId: string, doc: PermissionDoc): string | null {
  const scope = PAGE_BY_ID.get(pageId)?.scope;
  if (!scope) return null;
  const stored = doc?.scope;
  return typeof stored === "string" && scope.options.some((option) => option.value === stored)
    ? stored
    : scope.default;
}

/**
 * O doc que se grava a partir do que a tela mandou: chaves desconhecidas saem,
 * sem "Ver" as ações (básicas e finas) caem para `false` e o escopo vai para
 * o mais restrito. Dado sensível é preservado como veio.
 */
export function normalizePermissionDoc(
  pageId: string,
  input: Record<string, unknown>,
): Record<string, boolean | string> {
  const page = PAGE_BY_ID.get(pageId);
  const out: Record<string, boolean | string> = {};
  const canView = input.canView === true;
  out.canView = canView;
  for (const action of BASE_PERMISSION_ACTIONS) {
    if (action === "canView") continue;
    out[action] = canView && input[action] === true;
  }
  for (const extra of page?.extras ?? []) {
    const value = input[extra.key];
    if (typeof value !== "boolean") continue;
    out[extra.key] = extra.kind === "action" ? canView && value : value;
  }
  if (page?.scope) {
    const scope = input.scope;
    if (!canView) {
      out.scope = page.scope.narrowest;
    } else if (typeof scope === "string" && page.scope.options.some((option) => option.value === scope)) {
      out.scope = scope;
    }
  }
  return out;
}

/** O valor é aceitável para a chave daquela página? */
export function isValidPermissionValue(pageId: string, key: string, value: unknown): boolean {
  const page = PAGE_BY_ID.get(pageId);
  if (!page) return false;
  if (key === "scope") {
    return typeof value === "string" && Boolean(page.scope?.options.some((option) => option.value === value));
  }
  if (isBasePermissionAction(key)) return typeof value === "boolean";
  return typeof value === "boolean" && page.extras.some((extra) => extra.key === key);
}
