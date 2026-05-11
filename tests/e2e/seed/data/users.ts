import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

export interface SeedUser {
  uid: string;
  email: string;
  password: string;
  name: string;
  tenantId: string;
  role: "admin" | "member";
  masterId?: string;
}

export interface SeedUserFreeRole extends Omit<SeedUser, "role"> {
  role: "free";
}

export interface SeedUserSuperadminRole extends Omit<SeedUser, "role"> {
  role: "superadmin";
}

export const USER_ADMIN_ALPHA: SeedUser = {
  uid: "user-admin-alpha",
  email: "admin@alpha.test",
  password: "Test1234!",
  name: "Admin Alpha",
  tenantId: "tenant-alpha",
  role: "admin",
};

export const USER_MEMBER_ALPHA: SeedUser = {
  uid: "user-member-alpha",
  email: "member@alpha.test",
  password: "Test1234!",
  name: "Member Alpha",
  tenantId: "tenant-alpha",
  role: "member",
  masterId: "user-admin-alpha",
};

export const USER_ADMIN_BETA: SeedUser = {
  uid: "user-admin-beta",
  email: "admin@beta.test",
  password: "Test1234!",
  name: "Admin Beta",
  tenantId: "tenant-beta",
  role: "admin",
};

/** Free-tier user — no ERP access, home is landing page. Tenant has no subscription. */
export const USER_FREE: SeedUserFreeRole = {
  uid: "user-free",
  email: "free@proops.test",
  password: "Test1234!",
  name: "Free User",
  tenantId: "tenant-free",
  role: "free",
};

/** Superadmin user — home is /admin. Dedicated tenant for isolation. */
export const USER_SUPERADMIN: SeedUserSuperadminRole = {
  uid: "user-superadmin",
  email: "superadmin@proops.test",
  password: "Test1234!",
  name: "Super Admin",
  tenantId: "tenant-superadmin",
  role: "superadmin",
};

export const USER_MEMBER_BETA: SeedUser = {
  uid: "user-member-beta",
  email: "member@beta.test",
  password: "Test1234!",
  name: "Member Beta",
  tenantId: "tenant-beta",
  role: "member",
  masterId: "user-admin-beta",
};

const ALL_USERS: (SeedUser | SeedUserFreeRole | SeedUserSuperadminRole)[] = [
  USER_ADMIN_ALPHA,
  USER_MEMBER_ALPHA,
  USER_ADMIN_BETA,
  USER_MEMBER_BETA,
  USER_FREE,
  USER_SUPERADMIN,
];

export async function seedUsers(auth: Auth, db: Firestore): Promise<void> {
  for (const user of ALL_USERS) {
    // Create user in Firebase Auth emulator (ignore if already exists)
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
      if (firebaseErr.code !== "auth/uid-already-exists" && firebaseErr.code !== "auth/email-already-exists") {
        throw err;
      }
    }

    // Set custom claims for tenant isolation and role-based access
    await auth.setCustomUserClaims(user.uid, {
      tenantId: user.tenantId,
      role: user.role,
      masterId: user.masterId ?? user.uid,
    });

    // Write user document to Firestore
    // admin users get "pro" plan so E2E tests are not blocked by the 5-proposal free-plan limit
    const planId = user.role === "admin" ? "pro" : undefined;
    await db.collection("users").doc(user.uid).set({
      id: user.uid,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      masterId: user.masterId ?? user.uid,
      status: "active",
      createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
      ...(planId ? { planId } : {}),
    });

    // Seed bootstrap tenants for users not covered by seedTenants() (free + superadmin)
    if (user.role === "free" || user.role === "superadmin") {
      await db.collection("tenants").doc(user.tenantId).set({
        id: user.tenantId,
        name: `${user.name}'s Tenant`,
        niche: "automacao_residencial",
        primaryColor: "#6B7280",
        createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
      });
    }
  }

  console.log("[seed] Users created: admin-alpha, member-alpha, admin-beta, member-beta, free, superadmin");
}
