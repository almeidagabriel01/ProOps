import type { Firestore } from "firebase-admin/firestore";

/**
 * Minimal seed data for sistemas and ambientes used in proposal CRUD E2E tests.
 * TENANT_ALPHA niche: automacao_residencial — form step 2 requires at least one sistema+ambiente with products.
 */

export interface SeedAmbiente {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  defaultProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    itemType?: "product" | "service";
    status?: "active" | "inactive";
  }>;
  createdAt: string;
}

export interface SeedSistema {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  ambientes: Array<{
    ambienteId: string;
    products: Array<{
      productId: string;
      productName: string;
      quantity: number;
      itemType?: "product" | "service";
      status?: "active" | "inactive";
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const AMBIENTE_SALA: SeedAmbiente = {
  id: "ambiente-sala-001",
  tenantId: "tenant-alpha",
  name: "Sala de Estar",
  description: "Automação da sala de estar",
  defaultProducts: [
    {
      productId: "product-001",
      productName: "Central de Automação X200",
      quantity: 1,
      itemType: "product",
      status: "active",
    },
  ],
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export const SISTEMA_ILUMINACAO: SeedSistema = {
  id: "sistema-iluminacao-001",
  tenantId: "tenant-alpha",
  name: "Sistema de Iluminação",
  description: "Automação de iluminação residencial",
  ambientes: [
    {
      ambienteId: "ambiente-sala-001",
      products: [
        {
          productId: "product-001",
          productName: "Central de Automação X200",
          quantity: 1,
          itemType: "product",
          status: "active",
        },
      ],
    },
  ],
  createdAt: new Date("2024-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-01-01T00:00:00Z").toISOString(),
};

export async function seedSistemas(db: Firestore): Promise<void> {
  const batch = db.batch();

  batch.set(
    db.collection("ambientes").doc(AMBIENTE_SALA.id),
    AMBIENTE_SALA,
  );

  batch.set(
    db.collection("sistemas").doc(SISTEMA_ILUMINACAO.id),
    SISTEMA_ILUMINACAO,
  );

  await batch.commit();
  console.log(
    "[seed] Sistemas created: sistema-iluminacao-001 with ambiente-sala-001 for tenant-alpha",
  );
}
