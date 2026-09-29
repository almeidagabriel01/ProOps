import { test, expect } from "../fixtures/auth.fixture";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_ALPHA } from "../seed/data/users";
import { CONTACT_ALPHA_001 } from "../seed/data/contacts";

/**
 * MOBILE: o atendimento da ordem de serviço no celular, do "cheguei" à
 * assinatura com o dedo. É o caminho que o técnico faz na casa do cliente, e
 * o único lugar do ERP em que alguém desenha na tela: se o quadro rolar a
 * página em vez de desenhar, ou a barra de ações sumir atrás da barra de abas,
 * a OS não fecha.
 */
test("o técnico atende pelo celular e o cliente assina na tela", async ({ authenticatedPage: page, request }) => {
  const { idToken } = await signInWithEmailPassword(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
  const created = await request.post("/api/backend/v1/service-orders", {
    headers: { Authorization: `Bearer ${idToken}` },
    data: {
      clientId: CONTACT_ALPHA_001.id,
      type: "corrective",
      title: "Ar da sala não gela (E2E)",
      checklist: [{ id: "c1", text: "Limpar os filtros", done: false, note: null }],
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  await page.goto(`/service-orders/${id}/executar`);
  await page.getByRole("button", { name: /Cheguei, iniciar atendimento/ }).click();
  await expect(page.getByText(/Etapa 2 de 5/)).toBeVisible();

  await page.getByRole("checkbox", { name: "Limpar os filtros" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /Avançar/ }).click();
  }
  await expect(page.getByText(/Etapa 5 de 5/)).toBeVisible();
  await page.getByRole("textbox", { name: "Relatório do técnico" }).fill("Filtros limpos, equipamento gelando.");

  const finish = page.getByRole("button", { name: /Assinar e concluir/ });
  await expect(finish).toBeInViewport();
  await finish.click();

  const pad = page.getByRole("img", { name: "Área de assinatura" });
  await expect(pad).toBeVisible();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
  await page.mouse.down();
  for (const [x, y] of [
    [0.35, 0.3],
    [0.5, 0.7],
    [0.65, 0.35],
    [0.8, 0.6],
  ]) {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 });
  }
  await page.mouse.up();

  await page.getByRole("button", { name: "Concluir OS" }).click();
  await page.waitForURL(new RegExp(`/service-orders/${id}$`), { timeout: 30_000 });
  await expect(page.getByText("Concluída").first()).toBeVisible();
  await expect(page.getByAltText(`Assinatura de ${CONTACT_ALPHA_001.name}`)).toBeVisible();
});
