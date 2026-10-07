import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Tenant dedicado aos testes de permissão de MEMBRO.
 *
 * Existe separado do `tenant-alpha` por dois motivos: precisa de plano
 * **enterprise** (o alpha é `pro`, que não tem CRM, e mexer no plano dele
 * mudaria o comportamento de dezenas de testes existentes), e cada membro aqui
 * tem uma subcoleção `permissions` desenhada para um caso específico — algo que
 * nenhum outro seed tem.
 *
 * Antes disto, nenhum teste do projeto exercitava a UI como membro: os seeds
 * `USER_MEMBER_ALPHA`/`BETA` existiam mas as fixtures não expunham sessão de
 * membro, e o único uso era uma asserção de claims. Era por isso que a chave
 * fantasma `financial` — que fechava o módulo financeiro inteiro para todo
 * membro — passou tanto tempo sem ser notada.
 */

export const TENANT_PERMS = "tenant-perms";
const PASSWORD = "Test1234!";

export interface SeedPermissionUser {
  uid: string;
  email: string;
  password: string;
  name: string;
  role: "MASTER" | "MEMBER";
  /**
   * Subcoleção users/{uid}/permissions: o que o master concedeu. Além das
   * quatro ações, aceita as chaves finas do catálogo (`discount`, `viewCost`) e
   * o alcance (`scope`).
   */
  permissions: Record<string, Partial<Record<PermissionFlag, boolean>> & Record<string, boolean | string | undefined>>;
}

type PermissionFlag = "canView" | "canCreate" | "canEdit" | "canDelete";

export const PERMS_MASTER: SeedPermissionUser = {
  uid: "user-perms-master",
  email: "master@perms.test",
  password: PASSWORD,
  name: "Master Perms",
  role: "MASTER",
  permissions: {},
};

/**
 * O caso mais restrito que ainda entra no ERP: só VER propostas.
 *
 * Serve para provar que cada um dos outros módulos está fechado nas quatro
 * camadas — inclusive os que ficaram sem guarda de rota por anos
 * (`/contacts`, `/services`, `/spreadsheets`, `/solutions`, `/crm`,
 * `/wallets`).
 */
export const PERMS_MEMBER_RESTRITO: SeedPermissionUser = {
  uid: "user-perms-restrito",
  email: "restrito@perms.test",
  password: PASSWORD,
  name: "Membro Restrito",
  role: "MEMBER",
  permissions: {
    proposals: { canView: true },
  },
};

/**
 * Membro operacional do financeiro: mexe em lançamentos, mas não cria carteira
 * nem emite nota.
 *
 * É o caso que a chave fantasma `financial` quebrava por completo — com estas
 * mesmas permissões, o botão "Novo Lançamento" nunca aparecia e a API negava
 * toda escrita com "Sem permissão financeira.".
 */
export const PERMS_MEMBER_OPERADOR: SeedPermissionUser = {
  uid: "user-perms-operador",
  email: "operador@perms.test",
  password: PASSWORD,
  name: "Membro Operador",
  role: "MEMBER",
  permissions: {
    dashboard: { canView: true },
    proposals: { canView: true, canCreate: true, canEdit: true },
    transactions: { canView: true, canCreate: true, canEdit: true },
    wallet: { canView: true },
    kanban: { canView: true },
  },
};

/**
 * Comeca no preset "editor" para PROPOSTAS: ver + criar + editar, sem excluir.
 *
 * Exclusivo do spec de acesso personalizado, que altera as permissoes DESTE
 * membro em tempo de teste — por isso nao pode ser compartilhado com os outros
 * specs. O caso que ele cobre e o do dia a dia: o preset entrega escrita e o
 * master depois restringe para "so olhar".
 */
export const PERMS_MEMBER_CUSTOM: SeedPermissionUser = {
  uid: "user-perms-custom",
  email: "custom@perms.test",
  password: PASSWORD,
  name: "Membro Personalizado",
  role: "MEMBER",
  permissions: {
    proposals: { canView: true, canCreate: true, canEdit: true },
  },
};

/**
 * A vendedora do relato que abriu a revisão de permissões (2026-10): usa o
 * CRM, as propostas, os contatos e vê os produtos, mas o dono não quer que
 * ela veja os lançamentos (o aluguel aparecia na aba Lançamentos do CRM) nem
 * o saldo da empresa no Dashboard.
 */
export const PERMS_MEMBER_VENDEDORA: SeedPermissionUser = {
  uid: "user-perms-vendedora",
  email: "vendedora@perms.test",
  password: PASSWORD,
  name: "Membro Vendedora",
  role: "MEMBER",
  permissions: {
    dashboard: { canView: true },
    kanban: { canView: true, canCreate: true, canEdit: true },
    proposals: { canView: true, canCreate: true, canEdit: true },
    clients: { canView: true, canCreate: true, canEdit: true },
    products: { canView: true },
  },
};

/**
 * Vendedora com "só as minhas" em propostas e contatos, sem dar desconto e
 * sem ver custo nem estoque (revisão de permissões, ondas 2 a 4).
 */
export const PERMS_MEMBER_ESCOPO: SeedPermissionUser = {
  uid: "user-perms-escopo",
  email: "escopo@perms.test",
  password: PASSWORD,
  name: "Membro Escopo",
  role: "MEMBER",
  permissions: {
    dashboard: { canView: true },
    kanban: { canView: true },
    proposals: { canView: true, canCreate: true, canEdit: true, scope: "own", discount: false },
    clients: { canView: true, canCreate: true, canEdit: true, scope: "own" },
    products: { canView: true, viewCost: false, viewStock: false },
  },
};

/** Membro que o dono suspende e reativa (onda 5). Exclusivo do spec de acesso. */
export const PERMS_MEMBER_SUSPENSO: SeedPermissionUser = {
  uid: "user-perms-suspenso",
  email: "suspenso@perms.test",
  password: PASSWORD,
  name: "Membro Suspenso",
  role: "MEMBER",
  permissions: {
    proposals: { canView: true },
  },
};

/** Propostas do alcance "só as minhas": uma da vendedora e uma de outra pessoa. */
export const PROPOSAL_ESCOPO_MINHA = "proposal-escopo-minha";
export const PROPOSAL_ESCOPO_OUTRA = "proposal-escopo-outra";

/** Lançamento, carteira e ambiente do tenant de permissões (Onda 0). */
export const TRANSACTION_PERMS = "transaction-perms-aluguel";
export const WALLET_PERMS = "wallet-perms-caixa";
export const AMBIENTE_PERMS = "ambiente-perms-sala";

/** Proposta do tenant de permissoes — alvo do PUT que mede canEdit. */
export const PROPOSAL_PERMS = "proposal-perms-001";

export const PERMS_USERS = [
  PERMS_MASTER,
  PERMS_MEMBER_RESTRITO,
  PERMS_MEMBER_OPERADOR,
  PERMS_MEMBER_CUSTOM,
  PERMS_MEMBER_VENDEDORA,
  PERMS_MEMBER_ESCOPO,
  PERMS_MEMBER_SUSPENSO,
];

const ALL_FLAGS: PermissionFlag[] = [
  "canView",
  "canCreate",
  "canEdit",
  "canDelete",
];

export async function seedPermissionTenant(
  auth: Auth,
  db: Firestore,
): Promise<void> {
  // `plan: "enterprise"` é o campo que o backend lê (tenant-plan-policy);
  // `subscriptionStatus: "active"` libera o gate de billing das Rules e do
  // middleware. Sem os dois, todo teste aqui bateria em /subscription-blocked
  // antes de chegar à permissão que se quer medir.
  await db.collection("tenants").doc(TENANT_PERMS).set({
    id: TENANT_PERMS,
    tenantId: TENANT_PERMS,
    name: "Perms Corp",
    niche: "automacao_residencial",
    primaryColor: "#7C3AED",
    plan: "enterprise",
    planId: "enterprise",
    subscriptionStatus: "active",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  });

  for (const user of PERMS_USERS) {
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        displayName: user.name,
        emailVerified: true,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code !== "auth/uid-already-exists" &&
        code !== "auth/email-already-exists"
      ) {
        throw err;
      }
    }

    // Um run anterior pode ter suspendido o membro (spec de acesso): o seed
    // devolve a conta ao estado de partida.
    await auth.updateUser(user.uid, { disabled: false });

    const masterId =
      user.role === "MASTER" ? user.uid : PERMS_MASTER.uid;

    await auth.setCustomUserClaims(user.uid, {
      tenantId: TENANT_PERMS,
      role: user.role,
      masterId,
      subscriptionStatus: "active",
    });

    await db.collection("users").doc(user.uid).set({
      id: user.uid,
      tenantId: TENANT_PERMS,
      companyId: TENANT_PERMS,
      name: user.name,
      email: user.email,
      role: user.role,
      masterId,
      status: "active",
      planId: "enterprise",
      subscriptionStatus: "active",
      createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
    });

    // Grava a subcoleção com as quatro flags explícitas, como o
    // admin.controller faz — um flag ausente não é o mesmo que false para
    // quem lê o doc cru.
    for (const [pageId, flags] of Object.entries(user.permissions)) {
      const doc: Record<string, unknown> = {
        pageId,
        pageSlug: `/${pageId}`,
      };
      for (const flag of ALL_FLAGS) doc[flag] = flags[flag] === true;
      // Chaves finas e alcance vão como foram declaradas.
      for (const [key, value] of Object.entries(flags)) {
        if (!(ALL_FLAGS as string[]).includes(key) && value !== undefined) doc[key] = value;
      }
      await db
        .collection("users")
        .doc(user.uid)
        .collection("permissions")
        .doc(pageId)
        .set(doc);
    }
  }

  // Alvo do PUT /v1/proposals/:id — sem um documento existente o handler
  // responde 404 antes de chegar ao gate de permissao, e o teste nao mediria
  // nada.
  await db.collection("proposals").doc(PROPOSAL_PERMS).set({
    id: PROPOSAL_PERMS,
    tenantId: TENANT_PERMS,
    title: "Proposta do tenant de permissoes",
    status: "draft",
    clientId: "",
    clientName: "Cliente Perms",
    products: [],
    sistemas: [],
    sections: [],
    totalValue: 1000,
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  });

  for (const [id, sellerId, title] of [
    [PROPOSAL_ESCOPO_MINHA, PERMS_MEMBER_ESCOPO.uid, "Proposta da Escopo"],
    [PROPOSAL_ESCOPO_OUTRA, PERMS_MASTER.uid, "Proposta de outro vendedor"],
  ] as const) {
    await db.collection("proposals").doc(id).set({
      id,
      tenantId: TENANT_PERMS,
      title,
      status: "draft",
      clientId: "",
      clientName: "Cliente Escopo",
      sellerId,
      sellerName: sellerId === PERMS_MASTER.uid ? PERMS_MASTER.name : PERMS_MEMBER_ESCOPO.name,
      products: [],
      sistemas: [],
      sections: [],
      discount: 0,
      totalValue: 2000,
      createdAt: new Date("2024-02-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2024-02-01T00:00:00Z").toISOString(),
    });
  }

  await db.collection("wallets").doc(WALLET_PERMS).set({
    tenantId: TENANT_PERMS,
    name: "Caixa Perms",
    type: "cash",
    color: "#16a34a",
    balance: 12345,
    isDefault: true,
    status: "active",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  });

  await db.collection("transactions").doc(TRANSACTION_PERMS).set({
    tenantId: TENANT_PERMS,
    type: "expense",
    description: "Aluguel Perms",
    amount: 9447,
    date: "2026-10-01",
    dueDate: "2026-10-01",
    status: "pending",
    wallet: WALLET_PERMS,
    category: "Aluguel",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  });

  await db.collection("ambientes").doc(AMBIENTE_PERMS).set({
    tenantId: TENANT_PERMS,
    name: "Sala Perms",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  });

  console.log(
    `[seed] Permission tenant created: ${TENANT_PERMS} (master + ${PERMS_USERS.length - 1} membros)`,
  );
}
