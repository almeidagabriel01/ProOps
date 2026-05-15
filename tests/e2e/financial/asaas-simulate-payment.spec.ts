/**
 * Asaas PIX payment simulate flow E2E test.
 *
 * Tests the full UI lifecycle when a client clicks "Simular pagamento (sandbox)":
 * 1. Create a share link for a transaction
 * 2. Open it as an unauthenticated browser context
 * 3. Mock the payment API endpoints (Asaas unavailable in emulator)
 * 4. Verify the UI transitions to "Pagamento aprovado!" without a page reload
 *
 * API routes are mocked via page.route() because the emulator environment
 * does not have Asaas credentials. The test validates the client-side state
 * machine and the confirm-after-simulate logic added in this bug fix.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

const MOCK_QR_PAYLOAD = "00020126580014br.gov.bcb.pix0136test-key5204000053039865406100.005802BR5906Seller6009SAO PAULO62070503***63049B89";
const MOCK_PAYMENT_ID = "pay_simulate_test_001";

test.describe("Asaas PIX simulate payment flow", () => {
  test("simulating a sandbox payment transitions UI to 'Pagamento aprovado!' without reload", async ({
    authenticatedPage,
    browser,
  }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    // Step 1: Create a pending income transaction via API
    const today = new Date().toISOString().split("T")[0];
    const createTxResponse = await authenticatedPage.request.post(
      "/api/backend/v1/transactions",
      {
        headers: { Authorization: `Bearer ${idToken}` },
        data: {
          description: "Asaas Simulate Test",
          amount: 100,
          date: today,
          type: "income",
          status: "pending",
        },
      },
    );
    expect(createTxResponse.status()).toBe(201);
    const { transactionId } = await createTxResponse.json();
    expect(transactionId).toBeTruthy();

    // Step 2: Generate a share link for the transaction
    const shareResponse = await authenticatedPage.request.post(
      `/api/backend/v1/transactions/${transactionId}/share-link`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect(shareResponse.status()).toBe(201);
    const { token } = await shareResponse.json();
    expect(token).toBeTruthy();

    // Step 3: Open the share link in a fresh unauthenticated browser context
    const publicPage = await browser.newPage();

    // Step 4: Mock the backend API endpoints that require Asaas credentials
    // These are called from the Next.js proxy (/api/backend/*) which forwards to Cloud Functions

    // Mock the base share transaction endpoint to inject asaasEnabled: true into the
    // tenant object. The real backend doesn't have Asaas credentials in the emulator,
    // so tenant.asaasEnabled is absent, making canPay false and hiding the Pagar button.
    await publicPage.route(
      `**/api/backend/v1/share/transaction/${token}`,
      async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        await route.fulfill({
          status: response.status(),
          contentType: "application/json",
          body: JSON.stringify({
            ...json,
            tenant: { ...(json.tenant ?? {}), asaasEnabled: true },
          }),
        });
      },
    );

    // Mock payment-config endpoint — tell the frontend that Asaas is the payment provider
    await publicPage.route(
      `**/api/backend/v1/share/transaction/${token}/payment-config`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            provider: "asaas",
            environment: "sandbox",
            asaasEnabled: true,
            allowedMethods: ["pix"],
          }),
        }),
    );

    // Mock QR code creation endpoint
    await publicPage.route(
      `**/api/backend/v1/share/transaction/${token}/payment`,
      (route) =>
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            method: "pix",
            paymentId: MOCK_PAYMENT_ID,
            qrCode: MOCK_QR_PAYLOAD,
            qrCodeImage: "data:image/png;base64,iVBORw0KGgoAAAANS=",
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            amount: 100,
          }),
        }),
    );

    // Mock simulate endpoint
    await publicPage.route(
      `**/api/backend/v1/share/transaction/${token}/payment/${MOCK_PAYMENT_ID}/simulate`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        }),
    );

    // Mock status endpoint — returns approved (as it would after processAsaasPaymentLocally)
    await publicPage.route(
      `**/api/backend/v1/share/transaction/${token}/payment/${MOCK_PAYMENT_ID}/status`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            paymentId: MOCK_PAYMENT_ID,
            status: "approved",
            amount: 100,
            paidAt: new Date().toISOString(),
          }),
        }),
    );

    // Navigate to the share link
    await publicPage.goto(`/share/transaction/${token}`);
    await publicPage.waitForLoadState("networkidle");

    // Verify the share page loaded (not redirected to login)
    expect(publicPage.url()).toContain(`/share/transaction/${token}`);
    expect(publicPage.url()).not.toContain("/login");

    // Click the "Pagar" / PIX button to open the payment modal
    const payButton = publicPage.getByRole("button", { name: /pagar/i }).first();
    await payButton.waitFor({ state: "visible", timeout: 10_000 });
    await payButton.click();

    // Wait for the QR code to appear
    await publicPage.waitForSelector("[data-testid='pix-qrcode'], canvas, img[alt*='QR']", {
      timeout: 10_000,
    }).catch(() => {
      // Fallback: wait for the simulate button
    });

    // Click "Simular pagamento (sandbox)" button
    const simulateButton = publicPage.getByRole("button", { name: /simular pagamento/i });
    await simulateButton.waitFor({ state: "visible", timeout: 15_000 });
    await simulateButton.click();

    // The UI should transition to "Pagamento aprovado!" WITHOUT a page reload
    await expect(
      publicPage.getByText(/pagamento aprovado/i),
    ).toBeVisible({ timeout: 10_000 });

    // Confirm the URL did NOT change (no reload via window.location.href)
    expect(publicPage.url()).toContain(`/share/transaction/${token}`);
    expect(publicPage.url()).not.toContain("payment_success=1");

    await publicPage.close();
  });
});
