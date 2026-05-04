import type { Firestore } from "firebase-admin/firestore";

/**
 * Seeds a minimal product catalog for tenant-alpha.
 *
 * The useProposalForm hook guards on `products.length === 0` before fetching
 * an existing proposal (to sync proposal products with fresh catalog data).
 * Without at least one product in Firestore, the proposal edit page stays
 * in "Carregando Proposta..." indefinitely — blocking PROP-02 and PROP-03.
 */
export async function seedProducts(db: Firestore): Promise<void> {
  const batch = db.batch();

  const product = {
    id: "product-sensor-001",
    tenantId: "tenant-alpha",
    name: "Sensor de Presença",
    description: "Sensor de presença para automação residencial",
    price: 150,
    unitPrice: 150,
    markup: 30,
    category: "Sensores",
    itemType: "product",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ref = db.collection("products").doc(product.id);
  batch.set(ref, product);

  await batch.commit();
  console.log("[seed] Products created: 1 for tenant-alpha");
}
