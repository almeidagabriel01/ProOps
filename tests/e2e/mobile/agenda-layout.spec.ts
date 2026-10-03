import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth.fixture";

/**
 * MOBILE-09 — a Agenda no celular.
 *
 * O `calendar-layout.spec.ts` só mede o desktop. No celular cada dia do mês
 * tem ~40px, e o chip do evento (horário + título) transbordava para o dia
 * vizinho: era a "informação por cima de outra" relatada. O no-overflow não
 * vê isso, porque o Card da agenda tem `overflow-hidden` e corta em silêncio.
 *
 * O contrato: a agenda abre em Lista; no Mês cada evento é um ponto DENTRO da
 * célula do próprio dia; tocar num dia abre a visão Dia.
 *
 * Os compromissos são servidos por `page.route`, como no spec do desktop.
 */

function buildEvents() {
  const today = new Date();
  const events = [];
  for (let offset = -10; offset <= 20; offset += 1) {
    const hours = offset % 3 === 0 ? [8, 10, 14, 16] : [9];
    for (const hour of hours) {
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + offset,
        hour,
      );
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      events.push({
        id: `agenda-mobile-${offset}-${hour}`,
        tenantId: "tenant-alpha",
        ownerUserId: "owner",
        createdByUserId: "owner",
        updatedByUserId: "owner",
        title: `Instalação com nome comprido ${offset}-${hour}`,
        description: null,
        location: "Rua das Laranjeiras, 1500",
        status: "scheduled",
        color: "#2563eb",
        isAllDay: false,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        startDate: null,
        endDate: null,
        startMs: start.getTime(),
        endMs: end.getTime(),
        googleSync: { enabled: false, provider: "google", status: "disabled" },
        createdAt: start.toISOString(),
        updatedAt: start.toISOString(),
      });
    }
  }
  return events;
}

async function openCalendar(page: Page) {
  const events = buildEvents();
  await page.route("**/api/backend/v1/calendar/events?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, events }),
    }),
  );
  await page.goto("/calendar");
}

test("agenda no celular abre em lista, mês em pontos e o dia abre ao toque", async ({
  authenticatedPage: page,
}) => {
  test.setTimeout(90000);
  await openCalendar(page);

  await expect(page.locator(".fc-listWeek-view")).toBeVisible({
    timeout: 20000,
  });

  // A Lista cabe no card: com o título em `nowrap` a tabela alargava além
  // dele, e título e data saíam cortados pela direita.
  const listOverflow = await page.locator(".fc-list").evaluate((el) => {
    const table = el.querySelector("table")!;
    return table.getBoundingClientRect().right - el.getBoundingClientRect().right;
  });
  expect(listOverflow).toBeLessThanOrEqual(1);

  // As setas do período ficam logo acima dos compromissos, na primeira tela.
  // Antes elas estavam no meio de um cabeçalho de cinco blocos e sumiam assim
  // que a pessoa rolava até a lista.
  const navigation = page.getByTestId("calendar-mobile-navigation");
  await expect(
    navigation.getByRole("button", { name: "Próxima semana" }),
  ).toBeVisible();
  const viewportHeight = page.viewportSize()!.height;
  expect((await navigation.boundingBox())!.y).toBeLessThan(viewportHeight);

  // Rolando pela lista, a barra gruda no topo do <main>.
  const stuck = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main#main-content")!;
    const bar = document.querySelector<HTMLElement>(
      '[data-testid="calendar-mobile-navigation"]',
    )!;
    const mainTop = main.getBoundingClientRect().top;
    main.scrollTop += bar.getBoundingClientRect().top - mainTop + 150;
    return { mainTop, barTop: bar.getBoundingClientRect().top };
  });
  expect(stuck.barTop).toBeGreaterThanOrEqual(stuck.mainTop - 1);
  expect(stuck.barTop).toBeLessThanOrEqual(stuck.mainTop + 1);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>("main#main-content")!.scrollTop = 0;
  });

  // Busca, fim de semana e situação moram na janela de filtros, e a chave
  // "Fim de semana" não encosta no texto.
  await page.getByRole("button", { name: "Filtros" }).click();
  const dialog = page.getByRole("dialog", { name: "Filtros da agenda" });
  await expect(dialog).toBeVisible();
  const weekendGap = await page
    .getByTestId("calendar-weekend-toggle-mobile")
    .evaluate((el) => {
      const label = el.querySelector("span")!.getBoundingClientRect();
      const toggle = el.querySelector("button")!.getBoundingClientRect();
      return toggle.left - label.right;
    });
  expect(weekendGap).toBeGreaterThanOrEqual(8);
  await dialog.getByRole("button", { name: "Agendado" }).click();
  await dialog.getByRole("button", { name: "Ver compromissos" }).click();
  await expect(dialog).toBeHidden();
  // Um filtro desligado aparece no botão.
  await expect(page.getByRole("button", { name: "Filtros 1" })).toBeVisible();
  await page.getByRole("button", { name: "Filtros 1" }).click();
  await page
    .getByRole("dialog", { name: "Filtros da agenda" })
    .getByRole("button", { name: "Agendado" })
    .click();
  await page.getByRole("button", { name: "Ver compromissos" }).click();

  await page.getByRole("tab", { name: "Mes" }).click();
  await expect(page.locator(".fc-dayGridMonth-view")).toBeVisible();
  await expect(page.locator(".calendar-event-mark--dot").first()).toBeVisible({
    timeout: 20000,
  });

  // A grade do mês cabe na largura da tela. O card corta o que passa, então
  // o no-overflow não enxerga uma grade larga demais.
  const gridRight = await page
    .locator(".fc-dayGridMonth-view")
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(gridRight).toBeLessThanOrEqual(page.viewportSize()!.width);

  // O "+N" do dia cheio cabe na célula (o "mais +1" não cabia).
  const moreLinks = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(".fc-daygrid-more-link"),
    ).map((link) => ({
      text: link.textContent?.trim(),
      fits: link.scrollWidth <= link.clientWidth + 1,
    })),
  );
  expect(moreLinks.length).toBeGreaterThan(0);
  for (const link of moreLinks) {
    expect(link.text).toMatch(/^\+\d+$/);
    expect(link.fits).toBe(true);
  }

  // Nenhuma marca de evento sai da célula do próprio dia.
  const escaped = await page.evaluate(() => {
    const out: string[] = [];
    for (const mark of Array.from(
      document.querySelectorAll<HTMLElement>(".calendar-event-mark--dot"),
    )) {
      const box = mark.getBoundingClientRect();
      if (box.width === 0) continue; // escondido no "+ mais"
      const cell = mark.closest<HTMLElement>("td.fc-daygrid-day");
      if (!cell) continue;
      const area = cell.getBoundingClientRect();
      if (box.left < area.left - 1 || box.right > area.right + 1) {
        out.push(cell.dataset.date ?? "?");
      }
    }
    return out;
  });
  expect(escaped, `marcas fora do dia: ${escaped.join(", ")}`).toEqual([]);

  // O chip de texto não aparece no mês do celular.
  await expect(page.locator(".calendar-event-chip--compact")).toHaveCount(0);

  // Tocar num dia abre a visão Dia.
  await page.locator("td.fc-daygrid-day.fc-day-today .fc-daygrid-day-frame").click({
    position: { x: 4, y: 4 },
  });
  await expect(page.locator(".fc-timeGridDay-view")).toBeVisible();
});
