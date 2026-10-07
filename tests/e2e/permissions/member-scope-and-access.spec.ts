/**
 * PERM-20: as ondas 2 a 5 da revisão de permissões com membros de verdade.
 *
 * - "Só as minhas" em propostas: a vendedora lista só as dela, e a API não
 *   abre pelo id a de outro vendedor (as rules cobrem o SDK em
 *   `tests/firestore-rules/member-scope.test.ts`).
 * - Ação fina: sem "Dar desconto", a proposta salva, mas o desconto não muda.
 * - Gestão da equipe: o dono suspende (a conta não entra), reativa (entra de
 *   novo) e lê as duas ações no histórico.
 *
 * Chamadas de API com o prefixo `v1/`: o proxy repassa o caminho verbatim.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import {
  PERMS_MASTER,
  PERMS_MEMBER_ESCOPO,
  PERMS_MEMBER_SUSPENSO,
  PROPOSAL_ESCOPO_MINHA,
  PROPOSAL_ESCOPO_OUTRA,
} from "../seed/data/permissions";

async function tokenDo(user: { email: string; password: string }) {
  const { idToken } = await signInWithEmailPassword(user.email, user.password);
  return idToken;
}

test.describe("PERM-20: só as minhas propostas", () => {
  test("a lista mostra só as propostas da vendedora", async ({ memberEscopo: page }) => {
    await page.goto("/proposals");
    await expect(page.getByText("Proposta da Escopo").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Proposta de outro vendedor")).toHaveCount(0);
  });

  test("a API não compartilha a proposta de outro vendedor; a dela, sim", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_ESCOPO);
    const outra = await request.post(`/api/backend/v1/proposals/${PROPOSAL_ESCOPO_OUTRA}/share-link`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect(outra.status()).toBe(404);
    const minha = await request.post(`/api/backend/v1/proposals/${PROPOSAL_ESCOPO_MINHA}/share-link`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    expect([200, 201]).toContain(minha.status());
  });

  test("sem 'Dar desconto', mudar o desconto é recusado; salvar sem mudar passa", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_ESCOPO);
    const comDesconto = await request.put(`/api/backend/v1/proposals/${PROPOSAL_ESCOPO_MINHA}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { discount: 15 },
    });
    expect(comDesconto.status()).toBe(403);
    const semMudar = await request.put(`/api/backend/v1/proposals/${PROPOSAL_ESCOPO_MINHA}`, {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { notes: "Revisada pela vendedora", discount: 0 },
    });
    expect(semMudar.status()).toBe(200);
  });
});

test.describe("PERM-21: suspender, reativar e o histórico", () => {
  test.describe.configure({ mode: "serial" });

  test("o dono suspende: a conta não entra; reativa: entra de novo; o histórico registra", async ({
    request,
  }) => {
    const ownerToken = await tokenDo(PERMS_MASTER);
    const headers = { Authorization: `Bearer ${ownerToken}` };

    const suspend = await request.post(`/api/backend/v1/admin/members/${PERMS_MEMBER_SUSPENSO.uid}/suspend`, {
      headers,
    });
    expect(suspend.status()).toBe(200);
    await expect(signInWithEmailPassword(PERMS_MEMBER_SUSPENSO.email, PERMS_MEMBER_SUSPENSO.password)).rejects.toThrow(
      /USER_DISABLED/,
    );

    const reactivate = await request.post(
      `/api/backend/v1/admin/members/${PERMS_MEMBER_SUSPENSO.uid}/reactivate`,
      { headers },
    );
    expect(reactivate.status()).toBe(200);
    await expect(tokenDo(PERMS_MEMBER_SUSPENSO)).resolves.toBeTruthy();

    const audit = await request.get(
      `/api/backend/v1/admin/members/audit?memberUid=${PERMS_MASTER.uid}&action=member_suspended`,
      { headers },
    );
    expect(audit.status()).toBe(200);
    const body = (await audit.json()) as { entries: Array<{ action: string; targetId: string }> };
    expect(body.entries.some((e) => e.targetId === PERMS_MEMBER_SUSPENSO.uid)).toBe(true);
  });

  test("membro não suspende ninguém nem lê o histórico", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_ESCOPO);
    const headers = { Authorization: `Bearer ${idToken}` };
    const suspend = await request.post(`/api/backend/v1/admin/members/${PERMS_MEMBER_SUSPENSO.uid}/suspend`, {
      headers,
    });
    expect(suspend.status()).toBe(403);
    const audit = await request.get("/api/backend/v1/admin/members/audit", { headers });
    expect(audit.status()).toBe(403);
  });
});
