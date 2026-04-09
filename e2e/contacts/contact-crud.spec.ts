import { test, expect } from "../fixtures/auth.fixture";
import { ContactsPage } from "../pages/contacts.page";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("Contacts CRUD", () => {
  /**
   * CONT-01: Creates a contact through the full 3-step UI wizard.
   * Verifies the new contact link appears in the /contacts list after creation.
   */
  test("CONT-01: creates a contact via the UI form", async ({ authenticatedPage }) => {
    const contactsPage = new ContactsPage(authenticatedPage);
    const timestamp = Date.now();
    const contactName = `Contato Teste ${timestamp}`;

    await contactsPage.goto();
    await contactsPage.isLoaded();

    await contactsPage.createContact({ name: contactName, phone: "(11) 99999-0001" });

    // After creation the form redirects to /contacts — verify the new contact is listed
    await contactsPage.goto();
    await contactsPage.isLoaded();
    const contactLink = contactsPage.getContactByName(contactName);
    await expect(contactLink).toBeVisible({ timeout: 10000 });
  });

  /**
   * CONT-02: Edits an existing contact's name via the UI form.
   * Creates a contact first, then edits it and verifies the updated name appears.
   */
  test("CONT-02: edits a contact via the UI form", async ({ authenticatedPage }) => {
    const contactsPage = new ContactsPage(authenticatedPage);
    const timestamp = Date.now();
    const originalName = `Contato Editar ${timestamp}`;
    const updatedName = `Contato Editado ${timestamp}`;

    // Create the contact to edit
    await contactsPage.goto();
    await contactsPage.isLoaded();
    await contactsPage.createContact({ name: originalName, phone: "(11) 99999-0002" });

    // Navigate back and get the contact's ID from its href
    await contactsPage.goto();
    await contactsPage.isLoaded();

    const contactLink = contactsPage.getContactByName(originalName);
    await expect(contactLink).toBeVisible({ timeout: 10000 });
    const href = await contactLink.getAttribute("href");
    expect(href).toBeTruthy();
    const contactId = href!.split("/contacts/")[1];
    expect(contactId).toBeTruthy();

    // Edit the contact's name
    await contactsPage.editContact(contactId, { name: updatedName });

    // Verify the updated name appears in the list
    await contactsPage.goto();
    await contactsPage.isLoaded();
    const updatedLink = contactsPage.getContactByName(updatedName);
    await expect(updatedLink).toBeVisible({ timeout: 10000 });
  });

  /**
   * CONT-03: Deletes a contact via the UI delete button and confirmation dialog.
   * Creates the contact via the API (POST /api/backend/v1/clients) for speed,
   * then deletes it through the browser UI.
   */
  test("CONT-03: deletes a contact via the UI", async ({ authenticatedPage }) => {
    // Sign in via Auth emulator to get an ID token for the direct API call
    const { idToken } = await signInWithEmailPassword(
      USER_ADMIN_ALPHA.email,
      USER_ADMIN_ALPHA.password,
    );

    const timestamp = Date.now();
    const contactName = `Contato Deletar ${timestamp}`;

    // Create the contact via the backend API to bypass the UI wizard
    const createResponse = await authenticatedPage.request.post("/api/backend/v1/clients", {
      headers: { Authorization: `Bearer ${idToken}` },
      data: {
        name: contactName,
        phone: "(11) 99900-0003",
        types: ["cliente"],
      },
    });
    expect(createResponse.status()).toBe(201);

    // Navigate to /contacts and verify the contact is visible
    const contactsPage = new ContactsPage(authenticatedPage);
    await contactsPage.goto();
    await contactsPage.isLoaded();

    await expect(
      authenticatedPage.getByRole("link", { name: contactName }),
    ).toBeVisible({ timeout: 10000 });

    // Delete through the UI
    await contactsPage.deleteContact(contactName);

    // Verify the contact no longer appears in the list
    await expect(
      authenticatedPage.getByRole("link", { name: contactName }),
    ).not.toBeVisible({ timeout: 10000 });
  });
});
