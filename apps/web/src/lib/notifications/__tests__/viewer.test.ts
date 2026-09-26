import { describe, expect, it } from "vitest";
import {
  isNotificationRead,
  markReadFor,
  resolveNotificationViewer,
} from "../viewer";
import { visibleNotificationTypes } from "../catalog";
import { isFreeTierAllowedPath } from "@/lib/auth/resolve-user-home";

const tenantScope = { kind: "tenant" as const, tenantId: "t1" };

describe("quem está olhando", () => {
  it("membro e dono leem por conta própria", () => {
    expect(resolveNotificationViewer({ uid: "u1", role: "member", scope: tenantScope })).toEqual({
      uid: "u1",
      mode: "recipient",
    });
    expect(resolveNotificationViewer({ uid: "u1", role: "MASTER", scope: tenantScope })?.mode).toBe(
      "recipient",
    );
  });

  it("superadmin fica na visão da empresa, no painel e no escopo do sistema", () => {
    expect(resolveNotificationViewer({ uid: "s", role: "superadmin", scope: tenantScope })?.mode).toBe(
      "company",
    );
    expect(resolveNotificationViewer({ uid: "s", role: "superadmin", scope: { kind: "system" } })?.mode).toBe(
      "company",
    );
  });

  it("conta free lê a demonstração", () => {
    expect(resolveNotificationViewer({ uid: "f", role: "free", scope: tenantScope })?.mode).toBe("demo");
  });

  it("sem usuário ou sem escopo, ninguém", () => {
    expect(resolveNotificationViewer({ uid: null, role: "member", scope: tenantScope })).toBeNull();
    expect(resolveNotificationViewer({ uid: "u1", role: "member", scope: null })).toBeNull();
  });
});

describe("lida por pessoa", () => {
  const ana = { uid: "ana", mode: "recipient" as const };

  it("a leitura de outra pessoa não conta para mim", () => {
    expect(isNotificationRead({ isRead: false, readBy: ["beto"] }, ana)).toBe(false);
    expect(isNotificationRead({ isRead: false, readBy: ["ana"] }, ana)).toBe(true);
  });

  it("o isRead da empresa não vale mais para quem lê por pessoa", () => {
    expect(isNotificationRead({ isRead: true, readBy: [] }, ana)).toBe(false);
  });

  it("a visão da empresa segue o isRead", () => {
    const empresa = { uid: "s", mode: "company" as const };
    expect(isNotificationRead({ isRead: true, readBy: [] }, empresa)).toBe(true);
    expect(isNotificationRead({ isRead: false, readBy: ["s"] }, empresa)).toBe(false);
  });

  it("marcar como lida acrescenta só quem leu", () => {
    expect(markReadFor({ isRead: false, readBy: ["beto"] }, ana)).toEqual({
      isRead: false,
      readBy: ["beto", "ana"],
    });
  });
});

describe("tipos que cada pessoa recebe (e vê nas preferências)", () => {
  it("o dono recebe todos", () => {
    expect(visibleNotificationTypes(true, () => false)).toHaveLength(15);
  });

  it("membro só de propostas não vê financeiro, CRM, projetos nem avisos da conta", () => {
    const tipos = visibleNotificationTypes(false, (pageId) => pageId === "proposals");
    expect(tipos).toContain("proposal_accepted");
    expect(tipos).not.toContain("transaction_paid_online");
    expect(tipos).not.toContain("lead_reminder");
    expect(tipos).not.toContain("project_delivery_accepted");
    expect(tipos).not.toContain("system");
  });

  it("tarefa atribuída e menção aparecem para quem abre Tarefas", () => {
    const tipos = visibleNotificationTypes(false, (pageId) => pageId === "tasks");
    expect(tipos).toEqual(["task_assigned", "task_mentioned", "task_reminder"]);
  });

  it("membro do financeiro vê os tipos do financeiro", () => {
    const tipos = visibleNotificationTypes(false, (pageId) => pageId === "transactions");
    expect(tipos).toEqual(["transaction_due_reminder", "transaction_viewed", "transaction_paid_online"]);
  });
});

it("a conta free navega a central (demonstração)", () => {
  expect(isFreeTierAllowedPath("/notifications")).toBe(true);
});
