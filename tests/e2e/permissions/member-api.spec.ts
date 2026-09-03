/**
 * PERM-09: a camada que realmente protege — a API.
 *
 * Esconder um botão é UX; o que impede a escrita é o backend. Estes testes
 * chamam a API com o token de um MEMBRO real e verificam o 403/200 por ação,
 * sem passar pela UI.
 *
 * Antes disto o backend de kanban, planilhas, auxiliares (ambientes, sistemas,
 * campos customizados, templates de proposta), calendário e notas fiscais não
 * tinha checagem nenhuma de permissão — qualquer membro do tenant escrevia.
 */

import { test, expect } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import {
  PERMS_MEMBER_OPERADOR,
  PERMS_MEMBER_RESTRITO,
} from "../seed/data/permissions";

async function tokenDo(user: { email: string; password: string }) {
  const { idToken } = await signInWithEmailPassword(user.email, user.password);
  return idToken;
}

test.describe("PERM-09: escritas sem permissão são negadas", () => {
  test("kanban: membro não cria coluna", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    const response = await request.post("/api/backend/v1/kanban-statuses", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        label: "Coluna intrusa",
        color: "#ff0000",
        order: 99,
        category: "open",
      },
    });

    expect(response.status()).toBe(403);
  });

  test("planilhas: membro não cria planilha", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    const response = await request.post("/api/backend/v1/spreadsheets", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { name: "Planilha intrusa" },
    });

    expect(response.status()).toBe(403);
  });

  test("auxiliares: membro não cria ambiente", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    const response = await request.post("/api/backend/v1/aux/ambientes", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { name: "Ambiente intruso" },
    });

    expect(response.status()).toBe(403);
  });

  test("auxiliares: membro não cria campo customizado", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    // Campo customizado define o schema de dados do tenant — era escrita
    // aberta a qualquer membro.
    const response = await request.post("/api/backend/v1/aux/custom-fields", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: { label: "Campo intruso", type: "text" },
    });

    expect(response.status()).toBe(403);
  });

  test("calendário: membro sem permissão não cria compromisso", async ({
    request,
  }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    const response = await request.post("/api/backend/v1/calendar/events", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        title: "Compromisso intruso",
        startMs: Date.now(),
        endMs: Date.now() + 3600_000,
      },
    });

    expect(response.status()).toBe(403);
  });

  test("calendário: membro sem permissão não lista eventos", async ({
    request,
  }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    const response = await request.get(
      `/api/backend/v1/calendar/events?startMs=0&endMs=${Date.now()}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );

    expect(response.status()).toBe(403);
  });

  test("notas fiscais: membro sem invoices não lista notas", async ({
    request,
  }) => {
    const idToken = await tokenDo(PERMS_MEMBER_OPERADOR);

    const response = await request.get("/api/backend/v1/fiscal/invoices", {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    expect(response.status()).toBe(403);
  });
});

test.describe("PERM-10: o financeiro aceita quem o master autorizou", () => {
  test("summary financeiro: negado sem transactions.canView", async ({
    request,
  }) => {
    const idToken = await tokenDo(PERMS_MEMBER_RESTRITO);

    // Era a única rota financeira sem gate: devolvia o total pago e pendente
    // do tenant a qualquer membro.
    const response = await request.get("/api/backend/v1/transactions/summary", {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    expect(response.status()).toBe(403);
  });

  test("summary financeiro: permitido com transactions.canView", async ({
    request,
  }) => {
    const idToken = await tokenDo(PERMS_MEMBER_OPERADOR);

    const response = await request.get("/api/backend/v1/transactions/summary", {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    expect(response.status()).toBe(200);
  });

  test("criar lançamento: permitido com transactions.canCreate", async ({
    request,
  }) => {
    const idToken = await tokenDo(PERMS_MEMBER_OPERADOR);

    // O teste que prova a correção da chave fantasma: com esta MESMA
    // permissão, a resposta era 403 "Sem permissão financeira." porque o
    // backend consultava um doc `financial` que ninguém grava.
    const response = await request.post("/api/backend/v1/transactions", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        description: "Lançamento do operador",
        amount: 150,
        type: "income",
        status: "pending",
        dueDate: "2026-12-01",
        date: "2026-12-01",
      },
    });

    // A afirmação é sobre a PERMISSÃO, não sobre o payload: qualquer resposta
    // que não seja 403 prova que o gate deixou passar (um 400 de regra de
    // negócio já vem depois dele). Antes da correção, esta chamada era 403
    // "Sem permissão financeira." com estas mesmas permissões concedidas.
    expect(response.status()).not.toBe(403);
    expect(response.status()).toBeLessThan(500);
  });

  test("criar carteira: negado sem wallet.canCreate", async ({ request }) => {
    const idToken = await tokenDo(PERMS_MEMBER_OPERADOR);

    // O operador tem wallet.canView, não canCreate — e as duas páginas
    // financeiras têm chaves separadas: uma não libera a outra.
    //
    // O payload tem que ser VÁLIDO para o teste medir a permissão: o
    // controller valida o corpo antes de chamar o gate (convenção do projeto:
    // "validate input first, then business logic"), então um payload
    // incompleto devolveria 400 sem nunca chegar à checagem.
    const response = await request.post("/api/backend/v1/wallets", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        name: "Carteira intrusa",
        type: "bank",
        color: "#ff0000",
        initialBalance: 0,
      },
    });

    expect(response.status()).toBe(403);
  });
});
