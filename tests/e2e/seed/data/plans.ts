import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Um tenant MASTER por tier, para medir o gate de MODULO por plano.
 *
 * Tenants proprios de proposito. O `tenant-alpha` e `pro` e sustenta dezenas de
 * testes; o `tenant-perms` e `enterprise` e existe para permissao de membro.
 * Mexer no plano de qualquer um dos dois para testar plano mudaria o
 * comportamento de tudo que ja depende deles.
 *
 * O quarto tenant é o caso que mais importa e o que ninguém cobria: um Starter
 * que **comprou** o add-on financeiro. Enquanto a regra de add-on viveu só no
 * frontend, ele via a tela abrir e levava recusa da API e da Lia.
 */

const PASSWORD = "Test1234!";

export interface SeedPlanTenant {
  tenantId: string;
  tier: "starter" | "pro" | "enterprise";
  uid: string;
  email: string;
  name: string;
  /** Add-ons ativos na coleção `addons`. */
  addons?: Array<"financial" | "crm" | "pdf_editor_full" | "pdf_editor_partial">;
}

export const PLAN_STARTER: SeedPlanTenant = {
  tenantId: "tenant-plan-starter",
  tier: "starter",
  uid: "user-plan-starter",
  email: "starter@plans.test",
  name: "Master Starter",
};

export const PLAN_PRO: SeedPlanTenant = {
  tenantId: "tenant-plan-pro",
  tier: "pro",
  uid: "user-plan-pro",
  email: "pro@plans.test",
  name: "Master Pro",
};

export const PLAN_ENTERPRISE: SeedPlanTenant = {
  tenantId: "tenant-plan-enterprise",
  tier: "enterprise",
  uid: "user-plan-enterprise",
  email: "enterprise@plans.test",
  name: "Master Enterprise",
};

export const PLAN_STARTER_ADDON: SeedPlanTenant = {
  tenantId: "tenant-plan-starter-addon",
  tier: "starter",
  uid: "user-plan-starter-addon",
  email: "starter-addon@plans.test",
  name: "Master Starter com Add-on",
  addons: ["financial"],
};

export const PLAN_TENANTS = [
  PLAN_STARTER,
  PLAN_PRO,
  PLAN_ENTERPRISE,
  PLAN_STARTER_ADDON,
];

export const PLAN_PASSWORD = PASSWORD;

export async function seedPlanTenants(
  auth: Auth,
  db: Firestore,
): Promise<void> {
  for (const seed of PLAN_TENANTS) {
    // `plan` é o campo que tenant-plan-policy lê primeiro;
    // `subscriptionStatus: "active"` passa o gate de billing, que é binário e
    // vem antes — sem ele o teste bateria em /subscription-blocked e não
    // chegaria no gate de plano que se quer medir.
    await db.collection("tenants").doc(seed.tenantId).set({
      id: seed.tenantId,
      tenantId: seed.tenantId,
      name: `Plan ${seed.tier}`,
      niche: "automacao_residencial",
      primaryColor: "#0EA5E9",
      plan: seed.tier,
      planId: seed.tier,
      subscriptionStatus: "active",
      createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
    });

    try {
      await auth.createUser({
        uid: seed.uid,
        email: seed.email,
        password: PASSWORD,
        displayName: seed.name,
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

    await auth.setCustomUserClaims(seed.uid, {
      tenantId: seed.tenantId,
      role: "MASTER",
      masterId: seed.uid,
      subscriptionStatus: "active",
    });

    await db.collection("users").doc(seed.uid).set({
      id: seed.uid,
      tenantId: seed.tenantId,
      companyId: seed.tenantId,
      name: seed.name,
      email: seed.email,
      role: "MASTER",
      masterId: seed.uid,
      status: "active",
      planId: seed.tier,
      subscriptionStatus: "active",
      createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
    });

    for (const addonType of seed.addons ?? []) {
      // Mesmo id e mesma forma que stripeHelpers.saveAddon grava.
      await db
        .collection("addons")
        .doc(`${seed.tenantId}_${addonType}`)
        .set({
          tenantId: seed.tenantId,
          addonType,
          stripeSubscriptionId: `sub_test_${addonType}`,
          status: "active",
          purchasedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
        });
    }
  }

  console.log(
    `[seed] Plan tenants created: ${PLAN_TENANTS.map((t) => t.tenantId).join(", ")}`,
  );
}
