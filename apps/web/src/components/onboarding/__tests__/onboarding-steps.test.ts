import { describe, expect, it } from "vitest";

import {
  filterVisibleChildren,
  flattenMenuItems,
  menuItems,
  nicheMenuLabel,
  type MenuItem,
} from "@/components/layout/navigation-config";
import { flattenSettingsNavItems } from "@/app/settings/_components/settings-nav-items";
import {
  getNicheConfig,
  isPageEnabledForNiche,
  NICHE_CONFIGS,
} from "@/lib/niches/config";
import { TENANT_NICHES } from "@/lib/niches/niche-ids";
import type { TenantNiche } from "@/types";
import {
  buildOnboardingSteps,
  chapterProgress,
  matchStepForPath,
  MENU_STEP_TEMPLATES,
  resolveOnboardingText,
  ROUTES_WITHOUT_OWN_STEP,
  SETTINGS_STEP_TEMPLATES,
  type OnboardingCapabilityMap,
  type OnboardingViewer,
} from "../onboarding-steps";

const NONE: OnboardingCapabilityMap = {
  financial: false,
  crm: false,
  fiscal: false,
  pdfEditor: false,
  calendarSync: false,
  driveSync: false,
  onlinePayments: false,
  fiscalReceiving: false,
  projects: false,
  salesGoals: false,
  bookingLink: false,
  clientPortal: false,
  fieldService: false,
};

/** O que o `PlanProvider` entrega por tier, sem add-ons. */
const PLAN: Record<"free" | "starter" | "pro" | "enterprise", OnboardingCapabilityMap> = {
  // A conta free destrava financeiro, CRM, projetos e editor de PDF para a
  // demonstração, e deixa fiscal e Drive de fora.
  free: { ...NONE, financial: true, crm: true, pdfEditor: true, projects: true, salesGoals: true, bookingLink: true, clientPortal: true, fieldService: true },
  starter: NONE,
  pro: {
    ...NONE,
    financial: true,
    pdfEditor: true,
    calendarSync: true,
    driveSync: true,
    projects: true,
    salesGoals: true,
    bookingLink: true,
    clientPortal: true,
    fieldService: true,
  },
  enterprise: {
    financial: true,
    crm: true,
    fiscal: true,
    pdfEditor: true,
    calendarSync: true,
    driveSync: true,
    onlinePayments: true,
    fiscalReceiving: true,
    projects: true,
    salesGoals: true,
    bookingLink: true,
    clientPortal: true,
    fieldService: true,
  },
};

const MASTER: OnboardingViewer = { isMaster: true, isDemo: false };
const MEMBER: OnboardingViewer = { isMaster: false, isDemo: false };
const DEMO: OnboardingViewer = { isMaster: true, isDemo: true };

const SETTINGS_ROUTES = flattenSettingsNavItems().map((item) => item.href);

/** Espelha o `useNavigationItems`: nicho, permissão e masterOnly. */
function visibleMenu(
  viewer: OnboardingViewer,
  niche: TenantNiche = "automacao_residencial",
  allowedPages: string[] | "all" = "all",
): MenuItem[] {
  const hasPermission = (pageId: string) =>
    allowedPages === "all" || allowedPages.includes(pageId);
  const nav = {
    isMaster: viewer.isMaster,
    isDemo: viewer.isDemo,
    hasPermission,
    isPageEnabled: (pageId?: string | null) => isPageEnabledForNiche(niche, pageId),
  };
  return menuItems
    .filter((item) => {
      if (!isPageEnabledForNiche(niche, item.availabilityPageId ?? item.pageId)) {
        return false;
      }
      if (viewer.isMaster || viewer.isDemo) return true;
      if (item.children) return filterVisibleChildren(item, nav).length > 0;
      if (item.pageId) return hasPermission(item.pageId);
      return true;
    })
    .map((item) =>
      item.children
        ? {
            ...item,
            children: filterVisibleChildren(item, nav).map((child) => ({
              ...child,
              label: nicheMenuLabel(child.href, getNicheConfig(niche)) ?? child.label,
            })),
          }
        : item,
    );
}

function stepIds(
  plan: keyof typeof PLAN,
  viewer: OnboardingViewer,
  niche?: TenantNiche,
  allowedPages?: string[] | "all",
): string[] {
  return buildOnboardingSteps({
    visibleMenuItems: visibleMenu(viewer, niche, allowedPages),
    settingsRoutes: SETTINGS_ROUTES,
    capabilities: PLAN[plan],
    viewer,
  }).map((step) => step.id);
}

describe("cobertura do tutorial", () => {
  it("todo destino do menu tem passo ou justificativa", () => {
    const semPasso = flattenMenuItems(menuItems)
      .map((leaf) => leaf.href)
      .filter(
        (href) => !(href in MENU_STEP_TEMPLATES) && !(href in ROUTES_WITHOUT_OWN_STEP),
      );
    expect(semPasso).toEqual([]);
  });

  it("toda seção de Configurações tem passo ou justificativa", () => {
    const semPasso = SETTINGS_ROUTES.filter(
      (href) => !(href in SETTINGS_STEP_TEMPLATES) && !(href in ROUTES_WITHOUT_OWN_STEP),
    );
    expect(semPasso).toEqual([]);
  });

  it("não sobra template para rota que saiu do menu", () => {
    const destinos = new Set([
      ...flattenMenuItems(menuItems).map((leaf) => leaf.href),
      ...SETTINGS_ROUTES,
    ]);
    const orfaos = [
      ...Object.keys(MENU_STEP_TEMPLATES),
      ...Object.keys(SETTINGS_STEP_TEMPLATES),
    ].filter((route) => !destinos.has(route));
    expect(orfaos).toEqual([]);
  });

  it("os ids são únicos", () => {
    const ids = [
      ...Object.values(MENU_STEP_TEMPLATES),
      ...Object.values(SETTINGS_STEP_TEMPLATES),
    ].map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("nenhum texto usa travessão, em nenhum nicho", () => {
    const textos = TENANT_NICHES.flatMap((niche) => {
      const { vocabulary } = NICHE_CONFIGS[niche];
      return [
        ...Object.values(MENU_STEP_TEMPLATES),
        ...Object.values(SETTINGS_STEP_TEMPLATES),
      ].flatMap((t) => [
        t.title ?? "",
        t.description,
        resolveOnboardingText(t.actionLabel, vocabulary),
        ...t.checklist.map((i) => resolveOnboardingText(i.text, vocabulary)),
      ]);
    });
    expect(textos.filter((texto) => texto.includes("—"))).toEqual([]);
  });
});

describe("passos por plano e papel", () => {
  it("Enterprise, master: todas as telas, em ordem de capítulo", () => {
    expect(stepIds("enterprise", MASTER)).toEqual([
      "dashboard",
      // Tarefas fica no capítulo Visão geral, logo depois do Dashboard.
      "tasks",
      "proposals",
      // Projetos segue Propostas no menu (mesmo grupo), antes do CRM.
      "projects",
      "crm",
      "contacts",
      "calendar",
      // O Link de agendamento é visão da Agenda, junto do Calendário. O id
      // ainda é o de quando morava em Configurações.
      "settings-booking",
      // Assistência técnica: grupo próprio da dock, depois da Agenda.
      "service-orders",
      "equipment",
      "contracts",
      "products",
      "services",
      "solutions",
      "transactions",
      "wallets",
      "commissions",
      "dre",
      "cash-flow",
      "invoices",
      // Metas de vendas fecham o grupo Financeiro.
      "settings-goals",
      "spreadsheets",
      "settings-security",
      "settings-team",
      "settings-proposals",
      "settings-integrations",
    ]);
  });

  it("Pro, master: sem CRM e sem Notas Fiscais", () => {
    const ids = stepIds("pro", MASTER);
    expect(ids).not.toContain("crm");
    expect(ids).not.toContain("invoices");
    expect(ids).toContain("commissions");
    expect(ids).toContain("dre");
    expect(ids).toContain("cash-flow");
    expect(ids).toContain("settings-integrations");
    // Projetos de instalação entram no Pro.
    expect(ids).toContain("projects");
    // Metas de vendas e o link de agendamento também.
    expect(ids).toContain("settings-goals");
    expect(ids).toContain("settings-booking");
    // Ordens de serviço e equipamentos também.
    expect(ids).toContain("service-orders");
    expect(ids).toContain("equipment");
    expect(ids).toContain("contracts");
  });

  it("Starter, master: sem Financeiro nem Integrações", () => {
    const ids = stepIds("starter", MASTER);
    for (const id of ["transactions", "wallets", "commissions", "dre", "cash-flow", "invoices", "crm", "projects", "settings-goals", "settings-booking", "settings-integrations", "service-orders", "equipment", "contracts"]) {
      expect(ids).not.toContain(id);
    }
    expect(ids).toContain("settings-team");
  });

  it("Starter com o add-on de ordens de serviço ganha os dois passos", () => {
    const ids = buildOnboardingSteps({
      visibleMenuItems: visibleMenu(MASTER),
      settingsRoutes: SETTINGS_ROUTES,
      capabilities: { ...PLAN.starter, fieldService: true },
      viewer: MASTER,
    }).map((step) => step.id);
    expect(ids).toContain("service-orders");
    expect(ids).toContain("equipment");
    expect(ids).toContain("contracts");
  });

  it("conta free: módulos da demonstração, sem Comissões, Notas e telas vazias", () => {
    const ids = stepIds("free", DEMO);
    expect(ids).toContain("crm");
    expect(ids).toContain("projects");
    // Cada demonstração tem OS e equipamentos de exemplo.
    expect(ids).toContain("service-orders");
    expect(ids).toContain("equipment");
    expect(ids).toContain("contracts");
    expect(ids).toContain("transactions");
    expect(ids).toContain("wallets");
    // O DRE da demonstração lê o exemplo do tenant demo.
    expect(ids).toContain("dre");
    expect(ids).toContain("cash-flow");
    expect(ids).toContain("settings-security");
    expect(ids).toContain("settings-team");
    expect(ids).toContain("calendar");
    for (const id of ["commissions", "invoices", "settings-proposals", "settings-goals", "settings-booking", "settings-integrations"]) {
      expect(ids).not.toContain(id);
    }
  });

  it("membro vê só as telas que tem permissão, e nada de administração", () => {
    const ids = stepIds("enterprise", MEMBER, "automacao_residencial", [
      "dashboard",
      "proposals",
      "clients",
    ]);
    expect(ids).toEqual([
      "dashboard",
      "proposals",
      "contacts",
      "settings-security",
      "settings-integrations",
    ]);
  });

  it("membro com transações não ganha Comissões (masterOnly)", () => {
    const ids = stepIds("enterprise", MEMBER, "automacao_residencial", ["transactions"]);
    expect(ids).toContain("transactions");
    expect(ids).not.toContain("commissions");
    // Metas também são do dono: o membro acompanha a dele no Dashboard.
    expect(ids).not.toContain("settings-goals");
  });

  it("membro com Calendário e Tarefas não ganha o Link de agendamento (masterOnly)", () => {
    const ids = stepIds("enterprise", MEMBER, "automacao_residencial", ["calendar", "tasks"]);
    expect(ids).toContain("calendar");
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("settings-booking");
  });

  it("o nicho troca a descrição de um passo sem mexer nos outros", () => {
    const build = (stepDescriptions?: Partial<Record<string, string>>) =>
      buildOnboardingSteps({
        visibleMenuItems: visibleMenu(MASTER),
        settingsRoutes: SETTINGS_ROUTES,
        capabilities: PLAN.pro,
        viewer: MASTER,
        stepDescriptions,
      });
    const base = build();
    const custom = build({ solutions: "Kits prontos de câmeras e alarme." });
    expect(custom.find((step) => step.id === "solutions")?.description).toBe(
      "Kits prontos de câmeras e alarme.",
    );
    expect(custom.find((step) => step.id === "products")?.description).toBe(
      base.find((step) => step.id === "products")?.description,
    );
  });

  it("segurança eletrônica chama Soluções de Sistemas, com o texto do nicho", () => {
    const steps = buildOnboardingSteps({
      visibleMenuItems: visibleMenu(MASTER, "seguranca_eletronica"),
      settingsRoutes: SETTINGS_ROUTES,
      capabilities: PLAN.pro,
      viewer: MASTER,
      stepDescriptions: getNicheConfig("seguranca_eletronica").onboardingStepDescriptions,
    });
    const solutions = steps.find((step) => step.id === "solutions");
    expect(solutions?.title).toBe("Sistemas");
    expect(solutions?.description).toMatch(/câmeras/);
    expect(steps.map((step) => step.id)).not.toContain("ambientes");
  });

  it("nicho cortinas troca Soluções por Ambientes", () => {
    const ids = stepIds("pro", MASTER, "cortinas");
    expect(ids).toContain("ambientes");
    expect(ids).not.toContain("solutions");
  });
});

describe("vocabulário do nicho no passo", () => {
  const stepIn = (niche: TenantNiche, id: string, withVocabulary = true) =>
    buildOnboardingSteps({
      visibleMenuItems: visibleMenu(MASTER, niche),
      settingsRoutes: SETTINGS_ROUTES,
      capabilities: PLAN.pro,
      viewer: MASTER,
      stepDescriptions: getNicheConfig(niche).onboardingStepDescriptions,
      vocabulary: withVocabulary ? getNicheConfig(niche).vocabulary : undefined,
    }).find((step) => step.id === id);

  it.each(["service-orders", "contracts"])(
    "o passo %s fala do uso de cada nicho, e nenhum nicho fica com o texto genérico",
    (id) => {
      const texts = TENANT_NICHES.map((niche) => stepIn(niche, id)?.description);
      expect(texts.every(Boolean)).toBe(true);
      expect(new Set(texts).size).toBe(TENANT_NICHES.length);
      expect(texts).not.toContain(MENU_STEP_TEMPLATES[`/${id}`].description);
    },
  );

  it("em climatização, o passo dos contratos fala do PMOC", () => {
    expect(stepIn("climatizacao", "contracts")?.description).toContain("PMOC");
    expect(stepIn("seguranca_eletronica", "contracts")?.description).not.toContain("PMOC");
  });

  it("automação continua falando de soluções e ambientes", () => {
    const solutions = stepIn("automacao_residencial", "solutions");
    expect(solutions?.title).toBe("Soluções");
    expect(solutions?.actionLabel).toBe("Abrir Soluções");
    expect(solutions?.checklist).toEqual([
      "Monte a solução uma vez. Os produtos padrão ficam separados por ambiente.",
      "Na proposta, adicione a solução inteira em vez de item por item.",
      "Ajuste as quantidades por projeto sem mexer no modelo.",
    ]);
  });

  it("sem vocabulário, vale o de automação", () => {
    expect(stepIn("automacao_residencial", "solutions", false)).toEqual(
      stepIn("automacao_residencial", "solutions"),
    );
  });

  it("segurança eletrônica: botão e checklist falam de sistemas e áreas", () => {
    const solutions = stepIn("seguranca_eletronica", "solutions");
    expect(solutions?.title).toBe("Sistemas");
    expect(solutions?.actionLabel).toBe("Abrir Sistemas");
    expect(solutions?.checklist).toEqual([
      "Monte o sistema uma vez. Os produtos padrão ficam separados por área.",
      "Na proposta, adicione o sistema inteiro em vez de item por item.",
      "Ajuste as quantidades por projeto sem mexer no modelo.",
    ]);
    const texto = [solutions?.actionLabel, ...(solutions?.checklist ?? [])].join(" ");
    expect(texto).not.toMatch(/soluç|ambiente/i);
  });

  it("cortinas: o passo de Ambientes fala de ambientes", () => {
    const ambientes = stepIn("cortinas", "ambientes");
    expect(ambientes?.title).toBe("Ambientes");
    expect(ambientes?.actionLabel).toBe("Abrir Ambientes");
    expect(ambientes?.checklist).toEqual([
      "Cadastre os ambientes mais comuns do seu dia a dia.",
      "Associe os produtos padrão de cada ambiente.",
      "Reaproveite os ambientes ao montar uma proposta nova.",
    ]);
  });

  it("o passo de Ambientes concorda com um local feminino", () => {
    const ambientes = buildOnboardingSteps({
      visibleMenuItems: visibleMenu(MASTER, "cortinas"),
      settingsRoutes: SETTINGS_ROUTES,
      capabilities: PLAN.pro,
      viewer: MASTER,
      vocabulary: getNicheConfig("seguranca_eletronica").vocabulary,
    }).find((step) => step.id === "ambientes");
    expect(ambientes?.actionLabel).toBe("Abrir Áreas");
    expect(ambientes?.checklist).toEqual([
      "Cadastre as áreas mais comuns do seu dia a dia.",
      "Associe os produtos padrão de cada área.",
      "Reaproveite as áreas ao montar uma proposta nova.",
    ]);
  });
});

describe("checklist condicional", () => {
  const checklistOf = (plan: keyof typeof PLAN, id: string) =>
    buildOnboardingSteps({
      visibleMenuItems: visibleMenu(MASTER),
      settingsRoutes: SETTINGS_ROUTES,
      capabilities: PLAN[plan],
      viewer: MASTER,
    }).find((step) => step.id === id)?.checklist ?? [];

  it("Google Agenda só aparece com a integração no plano", () => {
    expect(checklistOf("pro", "calendar").join(" ")).toContain("Google Agenda");
    expect(checklistOf("starter", "calendar").join(" ")).not.toContain("Google Agenda");
  });

  it("nota fiscal na proposta só com o módulo fiscal", () => {
    expect(checklistOf("enterprise", "proposals").join(" ")).toContain("nota fiscal");
    expect(checklistOf("pro", "proposals").join(" ")).not.toContain("nota fiscal");
  });

  it("portal do cliente em Contatos só com o plano, igual nos dois nichos", () => {
    expect(checklistOf("pro", "contacts").join(" ")).toContain("portal");
    expect(checklistOf("enterprise", "contacts").join(" ")).toContain("portal");
    expect(checklistOf("starter", "contacts").join(" ")).not.toContain("portal");
    const inNiche = (niche: TenantNiche) =>
      buildOnboardingSteps({
        visibleMenuItems: visibleMenu(MASTER, niche),
        settingsRoutes: SETTINGS_ROUTES,
        capabilities: PLAN.pro,
        viewer: MASTER,
      })
        .find((step) => step.id === "contacts")
        ?.checklist.join(" ");
    for (const niche of TENANT_NICHES) {
      expect(inNiche(niche)).toBe(inNiche("automacao_residencial"));
    }
  });

  it("Integrações lista só o que o plano abre", () => {
    const pro = checklistOf("pro", "settings-integrations").join(" ");
    expect(pro).toContain("Google Drive");
    expect(pro).not.toContain("Pagamento Online");
    expect(pro).not.toContain("Notas Fiscais");
  });
});

describe("matchStepForPath", () => {
  const steps = buildOnboardingSteps({
    visibleMenuItems: visibleMenu(MASTER),
    settingsRoutes: SETTINGS_ROUTES,
    capabilities: PLAN.enterprise,
    viewer: MASTER,
  });

  it.each([
    ["/proposals", "proposals"],
    ["/proposals/new", "proposals"],
    ["/proposals/abc/edit-pdf", "proposals"],
    ["/transactions/abc/view", "transactions"],
    ["/settings/team", "settings-team"],
  ])("%s casa com %s", (path, id) => {
    expect(matchStepForPath(steps, path)?.id).toBe(id);
  });

  it.each(["/productsx", "/profile", "/settings/fiscal", "/", null])(
    "%s não casa com passo nenhum",
    (path) => {
      expect(matchStepForPath(steps, path)).toBeNull();
    },
  );

  it("mostra a posição dentro do capítulo", () => {
    const contacts = steps.find((step) => step.id === "contacts")!;
    expect(chapterProgress(steps, contacts)).toEqual({
      label: "Vendas",
      position: 4,
      total: 9,
    });
  });
});
