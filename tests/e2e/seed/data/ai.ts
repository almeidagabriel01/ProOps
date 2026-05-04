import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { SeedTenant } from "./tenants";
import type { SeedUser } from "./users";

// ─── Tenant Constants ────────────────────────────────────────────────────────

export const TENANT_AI_TEST: SeedTenant = {
  id: "ai-test",
  tenantId: "ai-test",
  name: "AI Test Corp",
  niche: "automacao_residencial",
  primaryColor: "#7C3AED",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export const TENANT_AI_STARTER: SeedTenant = {
  id: "ai-starter",
  tenantId: "ai-starter",
  name: "AI Starter Corp",
  niche: "automacao_residencial",
  primaryColor: "#F59E0B",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export const TENANT_AI_FREE: SeedTenant = {
  id: "ai-free",
  tenantId: "ai-free",
  name: "AI Free Corp",
  niche: "automacao_residencial",
  primaryColor: "#6B7280",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

/** Dedicated tenant for quota-bypass tests — never shared with other specs */
export const TENANT_AI_QUOTA: SeedTenant = {
  id: "ai-quota",
  tenantId: "ai-quota",
  name: "AI Quota Corp",
  niche: "automacao_residencial",
  primaryColor: "#10B981",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

/** Dedicated tenant for rate-limit E2E test — never shared with other specs */
export const TENANT_AI_RATELIMIT: SeedTenant = {
  id: "ai-ratelimit",
  tenantId: "ai-ratelimit",
  name: "AI RateLimit Corp",
  niche: "automacao_residencial",
  primaryColor: "#EF4444",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

// ─── User Constants ───────────────────────────────────────────────────────────

export const USER_AI_ADMIN: SeedUser = {
  uid: "ai-admin-uid",
  email: "ai-admin@test.com",
  password: "TestPass123!",
  name: "AI Admin",
  tenantId: "ai-test",
  role: "admin",
  masterId: "ai-admin-uid",
};

export const USER_AI_MEMBER: SeedUser = {
  uid: "ai-member-uid",
  email: "ai-member@test.com",
  password: "TestPass123!",
  name: "AI Member",
  tenantId: "ai-test",
  role: "member",
  masterId: "ai-admin-uid",
};

export const USER_AI_STARTER: SeedUser = {
  uid: "ai-starter-uid",
  email: "ai-starter@test.com",
  password: "TestPass123!",
  name: "AI Starter Admin",
  tenantId: "ai-starter",
  role: "admin",
  masterId: "ai-starter-uid",
};

export const USER_AI_FREE: SeedUser = {
  uid: "ai-free-uid",
  email: "ai-free@test.com",
  password: "TestPass123!",
  name: "AI Free Admin",
  tenantId: "ai-free",
  role: "admin",
  masterId: "ai-free-uid",
};

/** Dedicated pro user for quota-bypass tests — never shared with other specs */
export const USER_AI_QUOTA: SeedUser = {
  uid: "ai-quota-uid",
  email: "ai-quota@test.com",
  password: "TestPass123!",
  name: "AI Quota Admin",
  tenantId: "ai-quota",
  role: "admin",
  masterId: "ai-quota-uid",
};

/** Dedicated starter user for rate-limit E2E test — never shared with other specs */
export const USER_AI_RATELIMIT: SeedUser = {
  uid: "ai-ratelimit-uid",
  email: "ai-ratelimit@test.com",
  password: "TestPass123!",
  name: "AI RateLimit Admin",
  tenantId: "ai-ratelimit",
  role: "admin",
  masterId: "ai-ratelimit-uid",
};

// USER_AI_FREE_ROLE: user with role: "free" in custom claims.
// Protected-app-shell.tsx gates LiaContainer with `user.role !== "free"`,
// so this user must NOT see the Lia trigger button.
export interface SeedUserFreeRole extends Omit<SeedUser, "role"> {
  role: "free";
}

export const USER_AI_FREE_ROLE: SeedUserFreeRole = {
  uid: "ai-free-role-uid",
  email: "ai-free-role@test.com",
  password: "TestPass123!",
  name: "AI Free Role User",
  tenantId: "ai-free",
  role: "free",
  masterId: "ai-free-uid",
};

// ─── Tenant plan metadata (used in seedAiTenants) ─────────────────────────────

const AI_TENANT_PLANS: Record<
  string,
  { plan: string; planId: string; subscriptionStatus: string; whatsappEnabled: boolean }
> = {
  "ai-test": {
    plan: "pro",
    planId: "pro",
    subscriptionStatus: "active",
    whatsappEnabled: true,
  },
  "ai-starter": {
    plan: "starter",
    planId: "starter",
    subscriptionStatus: "active",
    whatsappEnabled: false,
  },
  "ai-free": {
    plan: "free",
    planId: "free",
    subscriptionStatus: "canceled",
    whatsappEnabled: false,
  },
  "ai-quota": {
    plan: "pro",
    planId: "pro",
    subscriptionStatus: "active",
    whatsappEnabled: false,
  },
  "ai-ratelimit": {
    plan: "starter",
    planId: "starter",
    subscriptionStatus: "active",
    whatsappEnabled: false,
  },
};

// ─── Seed Function ────────────────────────────────────────────────────────────

/**
 * Seeds AI test tenants (pro/starter/free) and their users into the Firebase Emulators.
 * Called from seedAll() in seed-factory.ts after seedUsers().
 */
export async function seedAiTenants(auth: Auth, db: Firestore): Promise<void> {
  const tenants = [TENANT_AI_TEST, TENANT_AI_STARTER, TENANT_AI_FREE, TENANT_AI_QUOTA, TENANT_AI_RATELIMIT];

  // Seed tenants with plan metadata
  const batch = db.batch();
  for (const tenant of tenants) {
    const planMeta = AI_TENANT_PLANS[tenant.tenantId]!;
    batch.set(db.collection("tenants").doc(tenant.id), {
      ...tenant,
      ...planMeta,
    });
  }
  await batch.commit();

  // Seed users (SeedUser-typed)
  const standardUsers: SeedUser[] = [USER_AI_ADMIN, USER_AI_MEMBER, USER_AI_STARTER, USER_AI_FREE, USER_AI_QUOTA, USER_AI_RATELIMIT];

  for (const user of standardUsers) {
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        password: user.password,
        displayName: user.name,
        emailVerified: true,
      });
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (
        firebaseErr.code !== "auth/uid-already-exists" &&
        firebaseErr.code !== "auth/email-already-exists"
      ) {
        throw err;
      }
    }

    const planMeta = AI_TENANT_PLANS[user.tenantId]!;
    await auth.setCustomUserClaims(user.uid, {
      tenantId: user.tenantId,
      role: user.role,
      masterId: user.masterId ?? user.uid,
    });

    await db.collection("users").doc(user.uid).set({
      id: user.uid,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      masterId: user.masterId ?? user.uid,
      status: "active",
      createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
      planId: planMeta.planId,
    });
  }

  // Seed USER_AI_FREE_ROLE separately (role: "free" not in SeedUser union)
  try {
    await auth.createUser({
      uid: USER_AI_FREE_ROLE.uid,
      email: USER_AI_FREE_ROLE.email,
      password: USER_AI_FREE_ROLE.password,
      displayName: USER_AI_FREE_ROLE.name,
      emailVerified: true,
    });
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string };
    if (
      firebaseErr.code !== "auth/uid-already-exists" &&
      firebaseErr.code !== "auth/email-already-exists"
    ) {
      throw err;
    }
  }

  await auth.setCustomUserClaims(USER_AI_FREE_ROLE.uid, {
    tenantId: USER_AI_FREE_ROLE.tenantId,
    role: USER_AI_FREE_ROLE.role,
    masterId: USER_AI_FREE_ROLE.masterId ?? USER_AI_FREE_ROLE.uid,
  });

  await db.collection("users").doc(USER_AI_FREE_ROLE.uid).set({
    id: USER_AI_FREE_ROLE.uid,
    tenantId: USER_AI_FREE_ROLE.tenantId,
    name: USER_AI_FREE_ROLE.name,
    email: USER_AI_FREE_ROLE.email,
    role: USER_AI_FREE_ROLE.role,
    masterId: USER_AI_FREE_ROLE.masterId ?? USER_AI_FREE_ROLE.uid,
    status: "active",
    createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
    planId: AI_TENANT_PLANS["ai-free"]!.planId,
  });

  console.log("[seed] AI tenants created: ai-test, ai-starter, ai-free");
}

// ─── AI Usage Helpers ─────────────────────────────────────────────────────────

/**
 * Seeds AI usage for a tenant in the current month.
 * Used by plan-limits tests to simulate near-limit / at-limit states.
 */
export async function seedAiUsage(
  db: Firestore,
  tenantId: string,
  messagesUsed: number,
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await db.doc(`tenants/${tenantId}/aiUsage/${month}`).set({
    tenantId,
    month,
    messagesUsed,
    totalTokensUsed: 0,
    lastUpdatedAt: new Date(),
  });
}

/**
 * Clears AI usage for a tenant in the current month.
 * Used to reset state between test cases.
 */
export async function clearAiUsage(db: Firestore, tenantId: string): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await db.doc(`tenants/${tenantId}/aiUsage/${month}`).delete();
}
