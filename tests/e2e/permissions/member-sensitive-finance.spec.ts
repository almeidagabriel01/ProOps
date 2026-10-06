/**
 * PERM-15: o financeiro fora do módulo financeiro (revisão de permissões,
 * 2026-10).
 *
 * O caso que abriu a revisão: o dono deu à vendedora o CRM, as propostas e
 * os contatos, e ela via na aba Lançamentos do CRM o aluguel e as outras
 * contas da empresa. O Dashboard mostrava o saldo das carteiras, e qualquer
 * membro gerava o link público de cobrança de qualquer lançamento.
 *
 * As regras do Firestore cobrem a leitura pelo SDK
 * (`tests/firestore-rules/finance-member-permission.test.ts`); aqui ficam a
 * tela e a API, com membros de verdade.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import {
  AMBIENTE_PERMS,
  PERMS_MASTER,
  PERMS_MEMBER_OPERADOR,
  PERMS_MEMBER_RESTRITO,
  PERMS_MEMBER_VENDEDORA,
  TRANSACTION_PERMS,
} from "../seed/data/permissions";

async function tokenDo(user: { email: string; password: string }) {
  const { idToken } = await signInWithEmailPassword(user.email, user.password);
  return idToken;
}

test.describe("PERM-15: vendedora sem acesso ao financeiro", () => {
  test("CRM mostra Leads e Propostas, sem a aba Lançamentos", async ({ memberVendedora: page }) => {
    await page.goto("/crm");
    await expect(page.getByRole("tab", { name: "Propostas" })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("tab", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Lançamentos" })).toHaveCount(0);
    await expect(page.getByText("Aluguel Perms")).toHaveCount(0);
  });

  test("link direto para a aba Lançamentos cai em Propostas", async ({ memberVendedora: page }) => {
    await page.goto("/crm?tab=transactions");
    await expect(page.getByRole("tab", { name: "Propostas" })).toHaveAttribute("aria-selected", "true", {
      timeout: 20000,
    });
    await expect(page.getByText("Aluguel Perms")).toHaveCount(0);
  });

  test("Dashboard sem saldo, alertas e gráficos do financeiro", async ({ memberVendedora: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Resultado do mês")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Saldo Atual")).toHaveCount(0);
    await expect(page.getByText("Fluxo de Caixa")).toHaveCount(0);
  });

  test("membro com Lançamentos continua vendo a aba no CRM", async ({ memberOperador: page }) => {
    await page.goto("/crm");
    await expect(page.getByRole("tab", { name: "Lançamentos" })).toBeVisible({ timeout: 20000 });
  });
});

test.describe("PERM-16: API do financeiro e dos auxiliares", () => {
  test("vendedora não gera o link público de cobrança", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_VENDEDORA);
    const response = await request.post(`/api/backend/v1/transactions/${TRANSACTION_PERMS}/share-link`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { expireDays: 30 },
    });
    expect(response.status()).toBe(403);
  });

  test("quem edita Lançamentos gera o link", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_OPERADOR);
    const response = await request.post(`/api/backend/v1/transactions/${TRANSACTION_PERMS}/share-link`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { expireDays: 30 },
    });
    expect(response.status()).toBe(201);
  });

  test("vendedora escolhe a carteira da proposta sem ver o saldo", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_VENDEDORA);
    const response = await request.get("/api/backend/v1/wallets/options", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.wallets.map((w: { name: string }) => w.name)).toContain("Caixa Perms");
    expect(JSON.stringify(body)).not.toContain("12345");
  });

  test("relatório de comissões é do dono, não de quem vê Lançamentos", async ({ request }) => {
    const operador = await request.get("/api/backend/v1/transactions/commissions", {
      headers: { Authorization: `Bearer ${await tokenDo(PERMS_MEMBER_OPERADOR)}` },
    });
    expect(operador.status()).toBe(403);

    const dono = await request.get("/api/backend/v1/transactions/commissions", {
      headers: { Authorization: `Bearer ${await tokenDo(PERMS_MASTER)}` },
    });
    expect(dono.status()).toBe(200);
  });

  test("membro sem Soluções não exclui ambiente (antes a exclusão não conferia nada)", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);
    const response = await request.delete(`/api/backend/v1/aux/ambientes/${AMBIENTE_PERMS}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(response.status()).toBe(403);
  });
});
