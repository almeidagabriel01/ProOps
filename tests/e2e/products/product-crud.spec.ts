import { test, expect } from "../fixtures/auth.fixture";
import { ProductsPage } from "../pages/products.page";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("Products CRUD", () => {
  test("PROD-01: creates a product via the UI form", async ({ authenticatedPage }) => {
    const productsPage = new ProductsPage(authenticatedPage);
    const timestamp = Date.now();
    const productName = `Produto Teste ${timestamp}`;

    await productsPage.goto();
    await productsPage.isLoaded();

    await productsPage.createProduct({
      name: productName,
      category: "Sensores",
      manufacturer: "Fabricante Teste",
      price: "15000",
    });

    // After creation the form redirects to /products — verify the product appears
    await productsPage.isLoaded();
    const productLink = productsPage.getProductByName(productName);
    await expect(productLink).toBeVisible({ timeout: 10000 });
  });

  test("PROD-02: edits a product via the UI form", async ({ authenticatedPage }) => {
    const productsPage = new ProductsPage(authenticatedPage);
    const timestamp = Date.now();
    const originalName = `Produto Editar ${timestamp}`;
    const updatedName = `Produto Editado ${timestamp}`;

    // First create the product to edit
    await productsPage.goto();
    await productsPage.isLoaded();
    await productsPage.createProduct({
      name: originalName,
      category: "Sensores",
      manufacturer: "Fabricante Teste",
      price: "15000",
    });

    // Confirm it exists in the list
    await productsPage.isLoaded();
    const productLink = productsPage.getProductByName(originalName);
    await expect(productLink).toBeVisible({ timeout: 10000 });

    // Extract product ID from the link href
    const href = await productLink.getAttribute("href");
    expect(href).toBeTruthy();
    const productId = href!.split("/products/")[1];
    expect(productId).toBeTruthy();

    // Edit the product
    await productsPage.editProduct(productId, { name: updatedName });

    // Verify the updated name appears in the list
    await productsPage.goto();
    await productsPage.isLoaded();
    const updatedLink = productsPage.getProductByName(updatedName);
    await expect(updatedLink).toBeVisible({ timeout: 10000 });
  });

  test("PROD-03: deletes a product via the UI", async ({ authenticatedPage }) => {
    // Use the API to create the product so we don't depend on PROD-01 succeeding
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const productName = `Produto Deletar ${timestamp}`;

    const createResponse = await authenticatedPage.request.post("/api/backend/v1/products", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        name: productName,
        price: 100,
        category: "Teste",
        manufacturer: "Fabricante Teste",
        markup: 30,
        itemType: "product",
      },
    });
    expect(createResponse.status()).toBe(201);

    // Navigate to the products list and verify the product is visible
    const productsPage = new ProductsPage(authenticatedPage);
    await productsPage.goto();
    await productsPage.isLoaded();

    await expect(
      authenticatedPage.getByRole("link", { name: productName }),
    ).toBeVisible({ timeout: 10000 });

    // Delete via the UI
    await productsPage.deleteProduct(productName);

    // Verify it no longer appears in the list
    await expect(
      authenticatedPage.getByRole("link", { name: productName }),
    ).not.toBeVisible({ timeout: 10000 });
  });
});
