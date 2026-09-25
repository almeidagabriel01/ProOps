import { describe, expect, it } from "vitest";

import {
  filterVisibleChildren,
  flattenMenuItems,
  menuItems,
  type MenuItem,
} from "@/components/layout/navigation-config";
import { flattenSettingsNavItems } from "@/app/settings/_components/settings-nav-items";
import { isPageEnabledForNiche } from "@/lib/niches/config";
import type { TenantNiche } from "@/types";
import {
  buildOnboardingSteps,
  chapterProgress,
  matchStepForPath,
  MENU_STEP_TEMPLATES,
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
};

/** O que o `PlanProvider` entrega por tier, sem add-ons. */
const PLAN: Record<"free" | "starter" | "pro" | "enterprise", OnboardingCapabilityMap> = {
  // A conta free destrava financeiro, CRM e editor de PDF para a demonstração,
  // e deixa fiscal e Drive de fora.
  free: { ...NONE, financial: true, crm: true, pdfEditor: true },
  starter: NONE,
  pro: {
    ...NONE,
    financial: true,
    pdfEditor: true,
    calendarSync: true,
    driveSync: true,
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
      item.children ? { ...item, children: filterVisibleChildren(item, nav) } : item,
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

  it("nenhum texto usa travessão", () => {
    const textos = [
      ...Object.values(MENU_STEP_TEMPLATES),
      ...Object.values(SETTINGS_STEP_TEMPLATES),
    ].flatMap((t) => [t.title ?? "", t.description, t.actionLabel, ...t.checklist.map((i) => i.text)]);
    expect(textos.filter((texto) => texto.includes("—"))).toEqual([]);
  });
});

describe("passos por plano e papel", () => {
  it("Enterprise, master: todas as telas, em ordem de capítulo", () => {
    expect(stepIds("enterprise", MASTER)).toEqual([
      "dashboard",
      "proposals",
      "crm",
      "contacts",
      "calendar",
      "products",
      "services",
      "solutions",
      "transactions",
      "wallets",
      "commissions",
      "invoices",
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
    expect(ids).toContain("settings-integrations");
  });

  it("Starter, master: sem Financeiro nem Integrações", () => {
    const ids = stepIds("starter", MASTER);
    for (const id of ["transactions", "wallets", "commissions", "invoices", "crm", "settings-integrations"]) {
      expect(ids).not.toContain(id);
    }
    expect(ids).toContain("settings-team");
  });

  it("conta free: módulos da demonstração, sem Comissões, Notas e telas vazias", () => {
    const ids = stepIds("free", DEMO);
    expect(ids).toContain("crm");
    expect(ids).toContain("transactions");
    expect(ids).toContain("wallets");
    expect(ids).toContain("settings-security");
    expect(ids).toContain("settings-team");
    for (const id of ["commissions", "invoices", "settings-proposals", "settings-integrations"]) {
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
  });

  it("nicho cortinas troca Soluções por Ambientes", () => {
    const ids = stepIds("pro", MASTER, "cortinas");
    expect(ids).toContain("ambientes");
    expect(ids).not.toContain("solutions");
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
      position: 3,
      total: 4,
    });
  });
});
