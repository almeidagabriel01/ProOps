/**
 * Auth Registration E2E tests — REG-01 through REG-03.
 *
 * REG-01: New user completes the 3-step registration form and submits successfully
 * REG-02: Newly registered tenant has correct Firestore documents (users/{uid}, tenants/{tenantId})
 * REG-03: New tenant lands on '/' after completing registration (free-plan redirect)
 */

import { test, expect } from "../fixtures/auth.fixture";
import { RegisterPage } from "../pages/register.page";
import {
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from "../helpers/firebase-auth-api";
import { getTestDb } from "../helpers/admin-firestore";

test.describe("Auth Registration", () => {
  // REG-01: Form submission
  test("REG-01: completes the registration form and submits successfully", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const timestamp = Date.now();
    const testEmail = `reg-test-${timestamp}@gmail.com`;
    const testPassword = "TestReg1234!";
    const testName = `Teste Registro ${timestamp}`;
    const testCompanyName = `Empresa Teste ${timestamp}`;

    await registerPage.goto();
    await registerPage.isLoaded();

    await registerPage.fillStep1({ name: testName, email: testEmail, password: testPassword });
    await registerPage.fillStep2({ companyName: testCompanyName });
    await registerPage.submitStep3();

    // Wait for the home redirect — proves registration completed and session was established
    await registerPage.waitForHomeRedirect();

    // Final URL must be '/'
    expect(page.url()).toMatch(/\/$/);
  });

  // REG-02: Firestore provisioning
  test("REG-02: newly registered tenant has correct Firestore documents", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const timestamp = Date.now();
    const testEmail = `reg-test-${timestamp}@gmail.com`;
    const testPassword = "TestReg1234!";
    const testName = `Teste Claims ${timestamp}`;
    const testCompanyName = `Empresa Claims ${timestamp}`;

    // Valid BR mobile: real-looking subscriber (not repeated/sequential, not in
    // the backend's fake-number blocklist) so validateBrazilMobilePhone passes.
    const testPhone = "11987654321";

    await registerPage.goto();
    await registerPage.isLoaded();

    await registerPage.fillStep1({
      name: testName,
      email: testEmail,
      password: testPassword,
      phone: testPhone,
    });
    await registerPage.fillStep2({ companyName: testCompanyName });
    await registerPage.submitStep3();

    // Wait for registration to complete (home redirect)
    await registerPage.waitForHomeRedirect();

    // Get the UID by signing in via the Auth emulator REST API
    const { localId: uid } = await signInWithEmailPassword(testEmail, testPassword);
    expect(uid).toBeTruthy();

    const expectedTenantId = `tenant_${uid}`;
    const db = getTestDb();

    // Poll for users/{uid} doc with up to 5s retry (emulator write may lag slightly)
    let userDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    for (let i = 0; i < 10; i++) {
      userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(userDoc?.exists).toBe(true);
    const userData = userDoc!.data()!;
    expect(userData["tenantId"]).toBe(expectedTenantId);
    expect(userData["role"]).toBe("free");
    expect(userData["email"]).toBe(testEmail);
    // Phone must be persisted on the user doc (was previously dropped at signup).
    expect(userData["phoneNumber"]).toBeTruthy();
    expect(String(userData["phoneNumber"]).replace(/\D/g, "")).toContain(
      testPhone,
    );

    // Verify tenants/{tenantId} doc
    const tenantDoc = await db.collection("tenants").doc(expectedTenantId).get();
    expect(tenantDoc.exists).toBe(true);
    const tenantData = tenantDoc.data()!;
    expect(tenantData["name"]).toBe(testCompanyName);
  });

  // REG-03: Dashboard access
  test("REG-03: new tenant lands on '/' after registration (free-plan redirect)", async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);
    const timestamp = Date.now();
    const testEmail = `reg-test-${timestamp}@gmail.com`;
    const testPassword = "TestReg1234!";
    const testName = `Teste Dashboard ${timestamp}`;
    const testCompanyName = `Empresa Dashboard ${timestamp}`;

    await registerPage.goto();
    await registerPage.isLoaded();

    await registerPage.fillStep1({ name: testName, email: testEmail, password: testPassword });
    await registerPage.fillStep2({ companyName: testCompanyName });
    await registerPage.submitStep3();

    // Wait for the home redirect — proves auth flow completed and free-plan redirect happened
    await registerPage.waitForHomeRedirect();

    // Free-plan users are redirected to '/' (handleRedirectAfterAuth role check in useLoginForm)
    expect(page.url()).toMatch(/\/$/);

    // The page should not be the login or register page — user is authenticated
    expect(page.url()).not.toContain("/login");
    expect(page.url()).not.toContain("/register");
  });

  // REG-04: On-blur validation for the name field (step 1)
  test("REG-04: name field shows validation error on blur, before submitting", async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.isLoaded();

    // Type a too-short name and leave the field — the error must appear on blur,
    // not only after clicking "Continuar"/"Finalizar".
    await registerPage.nameInput.click();
    await registerPage.nameInput.fill("a");
    await registerPage.nameInput.blur();

    await expect(
      page.getByText("Nome deve ter pelo menos 2 caracteres"),
    ).toBeVisible({ timeout: 5000 });
  });

  // REG-05: On-blur validation for the company name field (step 2)
  test("REG-05: company name field shows validation error on blur, before submitting", async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);
    const timestamp = Date.now();
    await registerPage.goto();
    await registerPage.isLoaded();

    // Advance to step 2 with valid step-1 data (does not submit the form).
    await registerPage.fillStep1({
      name: `Teste Blur ${timestamp}`,
      email: `reg-blur-${timestamp}@gmail.com`,
      password: "TestReg1234!",
    });

    // Type a too-short company name and leave the field.
    await registerPage.companyNameInput.click();
    await registerPage.companyNameInput.fill("x");
    await registerPage.companyNameInput.blur();

    await expect(
      page.getByText("Nome da empresa é obrigatório"),
    ).toBeVisible({ timeout: 5000 });
  });

  // REG-06: On-blur validation for the phone field (step 1)
  test("REG-06: phone field shows validation error on blur, before submitting", async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.isLoaded();

    // Type a too-short phone and leave the field — error must appear on blur.
    await registerPage.phoneInput.click();
    await registerPage.phoneInput.fill("1199");
    await registerPage.phoneInput.blur();

    await expect(page.getByText("Telefone inválido")).toBeVisible({
      timeout: 5000,
    });
  });

  // REG-07: Registered data is visible immediately after signup (no manual F5)
  test("REG-07: registered name and company are visible right after signup, without a manual reload", async ({
    page,
  }) => {
    const registerPage = new RegisterPage(page);
    const timestamp = Date.now();
    const testEmail = `reg-test-${timestamp}@gmail.com`;
    const testPassword = "TestReg1234!";
    const testName = `Visivel ${timestamp}`;
    const testCompanyName = `Empresa Visivel ${timestamp}`;

    await registerPage.goto();
    await registerPage.isLoaded();

    await registerPage.fillStep1({
      name: testName,
      email: testEmail,
      password: testPassword,
      phone: "11987654321",
    });
    await registerPage.fillStep2({ companyName: testCompanyName });
    await registerPage.submitStep3();
    await registerPage.waitForHomeRedirect();

    // Header (app shell) shows the registered company name, not "Minha Empresa".
    await expect(page.getByText(testCompanyName).first()).toBeVisible({
      timeout: 15000,
    });

    // Profile shows the registered name (read from the user doc, not the fallback).
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });
    await expect(page.getByText(testName).first()).toBeVisible({
      timeout: 10000,
    });
  });

  // REG-08: Email already registered → inline error on blur (backend check)
  test("REG-08: an already-registered email shows an inline error on blur, before submitting", async ({
    page,
  }) => {
    // Seed an existing account with a resolvable domain so the backend
    // availability check reaches the "already registered" branch.
    const existingEmail = `dup-${Date.now()}@gmail.com`;
    await signUpWithEmailPassword(existingEmail, "TestReg1234!");

    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.isLoaded();

    // Type the already-registered email and leave the field — the error must
    // surface on blur, before clicking "Finalizar".
    await registerPage.emailInput.click();
    await registerPage.emailInput.fill(existingEmail);
    await registerPage.passwordInput.click(); // blur the email field

    await expect(
      page.getByText("Este email já está cadastrado no sistema."),
    ).toBeVisible({ timeout: 8000 });
  });
});
