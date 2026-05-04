import type { Firestore } from "firebase-admin/firestore";

export interface SeedTenant {
  id: string;
  tenantId: string;
  name: string;
  niche: "automacao_residencial" | "cortinas";
  primaryColor: string;
  createdAt: string;
}

export const TENANT_ALPHA: SeedTenant = {
  id: "tenant-alpha",
  tenantId: "tenant-alpha",
  name: "Alpha Corp",
  niche: "automacao_residencial",
  primaryColor: "#2563EB",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export const TENANT_BETA: SeedTenant = {
  id: "tenant-beta",
  tenantId: "tenant-beta",
  name: "Beta Ltd",
  niche: "cortinas",
  primaryColor: "#16A34A",
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export async function seedTenants(db: Firestore): Promise<void> {
  const batch = db.batch();

  batch.set(db.collection("tenants").doc(TENANT_ALPHA.id), TENANT_ALPHA);
  batch.set(db.collection("tenants").doc(TENANT_BETA.id), TENANT_BETA);

  await batch.commit();
  console.log("[seed] Tenants created: tenant-alpha, tenant-beta");
}
