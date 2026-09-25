import {
  flattenMenuItems,
  type MenuCapability,
  type MenuItem,
} from "@/components/layout/navigation-config";

/**
 * O roteiro do tutorial: quais telas ele apresenta, em que ordem e com que
 * texto. Puro de propósito (sem React, sem provider), para a matriz de plano,
 * papel e nicho ser testável sem montar a árvore inteira.
 *
 * Um passo é uma ROTA, não um elemento da página. A lista nasce de duas fontes
 * que já existem, e nunca de uma terceira cópia:
 *
 * - `menuItems`, já filtrado por nicho, permissão e `masterOnly` pelo
 *   `useNavigationItems` (o mesmo gate da dock);
 * - `SETTINGS_NAV_GROUPS`, a sidebar de `/settings`.
 *
 * Todo destino dessas duas listas precisa de um template aqui ou de uma
 * entrada em `ROUTES_WITHOUT_OWN_STEP`. O guard de cobertura
 * (`__tests__/onboarding-steps.test.ts`) falha se uma tela nova entrar no menu
 * sem passo: foi assim que Comissões e Notas Fiscais ficaram de fora do
 * tutorial em silêncio.
 */

export const ONBOARDING_VERSION = "core-v2";

/**
 * Capacidades que o tutorial consulta. As do menu decidem se um passo existe;
 * as demais só decidem se um item do checklist aparece (não faz sentido
 * ensinar a sincronizar o Google Agenda para quem não tem a integração).
 */
export type OnboardingCapability =
  | MenuCapability
  | "pdfEditor"
  | "calendarSync"
  | "driveSync"
  | "onlinePayments"
  | "fiscalReceiving";

export type OnboardingCapabilityMap = Record<OnboardingCapability, boolean>;

export type OnboardingChapterId =
  | "overview"
  | "sales"
  | "catalog"
  | "financial"
  | "tools"
  | "settings";

export const ONBOARDING_CHAPTERS: Record<
  OnboardingChapterId,
  { label: string; order: number }
> = {
  overview: { label: "Visão geral", order: 0 },
  sales: { label: "Vendas", order: 1 },
  catalog: { label: "Catálogo", order: 2 },
  financial: { label: "Financeiro", order: 3 },
  tools: { label: "Ferramentas", order: 4 },
  settings: { label: "Configurações", order: 5 },
};

export interface OnboardingChecklistItem {
  text: string;
  /** O item só aparece quando o plano abre esta capacidade. */
  requiresCapability?: OnboardingCapability;
}

export interface OnboardingStepTemplate {
  id: string;
  route: string;
  chapter: OnboardingChapterId;
  /** Título próprio. Sem ele, vale o rótulo do menu (que muda por nicho). */
  title?: string;
  description: string;
  checklist: OnboardingChecklistItem[];
  actionLabel: string;
  /** Some para membro. Os itens do MENU já chegam filtrados; isto é para Configurações. */
  masterOnly?: boolean;
  /** Some na conta free: a tela não tem o que demonstrar em somente leitura. */
  excludeFromDemo?: boolean;
  /** O passo só existe se o plano abrir AO MENOS UMA destas capacidades. */
  requiresAnyCapability?: OnboardingCapability[];
}

export interface OnboardingStep {
  id: string;
  route: string;
  chapter: OnboardingChapterId;
  title: string;
  description: string;
  checklist: string[];
  actionLabel: string;
}

export const MENU_STEP_TEMPLATES: Record<string, OnboardingStepTemplate> = {
  "/dashboard": {
    id: "dashboard",
    route: "/dashboard",
    chapter: "overview",
    description:
      "O resumo do negócio numa tela só: o que precisa de atenção hoje, como estão as vendas e para onde vai o caixa.",
    checklist: [
      { text: "Os alertas do topo mostram o que venceu e o que vence nos próximos dias." },
      { text: "As ações rápidas criam uma proposta, um contato ou um lançamento sem sair daqui." },
      {
        text: "Os gráficos projetam o fluxo de caixa e o saldo futuro das carteiras.",
        requiresCapability: "financial",
      },
      { text: "Acompanhe a taxa de conversão e as últimas propostas enviadas." },
    ],
    actionLabel: "Abrir o Dashboard",
  },
  "/proposals": {
    id: "proposals",
    route: "/proposals",
    chapter: "sales",
    description:
      "O coração da ProOps: monte o orçamento com os itens do seu catálogo, gere o PDF com a sua marca e acompanhe cada proposta até a aprovação.",
    checklist: [
      { text: "Em Nova proposta, escolha o cliente, os itens e as condições de pagamento." },
      { text: "Baixe o PDF ou envie o link compartilhável para o cliente ver no celular." },
      {
        text: "Ajuste capa, seções e cores do PDF no editor da proposta.",
        requiresCapability: "pdfEditor",
      },
      { text: "Ao aprovar, as parcelas combinadas viram lançamentos no Financeiro.", requiresCapability: "financial" },
      {
        text: "Na aprovação, a ProOps convida a emitir a nota fiscal da venda.",
        requiresCapability: "fiscal",
      },
    ],
    actionLabel: "Abrir Propostas",
  },
  "/crm": {
    id: "crm",
    route: "/crm",
    chapter: "sales",
    description:
      "O funil de vendas em colunas: cada card é uma negociação, e a coluna diz em que ponto ela está.",
    checklist: [
      { text: "Arraste o card entre as colunas para atualizar o status da proposta." },
      { text: "Abra um card para ver os detalhes sem sair do quadro." },
      { text: "Priorize as negociações mais perto de fechar." },
    ],
    actionLabel: "Abrir o CRM",
  },
  "/contacts": {
    id: "contacts",
    route: "/contacts",
    chapter: "sales",
    description:
      "Clientes, fornecedores, vendedores e arquitetos num cadastro só, que alimenta propostas, financeiro e comissões.",
    checklist: [
      { text: "Busque pelo início do nome ou do telefone e filtre pelo tipo de contato." },
      { text: "Marque vendedores e arquitetos com o percentual de comissão de cada um." },
      {
        text: "Preencha os dados fiscais do cliente para emitir nota sem pendências.",
        requiresCapability: "fiscal",
      },
    ],
    actionLabel: "Abrir Contatos",
  },
  "/calendar": {
    id: "calendar",
    route: "/calendar",
    chapter: "sales",
    title: "Agenda",
    description:
      "Visitas, instalações e retornos da equipe organizados por dia, semana ou mês.",
    checklist: [
      { text: "Clique numa data para marcar um compromisso." },
      { text: "Troque entre as visões de dia, semana e mês." },
      {
        text: "Conecte o Google Agenda para ver os compromissos também no celular.",
        requiresCapability: "calendarSync",
      },
    ],
    actionLabel: "Abrir a Agenda",
  },
  "/products": {
    id: "products",
    route: "/products",
    chapter: "catalog",
    description:
      "Os produtos que você vende, com preço, fotos e estoque, prontos para entrar numa proposta em poucos cliques.",
    checklist: [
      { text: "Cadastre o produto com custo, markup, preço de venda e fotos." },
      { text: "Edite preço, estoque e fotos sempre que precisar." },
      {
        text: "Informe o NCM do produto (a Lia sugere um) para emitir NF-e.",
        requiresCapability: "fiscal",
      },
    ],
    actionLabel: "Abrir Produtos",
  },
  "/services": {
    id: "services",
    route: "/services",
    chapter: "catalog",
    description:
      "A mão de obra e os serviços que acompanham a venda, como instalação, programação e manutenção.",
    checklist: [
      { text: "Cadastre cada serviço com descrição e valor padrão." },
      { text: "Use os serviços junto com os produtos na mesma proposta." },
      {
        text: "Informe o código da LC 116 e a alíquota de ISS para emitir NFS-e.",
        requiresCapability: "fiscal",
      },
    ],
    actionLabel: "Abrir Serviços",
  },
  "/solutions": {
    id: "solutions",
    route: "/solutions",
    chapter: "catalog",
    description:
      "Pacotes prontos, como um sistema de iluminação ou de áudio, com os produtos de cada ambiente já definidos.",
    checklist: [
      { text: "Monte o sistema uma vez, com os ambientes e os produtos padrão de cada um." },
      { text: "Na proposta, adicione o sistema inteiro em vez de item por item." },
      { text: "Ajuste as quantidades por projeto sem mexer no modelo." },
    ],
    actionLabel: "Abrir Soluções",
  },
  "/ambientes": {
    id: "ambientes",
    route: "/ambientes",
    chapter: "catalog",
    description:
      "Os ambientes que se repetem nos seus projetos, como sala, quarto e varanda, com os produtos que costumam ir em cada um.",
    checklist: [
      { text: "Cadastre os ambientes mais comuns do seu dia a dia." },
      { text: "Associe os produtos padrão de cada ambiente." },
      { text: "Reaproveite os ambientes ao montar uma proposta nova." },
    ],
    actionLabel: "Abrir Ambientes",
  },
  "/transactions": {
    id: "transactions",
    route: "/transactions",
    chapter: "financial",
    description:
      "Todas as receitas e despesas da empresa, pagas e a pagar, com o saldo que elas movimentam em cada carteira.",
    checklist: [
      { text: "Filtre por período, status, carteira e tipo." },
      { text: "Lance à vista, parcelado ou recorrente, e marque como pago quando acontecer." },
      { text: "Na aba Agrupados, veja as parcelas de uma mesma venda juntas." },
      { text: "Compartilhe um link do lançamento com o cliente ou o fornecedor." },
    ],
    actionLabel: "Abrir Lançamentos",
  },
  "/wallets": {
    id: "wallets",
    route: "/wallets",
    chapter: "financial",
    description:
      "Contas bancárias, caixa e carteiras digitais, cada uma com o saldo atualizado a cada pagamento.",
    checklist: [
      { text: "Crie uma carteira para cada conta ou caixa da empresa." },
      { text: "Transfira valores entre carteiras e ajuste o saldo quando precisar." },
      { text: "Abra o histórico para conferir tudo o que passou por uma carteira." },
    ],
    actionLabel: "Abrir Carteiras",
  },
  "/commissions": {
    id: "commissions",
    route: "/commissions",
    chapter: "financial",
    description:
      "Quanto cada vendedor e arquiteto tem a receber no mês. A comissão acompanha o pagamento do cliente: se ele paga em parcelas, o parceiro recebe nas mesmas datas.",
    checklist: [
      { text: "Escolha o mês para ver o total de cada parceiro." },
      { text: "Cada parcela da comissão é uma despesa pendente em Lançamentos." },
      { text: "O percentual vem do cadastro do contato e pode ser ajustado em cada proposta." },
    ],
    actionLabel: "Abrir Comissões",
    // Não há comissão no dado de demonstração: a tela abriria vazia.
    excludeFromDemo: true,
  },
  "/invoices": {
    id: "invoices",
    route: "/invoices",
    chapter: "financial",
    description:
      "As notas fiscais emitidas pela ProOps, NF-e de produto e NFS-e de serviço, com o PDF e o XML arquivados.",
    checklist: [
      { text: "Emita a nota a partir de uma proposta aprovada ou de um lançamento." },
      { text: "Baixe o PDF e o XML, faça carta de correção ou cancele pela lista." },
      {
        text: "Na visão Recebidas, confira as notas dos fornecedores e lance como despesa.",
        requiresCapability: "fiscalReceiving",
      },
    ],
    actionLabel: "Abrir Notas Fiscais",
  },
  "/spreadsheets": {
    id: "spreadsheets",
    route: "/spreadsheets",
    chapter: "tools",
    description:
      "Planilhas dentro da ProOps, para cálculos e controles que ainda não têm tela própria.",
    checklist: [
      { text: "Crie uma planilha e edite direto no navegador." },
      { text: "Use fórmulas como numa planilha comum." },
      { text: "Toda a equipe acessa a mesma versão, sem arquivo circulando por e-mail." },
    ],
    actionLabel: "Abrir Planilhas",
  },
};

export const SETTINGS_STEP_TEMPLATES: Record<string, OnboardingStepTemplate> = {
  "/settings/security": {
    id: "settings-security",
    route: "/settings/security",
    chapter: "settings",
    title: "Segurança da conta",
    description:
      "Proteja o seu acesso com a verificação em duas etapas: além da senha, a ProOps pede um código no login.",
    checklist: [
      { text: "Ative a verificação por aplicativo autenticador ou pelo WhatsApp." },
      { text: "Guarde os códigos de recuperação num lugar seguro." },
    ],
    actionLabel: "Abrir Segurança",
  },
  "/settings/team": {
    id: "settings-team",
    route: "/settings/team",
    chapter: "settings",
    title: "Equipe e permissões",
    description:
      "Convide as pessoas da empresa e decida, tela por tela, o que cada uma pode ver e alterar.",
    checklist: [
      { text: "Adicione um membro com nome, e-mail e uma senha inicial." },
      { text: "Parta de um conjunto pronto de permissões e ajuste ver, criar, editar e excluir em cada tela." },
      { text: "A mudança de permissão vale na hora, sem o membro precisar sair e entrar." },
    ],
    actionLabel: "Abrir Equipe",
    masterOnly: true,
  },
  "/settings/proposals": {
    id: "settings-proposals",
    route: "/settings/proposals",
    chapter: "settings",
    title: "Numeração das propostas",
    description:
      "Dê a cada proposta um código sequencial, como 0018926SP, que também nomeia o arquivo do PDF.",
    checklist: [
      { text: "Ligue a numeração e escolha quantos dígitos ela tem." },
      { text: "Cadastre as praças (cidades ou filiais) que entram no código." },
      { text: "Já numerava antes? Informe o próximo número para continuar a sequência." },
    ],
    actionLabel: "Abrir a numeração",
    masterOnly: true,
    excludeFromDemo: true,
  },
  "/settings/linked-accounts": {
    id: "settings-integrations",
    route: "/settings/linked-accounts",
    chapter: "settings",
    title: "Integrações",
    description:
      "Todas as contas externas ligadas à empresa num lugar só, com o estado de cada uma e o atalho para conectar.",
    checklist: [
      {
        text: "Google Agenda: os compromissos da ProOps no seu calendário.",
        requiresCapability: "calendarSync",
      },
      {
        text: "Google Drive: a proposta vai para a pasta do cliente quando sai do rascunho.",
        requiresCapability: "driveSync",
      },
      {
        text: "Pagamento Online: o cliente paga por Pix, boleto ou cartão direto pelo link.",
        requiresCapability: "onlinePayments",
      },
      {
        text: "Notas Fiscais: cadastre a empresa e o certificado A1 para emitir.",
        requiresCapability: "fiscal",
      },
    ],
    actionLabel: "Abrir Integrações",
    excludeFromDemo: true,
    requiresAnyCapability: ["calendarSync", "driveSync", "onlinePayments", "fiscal"],
  },
};

/**
 * Destinos do menu ou de Configurações que NÃO têm passo próprio, e por quê.
 * Entrar aqui é uma decisão: o guard de cobertura exige que todo destino esteja
 * num template ou nesta lista.
 */
export const ROUTES_WITHOUT_OWN_STEP: Record<string, string> = {
  "/settings/payments": "Apresentado dentro do passo Integrações.",
  "/settings/fiscal": "Apresentado dentro do passo Integrações.",
  "/settings/drive": "Apresentado dentro do passo Integrações.",
};

export interface OnboardingViewer {
  isMaster: boolean;
  isDemo: boolean;
}

export interface BuildOnboardingStepsParams {
  /** Já filtrado pelo `useNavigationItems` (nicho, permissão, masterOnly). */
  visibleMenuItems: MenuItem[];
  /** Rotas da sidebar de Configurações (`flattenSettingsNavItems`). */
  settingsRoutes: string[];
  capabilities: OnboardingCapabilityMap;
  viewer: OnboardingViewer;
}

function isTemplateAvailable(
  template: OnboardingStepTemplate,
  capabilities: OnboardingCapabilityMap,
  viewer: OnboardingViewer,
): boolean {
  if (template.masterOnly && !viewer.isMaster) return false;
  if (template.excludeFromDemo && viewer.isDemo) return false;
  if (
    template.requiresAnyCapability &&
    !template.requiresAnyCapability.some((capability) => capabilities[capability])
  ) {
    return false;
  }
  return true;
}

function toStep(
  template: OnboardingStepTemplate,
  fallbackTitle: string,
  capabilities: OnboardingCapabilityMap,
): OnboardingStep {
  return {
    id: template.id,
    route: template.route,
    chapter: template.chapter,
    title: template.title ?? fallbackTitle,
    description: template.description,
    checklist: template.checklist
      .filter(
        (item) =>
          !item.requiresCapability || capabilities[item.requiresCapability],
      )
      .map((item) => item.text),
    actionLabel: template.actionLabel,
  };
}

export function buildOnboardingSteps({
  visibleMenuItems,
  settingsRoutes,
  capabilities,
  viewer,
}: BuildOnboardingStepsParams): OnboardingStep[] {
  const steps: OnboardingStep[] = [];
  const seen = new Set<string>();

  const push = (template: OnboardingStepTemplate | undefined, label: string) => {
    if (!template || seen.has(template.id)) return;
    if (!isTemplateAvailable(template, capabilities, viewer)) return;
    seen.add(template.id);
    steps.push(toStep(template, label, capabilities));
  };

  for (const leaf of flattenMenuItems(visibleMenuItems)) {
    // O menu mantém o item coroado quando o plano não abre; o tutorial o
    // REMOVE. Um passo guiado para uma tela que responde "faça upgrade" seria
    // um beco sem saída.
    if (leaf.requiresCapability && !capabilities[leaf.requiresCapability]) {
      continue;
    }
    push(MENU_STEP_TEMPLATES[leaf.href], leaf.label);
  }

  for (const route of settingsRoutes) {
    push(SETTINGS_STEP_TEMPLATES[route], route);
  }

  // Ordena por capítulo e preserva a ordem do menu dentro de cada um (sort
  // estável): contatos e agenda sobem para Vendas, junto de Propostas.
  return steps
    .map((step, index) => ({ step, index }))
    .sort(
      (a, b) =>
        ONBOARDING_CHAPTERS[a.step.chapter].order -
          ONBOARDING_CHAPTERS[b.step.chapter].order || a.index - b.index,
    )
    .map(({ step }) => step);
}

/**
 * O passo da tela em que a pessoa está. Casa por PREFIXO, com fronteira de
 * segmento: `/proposals/new` ainda é Propostas, e `/productsx` não é Produtos.
 * Vence o prefixo mais longo, para uma rota aninhada nunca cair no pai errado.
 */
export function matchStepForPath(
  steps: OnboardingStep[],
  pathname: string | null | undefined,
): OnboardingStep | null {
  if (!pathname) return null;
  let best: OnboardingStep | null = null;
  for (const step of steps) {
    const matches =
      pathname === step.route || pathname.startsWith(`${step.route}/`);
    if (matches && (!best || step.route.length > best.route.length)) {
      best = step;
    }
  }
  return best;
}

/** Posição do passo dentro do próprio capítulo, para o "Vendas · 2 de 4". */
export function chapterProgress(
  steps: OnboardingStep[],
  step: OnboardingStep,
): { label: string; position: number; total: number } {
  const siblings = steps.filter((s) => s.chapter === step.chapter);
  return {
    label: ONBOARDING_CHAPTERS[step.chapter].label,
    position: siblings.findIndex((s) => s.id === step.id) + 1,
    total: siblings.length,
  };
}
