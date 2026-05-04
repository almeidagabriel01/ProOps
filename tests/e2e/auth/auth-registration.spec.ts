/**
 * Auth Registration E2E tests — REG-01 through REG-03.
 *
 * REG-01: New user completes the 3-step registration form and submits successfully
 * REG-02: Newly registered tenant has correct Firestore documents (users/{uid}, tenants/{tenantId})
 * REG-03: New tenant lands on '/' after completing registration (free-plan redirect)
 */

import { test, expect } from "../fixtures/auth.fixture";
import { RegisterPage } from "../pages/register.page";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
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

    await registerPage.goto();
    await registerPage.isLoaded();

    await registerPage.fillStep1({ name: testName, email: testEmail, password: testPassword });
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
});
