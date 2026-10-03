/**
 * CAL-LAYOUT: grade do mês, lista de próximos compromissos e navegação.
 *
 * Três defeitos da tela de calendário no desktop (xl+, altura fixa):
 *
 * 1. Com `dayMaxEvents={3}` e o chip de quatro linhas (título, hora, local e
 *    status), cada semana crescia além da altura disponível e a última saía
 *    cortada. Hoje o mês cabe inteiro e o excedente vira "+ mais".
 * 2. A lista de próximos compromissos tinha `flex-1` dentro de um wrapper que
 *    não era flex: crescia até o fim do conteúdo, o `overflow-y-auto` nunca
 *    disparava e o Card cortava o resto sem deixar rolar.
 * 3. As setas ficavam coladas ao "Hoje", longe do título do mês, e pareciam
 *    trocar o dia. Hoje elas cercam o título e dizem o que pulam.
 *
 * Os compromissos são servidos por `page.route`: o teste mede layout, e um
 * dia com quatro eventos em todas as semanas é o pior caso que a grade
 * precisa aguentar.
 */

import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/auth.fixture";

// Dia par com um compromisso, dia ímpar com quatro: o primeiro tem que
// aparecer na grade em qualquer altura, o segundo vira "+ mais".
const BUSY_HOURS = [8, 10, 14, 16];
const QUIET_HOURS = [8];

function buildEvents() {
  const today = new Date();
  const events = [];
  for (let offset = -14; offset <= 42; offset += 1) {
    const hours = Math.abs(offset) % 2 === 0 ? QUIET_HOURS : BUSY_HOURS;
    for (const hour of hours) {
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + offset,
        hour,
      );
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const id = `cal-layout-${offset}-${hour}`;
      events.push({
        id,
        tenantId: "tenant-alpha",
        ownerUserId: "owner",
        createdByUserId: "owner",
        updatedByUserId: "owner",
        title: `Visita técnica ${offset}-${hour}`,
        description: null,
        location: "Showroom",
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
  await expect(page.locator(".fc-dayGridMonth-view")).toBeVisible({
    timeout: 20000,
  });
  // O FullCalendar renderiza os eventos que não cabem no dia escondidos (para
  // medir), então o primeiro do DOM pode ser um desses.
  await expect(page.locator(".fc-daygrid-event:visible").first()).toBeVisible({
    timeout: 20000,
  });
}

/** Rola a grade até o fim e mede o scroller e a última semana. */
async function measureMonthGrid(page: Page) {
  return page.evaluate(() => {
    const scroller = document
      .querySelector<HTMLElement>(".fc-dayGridMonth-view .fc-daygrid-body")
      ?.closest<HTMLElement>(".fc-scroller");
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(".fc-daygrid-body tbody > tr"),
    );
    if (!scroller || rows.length === 0) return null;
    scroller.scrollTop = scroller.scrollHeight;
    const box = scroller.getBoundingClientRect();
    const last = rows[rows.length - 1].getBoundingClientRect();
    return {
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      scrollerTop: box.top,
      scrollerBottom: box.bottom,
      lastRowTop: last.top,
      lastRowBottom: last.bottom,
      rowCount: rows.length,
    };
  });
}

// 1600x900: a grade cabe inteira, sem rolagem nenhuma. 1280x720 é a tela
// baixa: o cabeçalho quebra em três linhas e sobra pouco para seis semanas;
// ali a grade pode rolar, mas o dia com um compromisso ainda o mostra e a
// última semana chega inteira ao fim da rolagem.
for (const { viewport, mustFit } of [
  { viewport: { width: 1600, height: 900 }, mustFit: true },
  { viewport: { width: 1280, height: 720 }, mustFit: false },
]) {
  test.describe(`CAL-LAYOUT @ ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("a grade do mês não corta a última semana", async ({
      authenticatedPage: page,
    }) => {
      await openCalendar(page);

      const metrics = await measureMonthGrid(page);
      expect(metrics).not.toBeNull();
      expect(metrics!.rowCount).toBeGreaterThanOrEqual(4);
      if (mustFit) {
        expect(metrics!.scrollHeight).toBeLessThanOrEqual(
          metrics!.clientHeight + 1,
        );
      }
      expect(metrics!.lastRowTop).toBeGreaterThanOrEqual(
        metrics!.scrollerTop - 1,
      );
      expect(metrics!.lastRowBottom).toBeLessThanOrEqual(
        metrics!.scrollerBottom + 1,
      );
      // Quatro compromissos no dia não cabem: o excedente vira "+ mais".
      await expect(page.locator(".fc-daygrid-more-link").first()).toBeVisible();
    });

    test("a lista de próximos compromissos rola", async ({
      authenticatedPage: page,
    }) => {
      await openCalendar(page);

      const list = page
        .locator("section", { hasText: "Proximos compromissos" })
        .locator(".calendar-panel-scrollbar");
      await expect(list.locator("button").first()).toBeVisible();

      const metrics = await list.evaluate((el) => {
        const aside = el.closest("aside")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        el.scrollTop = el.scrollHeight;
        return {
          overflows: el.scrollHeight > el.clientHeight,
          scrollTop: el.scrollTop,
          listBottom: box.bottom,
          asideBottom: aside.bottom,
        };
      });

      expect(metrics.overflows).toBe(true);
      expect(metrics.scrollTop).toBeGreaterThan(0);
      expect(metrics.listBottom).toBeLessThanOrEqual(metrics.asideBottom + 1);
    });
  });
}

test.describe("CAL-NAV: setas junto do título do período", () => {
  test("as setas dizem o que pulam e o Hoje só acende fora do período atual", async ({
    authenticatedPage: page,
  }) => {
    await openCalendar(page);

    const today = page.getByRole("button", { name: "Hoje", exact: true });
    const next = page.getByRole("button", { name: "Próximo mês" });
    const prev = page.getByRole("button", { name: "Mês anterior" });

    await expect(prev).toBeVisible();
    await expect(next).toBeVisible();
    await expect(today).toBeDisabled();

    const title = page.locator("span[aria-live='polite']");
    const before = (await title.textContent())?.trim();
    await next.click();
    await expect(title).not.toHaveText(before ?? "");
    await expect(today).toBeEnabled();

    await today.click();
    await expect(title).toHaveText(before ?? "");
    await expect(today).toBeDisabled();

    await page.getByRole("tab", { name: "Semana" }).click();
    await expect(
      page.getByRole("button", { name: "Próxima semana" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Dia" }).click();
    await expect(page.getByRole("button", { name: "Próximo dia" })).toBeVisible();
  });
});
