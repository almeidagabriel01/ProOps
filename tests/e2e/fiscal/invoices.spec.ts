/**
 * FISCAL-01 — configuração fiscal, gate de emissão e webhook do provedor.
 *
 * Testes HTTP puros contra o emulador de Functions — sem browser, no molde de
 * `billing/whatsapp-overage.spec.ts`.
 *
 * O que **não** é testado aqui: a emissão real. Ela depende de conta no Focus,
 * certificado A1 e resposta da SEFAZ, nada disso disponível no emulador. O que
 * é testado é tudo que roda do nosso lado — e é onde os bugs caros moram:
 *
 *  - o gate de readiness, que impede uma nota incompleta de sair (barrar aqui
 *    é mais barato que na SEFAZ, onde a rejeição consome número da série);
 *  - o webhook, incluindo autenticação, idempotência e não-regressão de status.
 *
 * O webhook é simulado com um POST direto, exatamente como o Focus faria.
 */

import { test, expect } from "@playwright/test";
import { getTestDb } from "../helpers/admin-firestore";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { PLAN_ENTERPRISE, PLAN_PASSWORD } from "../seed/data/plans";

const FUNCTIONS_BASE = "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

// Roda num tenant ENTERPRISE, nao mais no tenant-beta.
//
// Nota fiscal passou a ser exclusiva do Enterprise, e o tenant-beta resolve
// para `pro` (pelo planId do dono) — as rotas de /v1/fiscal passariam a
// responder 402 antes de qualquer regra fiscal ser exercitada. Rodar o modulo
// num plano que nao o contrata testaria o gate, nao o modulo.
const TENANT = PLAN_ENTERPRISE.tenantId;
const WEBHOOK_SECRET = "segredo-de-teste-fiscal";

const ENDERECO_EMITENTE = {
  logradouro: "Rua Joao da Silva",
  numero: "153",
  bairro: "Vila Isabel",
  municipio: "Curitiba",
  codigoIbge: "4106902",
  uf: "PR",
  cep: "80210000",
};

const ENDERECO_CLIENTE = {
  logradouro: "Av das Cortinas",
  numero: "1000",
  bairro: "Centro",
  municipio: "Sao Paulo",
  codigoIbge: "3550308",
  uf: "SP",
  cep: "01310100",
};

function settingsPayload(overrides: Record<string, unknown> = {}) {
  return {
    // DV correto. O fixture usava 12345678000123, cujos digitos verificadores
    // sao 23 quando deveriam ser 95: `cnpjValidator.isValid` recusava com
    // "CNPJ do emitente e invalido" ANTES de chegar na regra que cada teste
    // queria medir, e 11 dos 20 testes deste arquivo falhavam por isso.
    cnpj: "12345678000195",
    razaoSocial: "Automacao Residencial Ltda",
    inscricaoEstadual: "1234567",
    inscricaoMunicipal: "98765",
    regimeTributario: 1,
    email: "fiscal@autocasa.test",
    endereco: ENDERECO_EMITENTE,
    habilitaNfe: true,
    habilitaNfse: true,
    ...overrides,
  };
}

test.describe("FISCAL-01: configuração e emissão", () => {
  const db = getTestDb();
  let idToken: string;

  function authedFetch(path: string, init: RequestInit = {}) {
    return fetch(`${FUNCTIONS_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  test.beforeAll(async () => {
    const signIn = await signInWithEmailPassword(
      PLAN_ENTERPRISE.email,
      PLAN_PASSWORD,
    );
    idToken = signIn.idToken;
  });

  test.afterAll(async () => {
    await db.collection("fiscal_settings").doc(TENANT).delete().catch(() => undefined);

    const invoices = await db.collection("invoices").where("tenantId", "==", TENANT).get();
    await Promise.all(invoices.docs.map((doc) => doc.ref.delete()));

    const events = await db
      .collection("webhookEvents")
      .where("tenantId", "==", TENANT)
      .get();
    await Promise.all(events.docs.map((doc) => doc.ref.delete()));
  });

  test.describe("configuração fiscal", () => {
    test("salva e nunca devolve campo de segredo na resposta", async () => {
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload()),
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.configured).toBe(true);
      expect(body.cnpj).toBe("12345678000195");

      // A projeção pública é a única porta de saída do documento. Nenhum campo
      // de segredo pode atravessá-la — nem cifrado, nem o segredo do webhook.
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("kms:v1:");
      expect(body).not.toHaveProperty("certificadoSenhaEnc");
      expect(body).not.toHaveProperty("certificadoSenha");
      expect(body).not.toHaveProperty("webhookSecret");
    });

    test("recusa gravar a senha do certificado quando o KMS não está configurado", async () => {
      // Propriedade de segurança, não limitação do emulador: sem KMS a senha
      // NÃO pode cair em texto puro no Firestore. Falhar alto é o comportamento
      // correto — o emulador não tem chave KMS, então este é o caminho exercido.
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload({ certificadoSenha: "senha-super-secreta" })),
      });

      expect(response.status).toBeGreaterThanOrEqual(500);

      // E o mais importante: nada da senha pode ter sido persistido.
      const stored = (await db.collection("fiscal_settings").doc(TENANT).get()).data();
      expect(JSON.stringify(stored ?? {})).not.toContain("senha-super-secreta");
    });

    test("nunca promove para pronto ao salvar", async () => {
      // Só uma nota de teste autorizada prova o credenciamento na SEFAZ ou na
      // prefeitura — salvar formulário não prova nada.
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload()),
      });
      const body = await response.json();

      expect(body.status).not.toBe("ready");
    });

    test("recusa CNPJ inválido", async () => {
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload({ cnpj: "123" })),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("CNPJ");
    });

    test("exige inscrição municipal quando NFS-e está habilitada", async () => {
      // Sem IM a prefeitura não tem a quem cobrar o ISS e toda emissão falha.
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(
          settingsPayload({ inscricaoMunicipal: "", habilitaNfe: false, habilitaNfse: true }),
        ),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("municipal");
    });

    test("exige o código IBGE do município", async () => {
      // A SEFAZ valida o município contra a própria tabela do IBGE; o nome
      // sozinho é uma das rejeições mais comuns.
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(
          settingsPayload({ endereco: { ...ENDERECO_EMITENTE, codigoIbge: "" } }),
        ),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("IBGE");
    });

    test("recusa configuração sem nenhum tipo de nota habilitado", async () => {
      const response = await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload({ habilitaNfe: false, habilitaNfse: false })),
      });

      expect(response.status).toBe(400);
    });
  });

  test.describe("gate de emissão", () => {
    test.beforeAll(async () => {
      await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload()),
      });
    });

    test("lista todas as pendências de uma vez, não só a primeira", async () => {
      // A UI mostra uma checklist completa; parar no primeiro erro faria o
      // usuário descobrir os problemas um a um.
      const response = await authedFetch("/v1/fiscal/invoices", {
        method: "POST",
        body: JSON.stringify({
          type: "nfe",
          valorTotal: 2500,
          recipient: { id: "cli-1", nome: "", documento: "123" },
          products: [{ id: "p1", name: "Cortina", quantidade: 1, valorTotal: 2500 }],
        }),
      });

      expect(response.status).toBe(422);
      const body = await response.json();

      expect(body.code).toBe("FISCAL_INCOMPLETO");
      expect(Array.isArray(body.gaps)).toBe(true);
      expect(body.gaps.length).toBeGreaterThan(1);

      const scopes = new Set(body.gaps.map((gap: { scope: string }) => gap.scope));
      expect(scopes.has("cliente")).toBe(true);
      expect(scopes.has("produto")).toBe(true);
    });

    test("barra produto sem NCM e diz onde encontrá-lo", async () => {
      const response = await authedFetch("/v1/fiscal/invoices", {
        method: "POST",
        body: JSON.stringify({
          type: "nfe",
          valorTotal: 2500,
          recipient: {
            id: "cli-1",
            nome: "Maria Compradora",
            documento: "98765432100",
            indicadorIe: "nao_contribuinte",
            endereco: ENDERECO_CLIENTE,
          },
          products: [
            { id: "p1", name: "Cortina motorizada", quantidade: 1, valorTotal: 2500 },
          ],
        }),
      });

      expect(response.status).toBe(422);
      const gaps = (await response.json()).gaps as Array<{ field: string; message: string }>;
      const ncmGap = gaps.find((gap) => gap.field === "ncm");

      expect(ncmGap).toBeDefined();
      expect(ncmGap!.message).toContain("fornecedor");
    });

    test("barra pessoa física marcada como isenta de IE (rejeição 805)", async () => {
      const response = await authedFetch("/v1/fiscal/invoices", {
        method: "POST",
        body: JSON.stringify({
          type: "nfe",
          valorTotal: 2500,
          recipient: {
            id: "cli-1",
            nome: "Maria Compradora",
            documento: "98765432100",
            indicadorIe: "isento",
            endereco: ENDERECO_CLIENTE,
          },
          products: [{ id: "p1", name: "Cortina", ncm: "63039200", quantidade: 1, valorTotal: 2500 }],
        }),
      });

      expect(response.status).toBe(422);
      const gaps = (await response.json()).gaps as Array<{ field: string }>;
      expect(gaps.some((gap) => gap.field === "indicadorIe")).toBe(true);
    });

    test("recusa tipo de nota não habilitado na configuração", async () => {
      await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload({ habilitaNfe: false, habilitaNfse: true })),
      });

      const response = await authedFetch("/v1/fiscal/invoices", {
        method: "POST",
        body: JSON.stringify({ type: "nfe", valorTotal: 100, recipient: {}, products: [] }),
      });

      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("TIPO_NAO_HABILITADO");

      await authedFetch("/v1/fiscal/settings", {
        method: "PUT",
        body: JSON.stringify(settingsPayload()),
      });
    });
  });

  test.describe("webhook do provedor", () => {
    const REF = "proops-webhook-test";
    let invoiceId: string;

    function webhookUrl(secret = WEBHOOK_SECRET, type = "nfe") {
      return `${FUNCTIONS_BASE}/webhooks/focus/${TENANT}/${secret}/${type}`;
    }

    function postWebhook(body: Record<string, unknown>, secret = WEBHOOK_SECRET) {
      return fetch(webhookUrl(secret), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    test.beforeEach(async () => {
      await db
        .collection("fiscal_settings")
        .doc(TENANT)
        .set({ webhookSecret: WEBHOOK_SECRET }, { merge: true });

      const ref = db.collection("invoices").doc();
      invoiceId = ref.id;
      await ref.set({
        id: invoiceId,
        tenantId: TENANT,
        provider: "focus",
        ref: REF,
        type: "nfe",
        status: "processing",
        environment: "homologacao",
        valorTotal: 2500,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    test.afterEach(async () => {
      await db.collection("invoices").doc(invoiceId).delete().catch(() => undefined);
      const events = await db.collection("webhookEvents").where("ref", "==", REF).get();
      await Promise.all(events.docs.map((doc) => doc.ref.delete()));
    });

    test("autoriza a nota e grava chave, protocolo e links", async () => {
      const response = await postWebhook({
        ref: REF,
        status: "autorizado",
        status_sefaz: "100",
        chave_nfe: "NFe35260812345678000195550010000000011000000017",
        numero: "1",
        serie: "1",
        protocolo: "135260000000123",
        caminho_danfe: "/arquivos/danfe.pdf",
        caminho_xml_nota_fiscal: "/arquivos/nota.xml",
      });

      expect(response.status).toBe(200);

      const stored = (await db.collection("invoices").doc(invoiceId).get()).data()!;
      expect(stored.status).toBe("authorized");
      expect(stored.chaveAcesso).toContain("NFe3526");
      expect(stored.protocolo).toBe("135260000000123");
      expect(stored.pdfUrl).toContain("danfe.pdf");
      expect(stored.authorizedAt).toBeTruthy();
    });

    test("segredo inválido não altera nada e responde 200", async () => {
      // 200 e não 401: segredo errado é falha permanente, e 401 faria o Focus
      // retentar cinco vezes em 24h à toa.
      const response = await postWebhook({ ref: REF, status: "autorizado" }, "segredo-errado");

      expect(response.status).toBe(200);

      const stored = (await db.collection("invoices").doc(invoiceId).get()).data()!;
      expect(stored.status).toBe("processing");
    });

    test("evento duplicado produz um único efeito", async () => {
      const payload = {
        ref: REF,
        status: "autorizado",
        numero: "7",
        caminho_danfe: "/arquivos/danfe.pdf",
      };

      await postWebhook(payload);
      const first = (await db.collection("invoices").doc(invoiceId).get()).data()!;

      await postWebhook(payload);
      const second = (await db.collection("invoices").doc(invoiceId).get()).data()!;

      expect(first.status).toBe("authorized");
      expect(second.status).toBe("authorized");
      // O segundo evento não pode reescrever nada — updatedAt seria a pista.
      expect(second.updatedAt).toBe(first.updatedAt);
    });

    test("status nunca regride de autorizada para processando", async () => {
      // Webhooks não são ordenados e o cron de consulta pode correr junto: sem
      // a guarda, um evento atrasado devolveria a nota à fila de retentativa.
      await postWebhook({ ref: REF, status: "autorizado", numero: "9" });
      await postWebhook({ ref: REF, status: "processando_autorizacao" });

      const stored = (await db.collection("invoices").doc(invoiceId).get()).data()!;
      expect(stored.status).toBe("authorized");
      expect(stored.numero).toBe("9");
    });

    test("rejeição grava código e mensagem do fisco", async () => {
      await postWebhook({
        ref: REF,
        status: "erro_autorizacao",
        status_sefaz: "805",
        mensagem_sefaz: "Rejeicao: A SEFAZ do destinatario nao permite contribuinte isento",
      });

      const stored = (await db.collection("invoices").doc(invoiceId).get()).data()!;
      expect(stored.status).toBe("rejected");
      expect(stored.rejectionCode).toBe("805");
      expect(stored.rejectionMessage).toContain("isento");
      // Rejeição é permanente — não pode voltar para a fila de consulta.
      expect(stored.nextRetryAt).toBeUndefined();
    });

    test("evento sem nota correspondente é descartado sem erro", async () => {
      const response = await postWebhook({ ref: "proops-nao-existe", status: "autorizado" });
      expect(response.status).toBe(200);
    });

    test("evento sem referência é descartado", async () => {
      const response = await postWebhook({ status: "autorizado" });
      expect(response.status).toBe(200);

      const stored = (await db.collection("invoices").doc(invoiceId).get()).data()!;
      expect(stored.status).toBe("processing");
    });

    test("tipo de documento inválido na URL é descartado", async () => {
      const response = await fetch(webhookUrl(WEBHOOK_SECRET, "cte"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: REF, status: "autorizado" }),
      });

      expect(response.status).toBe(200);
      const stored = (await db.collection("invoices").doc(invoiceId).get()).data()!;
      expect(stored.status).toBe("processing");
    });
  });

  test.describe("listagem", () => {
    test("devolve apenas notas do próprio tenant", async () => {
      const ref = db.collection("invoices").doc();
      await ref.set({
        id: ref.id,
        tenantId: "tenant-alpha",
        provider: "focus",
        ref: "proops-de-outro-tenant",
        type: "nfe",
        status: "authorized",
        environment: "homologacao",
        valorTotal: 999,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      try {
        const response = await authedFetch("/v1/fiscal/invoices", { method: "GET" });
        expect(response.status).toBe(200);

        const { invoices } = await response.json();
        expect(
          invoices.every((invoice: { tenantId: string }) => invoice.tenantId === TENANT),
        ).toBe(true);
      } finally {
        await ref.delete();
      }
    });
  });
});
