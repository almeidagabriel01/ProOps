import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";
import { USER_ADMIN_BETA } from "../seed/data/users";

/**
 * Nicho de persianas e toldos (id `cortinas`), com o tenant-beta.
 *
 * O tenant de demonstração é só de automação e nenhum E2E entrava num tenant
 * deste nicho: o preço por medida, a troca de Soluções por Ambientes e os
 * painéis da linha nunca eram exercitados de ponta a ponta. Este spec não
 * mexe em plano nem em cobrança do beta, que os specs de billing usam.
 */
test.describe("Nicho de persianas e toldos", () => {
  test("NICHO-01: Soluções leva a Ambientes", async ({ authenticatedAsBeta: page }) => {
    await page.goto("/solutions");
    await page.waitForURL((url) => url.pathname === "/ambientes", { timeout: 20000 });
  });

  test("NICHO-02: a lista de produtos mostra o saldo por metragem", async ({
    authenticatedAsBeta: page,
  }) => {
    await page.goto("/products");
    await expect(page.getByText("Saldo de custo em metragem").first()).toBeVisible({
      timeout: 20000,
    });
  });

  test("NICHO-03: os painéis da linha por medida sobrevivem ao salvar", async ({
    authenticatedAsBeta: page,
  }) => {
    const { idToken } = await signInWithEmailPassword(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    const headers = { Authorization: `Bearer ${idToken}` };
    const stamp = Date.now();

    const product = await page.request.post("/api/backend/v1/products", {
      headers,
      data: {
        name: `Persiana E2E ${stamp}`,
        price: "100",
        markup: "50",
        pricingModel: { mode: "curtain_meter" },
        inventoryUnit: "meter",
        inventoryValue: 10,
      },
    });
    expect(product.status(), await product.text()).toBe(201);
    const { productId } = await product.json();

    const client = await page.request.post("/api/backend/v1/clients", {
      headers,
      data: { name: `Cliente E2E ${stamp}`, phone: "(11) 99900-0007", types: ["cliente"] },
    });
    expect(client.status(), await client.text()).toBe(201);
    const clientBody = await client.json();
    const clientId: string = clientBody.clientId ?? clientBody.id;

    const proposal = await page.request.post("/api/backend/v1/proposals", {
      headers,
      data: {
        title: `Proposta E2E ${stamp}`,
        clientId,
        clientName: `Cliente E2E ${stamp}`,
        products: [
          {
            productId,
            itemType: "product",
            productName: `Persiana E2E ${stamp}`,
            quantity: 9,
            unitPrice: 100,
            markup: 50,
            total: 1350,
            pricingDetails: { mode: "curtain_meter", width: 1.2, height: 2.5, panels: 3 },
          },
        ],
        totalValue: 1350,
      },
    });
    expect(proposal.status(), await proposal.text()).toBe(201);
    const { proposalId } = await proposal.json();

    const db = getTestDb();
    const saved = (await db.collection("proposals").doc(proposalId).get()).data();
    expect(saved?.products?.[0]?.pricingDetails).toEqual({
      mode: "curtain_meter",
      width: 1.2,
      height: 2.5,
      area: 3,
      panels: 3,
    });

    await db.collection("proposals").doc(proposalId).delete();
    await db.collection("products").doc(productId).delete();
    await db.collection("clients").doc(clientId).delete();
  });
});
