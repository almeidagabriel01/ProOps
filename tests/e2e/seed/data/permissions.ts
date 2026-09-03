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
  /** Subcoleção users/{uid}/permissions — o que o master concedeu. */
  permissions: Record<string, Partial<Record<PermissionFlag, boolean>>>;
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

export const PERMS_USERS = [
  PERMS_MASTER,
  PERMS_MEMBER_RESTRITO,
  PERMS_MEMBER_OPERADOR,
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
      await db
        .collection("users")
        .doc(user.uid)
        .collection("permissions")
        .doc(pageId)
        .set(doc);
    }
  }

  console.log(
    `[seed] Permission tenant created: ${TENANT_PERMS} (master + 2 membros)`,
  );
}
