/**
 * FIN-06: Installment transaction E2E test — hybrid API + UI pattern.
 *
 * Coverage decisions:
 *  D-04: Installment group creation is done via backend API (POST /v1/transactions) to avoid
 *        the complexity of driving the multi-step wizard with installment form configuration.
 *  D-05: Marking installments as paid is done via the "Agrupados" view where the card expands
 *        to show TransactionInstallmentsList with interactive status dropdowns per installment.
 *  Pitfall 3: Sequential payment order is enforced in TransactionInstallmentsList — installment N
 *        cannot be paid before installment N-1. The test marks installment 1 before 2.
 *
 * UI flow:
 *  1. API creates installment group (3 installments).
 *  2. Navigate to /transactions and switch to "Agrupados" view.
 *  3. Find the installment group card by description and click to expand it.
 *  4. TransactionInstallmentsList shows "Parcela 1/3", "Parcela 2/3", "Parcela 3/3" rows.
 *  5. Click the "Pendente" status button on installment 1/3 row, select "Pago".
 *  6. Click the "Pendente" status button on installment 2/3 row, select "Pago".
 *  7. Delete via API.
 */

import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("FIN-06: Installment transactions", () => {
  test("creates installment group via API and marks installments as paid via UI", async ({ authenticatedPage }) => {
    // Step 1: Obtain a Firebase ID token via the Auth emulator REST API (Node.js context).
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const description = `Parcelas FIN-06 ${timestamp}`;

    // Step 2: Create installment transaction group via backend API (per D-04).
    // Fields verified against functions/src/api/helpers/transaction-validation.ts:
    //   Required: description (string), amount (number), date (YYYY-MM-DD), type, status
    //   Installment: isInstallment=true, installmentCount=3, paymentMode="total"
    //   (total: 300 / 3 = 100 per installment)
    // Response (verified in transactions.controller.ts): { success, transactionId, message }
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/transactions", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        type: "income",
        description,
        amount: 300,
        date: "2024-07-01",
        dueDate: "2024-07-01",
        status: "pending",
        wallet: "wallet-alpha-main",
        isInstallment: true,
        installmentCount: 3,
        paymentMode: "total",
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const transactionId = createData.transactionId;
    expect(transactionId).toBeTruthy();

    // Step 3: Navigate to the transactions list page.
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/\/transactions/, { timeout: 15000 });

    // Step 4: Switch to "Agrupados" view.
    // The "Agrupados" view renders installment groups as expandable cards with
    // TransactionInstallmentsList showing individual installment rows with status dropdowns.
    // The default "Por Vencimento" view renders each installment as a flat independent row.
    const agroupadosBtn = authenticatedPage.getByRole("button", { name: /agrupados/i });
    await agroupadosBtn.click();

    // Step 5: Wait for the installment group card to appear.
    // In grouped view, the first installment's description is shown as the card title.
    await expect(authenticatedPage.getByText(description)).toBeVisible({ timeout: 15000 });

    // Step 6: Expand the group card to reveal the TransactionInstallmentsList.
    // The card area (outside buttons/links) acts as the expand toggle.
    // We click on the description text which is within the clickable card area.
    await authenticatedPage.getByText(description).first().click();

    // Step 7: Wait for the installment rows to appear.
    // TransactionInstallmentsList renders: "Parcela 1/3", "Parcela 2/3", "Parcela 3/3"
    // (template: `Parcela ${installmentNumber}/${installmentCount}`)
    // Use exact: true to avoid matching "Parcela 1/3 - Projeto Condomínio Alfa" (seeded data).
    await expect(authenticatedPage.getByText("Parcela 1/3", { exact: true })).toBeVisible({ timeout: 10000 });

    // Step 8: Mark installment 1/3 as paid (per D-05, sequential order per pitfall 3).
    // The status dropdown button is scoped to the installment row container.
    // TransactionInstallmentsList row DOM (from transaction-installments-list.tsx):
    //   [row div: flex items-center justify-between py-2 px-3 rounded-lg border]
    //     [left group: flex items-center gap-3]
    //       [icon div]
    //       [info div]
    //         [label div.font-medium.text-sm: "Parcela 1/3"]   ← TEXT NODE HERE
    //         [sub text: "Venc: ..."]
    //     [right group: flex items-center gap-3]
    //       [amount]
    //       [status Button: "Pendente"]                        ← TARGET
    //
    // Traverse up from the exact text (verified against page snapshot DOM):
    //   e270 "Parcela 1/3" → e269 (info div: label + subtitle) → e263 (left group: checkbox+icon+info) → e262 (row)
    const installment1Label = authenticatedPage.getByText("Parcela 1/3", { exact: true });
    const installment1Row = installment1Label
      .locator("..") // e269: info div (label + vencimento subtitle)
      .locator("..") // e263: left group (checkbox + icon + info)
      .locator(".."); // e262: the installment row div
    const statusBtn1 = installment1Row.getByRole("button", { name: /pendente/i });
    await statusBtn1.scrollIntoViewIfNeeded();
    await statusBtn1.click();

    // The project uses a custom DropdownMenu (src/components/ui/dropdown-menu.tsx) that:
    // - Renders content via ReactDOM.createPortal into document.body as a plain <div>
    // - DropdownMenuItems render as <div> — no role="menuitem" attribute
    // - Content is identified by its fixed-position style and high z-index (z-[45])
    //
    // Strategy: Wait for the portal content div to appear (data-state="open" on trigger means
    // content is visible), then click the "Pago" text within the portal.
    // The portal content is a direct child of body with position:fixed styling.
    await authenticatedPage.waitForFunction(() => {
      // The open dropdown content is a fixed-position div in document.body
      const bodyChildren = Array.from(document.body.children);
      return bodyChildren.some(
        (el) =>
          el instanceof HTMLElement &&
          el.style.position === "fixed" &&
          el.textContent?.includes("Pago"),
      );
    }, { timeout: 5000 });

    // Click the "Pago" item inside the portal dropdown content.
    // The portal div contains plain <div> items (not role="menuitem").
    // Scope to the portal content using its unique characteristics.
    const portalContent = authenticatedPage.locator("body > div[style*='position: fixed']").filter({
      hasText: "Pago",
    });
    const installment1Updated = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes("/api/backend/") &&
        resp.request().method() !== "GET" &&
        resp.status() === 200,
      { timeout: 10000 },
    );
    await portalContent.getByText("Pago", { exact: true }).click();
    await installment1Updated;

    // Step 9: Verify installment 1/3 now shows "Pago" in its status button.
    await expect(installment1Row.getByRole("button", { name: /^pago$/i })).toBeVisible({
      timeout: 10000,
    });

    // Step 10: Mark installment 2/3 as paid (after 1/3 — sequential order per pitfall 3).
    await expect(authenticatedPage.getByText("Parcela 2/3", { exact: true })).toBeVisible({ timeout: 5000 });

    const installment2Label = authenticatedPage.getByText("Parcela 2/3", { exact: true });
    const installment2Row = installment2Label
      .locator("..") // info div
      .locator("..") // left group
      .locator(".."); // row div
    const statusBtn2 = installment2Row.getByRole("button", { name: /pendente/i });
    await statusBtn2.scrollIntoViewIfNeeded();
    await statusBtn2.click();

    await authenticatedPage.waitForFunction(() => {
      const bodyChildren = Array.from(document.body.children);
      return bodyChildren.some(
        (el) =>
          el instanceof HTMLElement &&
          el.style.position === "fixed" &&
          el.textContent?.includes("Pago"),
      );
    }, { timeout: 5000 });

    const portalContent2 = authenticatedPage.locator("body > div[style*='position: fixed']").filter({
      hasText: "Pago",
    });
    const installment2Updated = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes("/api/backend/") &&
        resp.request().method() !== "GET" &&
        resp.status() === 200,
      { timeout: 10000 },
    );
    await portalContent2.getByText("Pago", { exact: true }).click();
    await installment2Updated;

    // Step 11: Verify installment 2/3 now shows "Pago".
    await expect(installment2Row.getByRole("button", { name: /^pago$/i })).toBeVisible({
      timeout: 10000,
    });

    // Step 12: Cleanup — delete the first installment via API.
    // DELETE returns 200 with { success: true } per transactions.controller.ts.
    const deleteResponse = await authenticatedPage.request.delete(
      `/api/backend/v1/transactions/${transactionId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResponse.status());
  });
});

test.describe("FIN-08: Selective installment payment", () => {
  test("pays installments 1/3 and 2/3 via UI; installment 3/3 stays Pendente", async ({ authenticatedPage }) => {
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const description = `Parcelas FIN-08 ${timestamp}`;

    // Step 1: Create 3-installment group via backend API (D-05 pattern from Phase 4)
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/transactions", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        type: "income",
        description,
        amount: 300,
        date: "2024-07-01",
        dueDate: "2024-07-01",
        status: "pending",
        wallet: "wallet-alpha-main",
        isInstallment: true,
        installmentCount: 3,
        paymentMode: "total",
      },
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const transactionId = createData.transactionId;
    expect(transactionId).toBeTruthy();

    // Step 2: Navigate to /transactions and switch to "Agrupados" view
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForURL(/\/transactions/, { timeout: 15000 });

    const agroupadosBtn = authenticatedPage.getByRole("button", { name: /agrupados/i });
    await agroupadosBtn.click();

    // Step 3: Expand the group card
    await expect(authenticatedPage.getByText(description)).toBeVisible({ timeout: 15000 });
    await authenticatedPage.getByText(description).first().click();

    // Step 4: Wait for installment rows
    await expect(authenticatedPage.getByText("Parcela 1/3", { exact: true })).toBeVisible({ timeout: 10000 });

    // Step 5: Mark installment 1/3 as paid (sequential order — must be before 2/3)
    const installment1Label = authenticatedPage.getByText("Parcela 1/3", { exact: true });
    const installment1Row = installment1Label.locator("..").locator("..").locator("..");
    const statusBtn1 = installment1Row.getByRole("button", { name: /pendente/i });
    await statusBtn1.scrollIntoViewIfNeeded();
    await statusBtn1.click();

    await authenticatedPage.waitForFunction(() => {
      return Array.from(document.body.children).some(
        (el) => el instanceof HTMLElement && el.style.position === "fixed" && el.textContent?.includes("Pago"),
      );
    }, { timeout: 5000 });

    const portalContent1 = authenticatedPage.locator("body > div[style*='position: fixed']").filter({ hasText: "Pago" });
    const fin08Installment1Updated = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes("/api/backend/") &&
        resp.request().method() !== "GET" &&
        resp.status() === 200,
      { timeout: 10000 },
    );
    await portalContent1.getByText("Pago", { exact: true }).click();
    await fin08Installment1Updated;

    await expect(installment1Row.getByRole("button", { name: /^pago$/i })).toBeVisible({ timeout: 10000 });

    // Step 6: Mark installment 2/3 as paid
    await expect(authenticatedPage.getByText("Parcela 2/3", { exact: true })).toBeVisible({ timeout: 5000 });
    const installment2Label = authenticatedPage.getByText("Parcela 2/3", { exact: true });
    const installment2Row = installment2Label.locator("..").locator("..").locator("..");
    const statusBtn2 = installment2Row.getByRole("button", { name: /pendente/i });
    await statusBtn2.scrollIntoViewIfNeeded();
    await statusBtn2.click();

    await authenticatedPage.waitForFunction(() => {
      return Array.from(document.body.children).some(
        (el) => el instanceof HTMLElement && el.style.position === "fixed" && el.textContent?.includes("Pago"),
      );
    }, { timeout: 5000 });

    const portalContent2 = authenticatedPage.locator("body > div[style*='position: fixed']").filter({ hasText: "Pago" });
    const fin08Installment2Updated = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes("/api/backend/") &&
        resp.request().method() !== "GET" &&
        resp.status() === 200,
      { timeout: 10000 },
    );
    await portalContent2.getByText("Pago", { exact: true }).click();
    await fin08Installment2Updated;

    await expect(installment2Row.getByRole("button", { name: /^pago$/i })).toBeVisible({ timeout: 10000 });

    // Step 7: FIN-08 core assertion — installment 3/3 MUST still show "Pendente"
    await expect(authenticatedPage.getByText("Parcela 3/3", { exact: true })).toBeVisible({ timeout: 5000 });
    const installment3Label = authenticatedPage.getByText("Parcela 3/3", { exact: true });
    const installment3Row = installment3Label.locator("..").locator("..").locator("..");
    await expect(installment3Row.getByRole("button", { name: /^pendente$/i })).toBeVisible({ timeout: 5000 });

    // Cleanup: delete the installment group via API
    const deleteResponse = await authenticatedPage.request.delete(
      `/api/backend/v1/transactions/${transactionId}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    expect([200, 204]).toContain(deleteResponse.status());
  });
});
