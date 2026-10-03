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

  // A chave "Fim de semana" não encosta no texto.
  const weekendGap = await page
    .getByTestId("calendar-weekend-toggle")
    .evaluate((el) => {
      const label = el.querySelector("span")!.getBoundingClientRect();
      const toggle = el.querySelector("button")!.getBoundingClientRect();
      return toggle.left - label.right;
    });
  expect(weekendGap).toBeGreaterThanOrEqual(8);

  await page.getByRole("tab", { name: "Mes" }).click();
  await expect(page.locator(".fc-dayGridMonth-view")).toBeVisible();
  await expect(page.locator(".calendar-event-mark--dot").first()).toBeVisible({
    timeout: 20000,
  });

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
