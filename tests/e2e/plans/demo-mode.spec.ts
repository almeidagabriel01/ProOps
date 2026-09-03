/**
 * DEMO-01: o modo demonstração de uma conta FREE.
 *
 * Nenhum teste do projeto exercitava este caminho. O seed `USER_FREE` existia e
 * era usado só para provar redirect de rota — a navegação real do ERB em modo
 * demo, que é o funil de aquisição inteiro, nunca foi medida.
 *
 * Foi essa lacuna que deixou cinco prefixos MORTOS em `DEMO_READABLE_PREFIXES`
 * (`/v1/ambientes`, `/v1/sistemas`, `/v1/custom-fields`, `/v1/options`,
 * `/v1/proposal-templates` — nenhum existe; todos vivem sob `/v1/aux`) passarem
 * sem ser notados. Enquanto isso, toda conta demo levava 402 ao abrir Soluções,
 * Ambientes ou o formulário de proposta.
 *
 * O contrato que estes testes travam tem três metades, e as três precisam
 * concordar quando um módulo novo entra:
 *
 *  1. o que a conta free consegue LER (require-active-subscription);
 *  2. o que ela NÃO consegue escrever (a mesma camada, mais o api-client);
 *  3. o que o gate de plano faz com ela (nada — o demo destrava os módulos
 *     premium de propósito, então bloquear ali quebraria o funil).
 */

import { test, expect } from "../fixtures/base.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_FREE } from "../seed/data/users";

async function freeToken(): Promise<string> {
  const { idToken } = await signInWithEmailPassword(
    USER_FREE.email,
    USER_FREE.password,
  );
  return idToken;
}

/** Endpoints que a navegação em modo demo consome para renderizar as telas. */
const LEITURAS_DA_DEMO = [
  ["propostas", "/api/backend/v1/proposals"],
  ["produtos", "/api/backend/v1/products"],
  ["serviços", "/api/backend/v1/services"],
  ["contatos", "/api/backend/v1/clients"],
  ["planilhas", "/api/backend/v1/spreadsheets"],
  ["notificações", "/api/backend/v1/notifications"],
  // Os cinco que estavam quebrados: vivem sob /v1/aux, e a lista de leitura
  // apontava para caminhos inexistentes.
  ["ambientes (aux)", "/api/backend/v1/aux/ambientes"],
  ["sistemas (aux)", "/api/backend/v1/aux/sistemas"],
  ["campos customizados (aux)", "/api/backend/v1/aux/custom-fields"],
  ["opções (aux)", "/api/backend/v1/aux/options"],
  ["templates de proposta (aux)", "/api/backend/v1/aux/proposal-templates"],
] as const;

/** Módulos premium: o demo os destrava de propósito, para dar o gostinho. */
const LEITURAS_PREMIUM_DA_DEMO = [
  ["lançamentos", "/api/backend/v1/transactions/summary"],
  ["carteiras", "/api/backend/v1/wallets"],
  ["calendário", "/api/backend/v1/calendar/events"],
] as const;

test.describe("DEMO-01: a conta free consegue navegar", () => {
  for (const [nome, url] of LEITURAS_DA_DEMO) {
    test(`lê ${nome} sem 402`, async ({ request }) => {
      const idToken = await freeToken();

      const response = await request.get(url, {
        headers: { Authorization: "Bearer " + idToken },
      });

      expect(response.status()).not.toBe(402);
    });
  }

  for (const [nome, url] of LEITURAS_PREMIUM_DA_DEMO) {
    test(`lê ${nome} (módulo premium destravado no demo) sem 402`, async ({
      request,
    }) => {
      // O gate de plano NÃO pode barrar aqui: o PlanProvider destrava
      // hasFinancial/hasKanban para role=free, então bloquear no backend faria
      // a tela renderizar e os dados nunca chegarem.
      const idToken = await freeToken();

      const response = await request.get(url, {
        headers: { Authorization: "Bearer " + idToken },
      });

      expect(response.status()).not.toBe(402);
    });
  }
});

test.describe("DEMO-01: a conta free não escreve nada", () => {
  const ESCRITAS = [
    ["proposta", "/api/backend/v1/proposals"],
    ["produto", "/api/backend/v1/products"],
    ["contato", "/api/backend/v1/clients"],
    ["lançamento", "/api/backend/v1/transactions"],
    ["carteira", "/api/backend/v1/wallets"],
    ["ambiente (aux)", "/api/backend/v1/aux/ambientes"],
    ["coluna do CRM", "/api/backend/v1/kanban-statuses"],
  ] as const;

  for (const [nome, url] of ESCRITAS) {
    test(`não cria ${nome}`, async ({ request }) => {
      // Liberar a LEITURA de um prefixo nunca pode liberar a escrita dele: o
      // gate é por método, e é o que separa "dar o gostinho" de dar a chave.
      const idToken = await freeToken();

      const response = await request.post(url, {
        headers: { Authorization: "Bearer " + idToken },
        data: { name: "Intruso do demo" },
      });

      expect(response.status()).toBe(402);
      const body = (await response.json()) as { code?: string };
      expect(body.code).toBe("FREE_TIER_FORBIDDEN");
    });
  }
});

test.describe("DEMO-01: módulos que o demo não alcança", () => {
  // Fiscal e Asaas ficam de fora da lista de leitura de propósito: emitir nota
  // custa por documento e conectar gateway de pagamento não é passeio.
  const FORA_DO_DEMO = [
    ["configuração fiscal", "/api/backend/v1/fiscal/settings"],
    ["notas fiscais", "/api/backend/v1/fiscal/invoices"],
    ["status do Asaas", "/api/backend/v1/asaas/status"],
  ] as const;

  for (const [nome, url] of FORA_DO_DEMO) {
    test(`não lê ${nome}`, async ({ request }) => {
      const idToken = await freeToken();

      const response = await request.get(url, {
        headers: { Authorization: "Bearer " + idToken },
      });

      expect(response.status()).toBe(402);
      const body = (await response.json()) as { code?: string };
      // FREE_TIER_FORBIDDEN, não PLAN_CAPABILITY_REQUIRED: a conta free é
      // barrada pela camada de billing, antes do gate de plano.
      expect(body.code).toBe("FREE_TIER_FORBIDDEN");
    });
  }
});
