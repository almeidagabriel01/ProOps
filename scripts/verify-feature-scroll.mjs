import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await page.goto(BASE);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(2000);

const sectionTop = await page.evaluate(() => {
  const el = document.querySelector('section[aria-label="Conheça a plataforma ProOps"]');
  return el ? el.getBoundingClientRect().top + window.scrollY : null;
});
console.log("sectionTop:", sectionTop);

// Etapas via scroll
for (const [i, off] of [0, 700, 1340].entries()) {
  await page.evaluate(([t, o]) => window.scrollTo(0, t + o), [sectionTop, off]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `scripts/.recordings/verify-desktop-${i}.png` });
}

// Clique para pular de etapa: volta ao topo da seção e clica no item 2
await page.evaluate((t) => window.scrollTo(0, t), sectionTop);
await page.waitForTimeout(1200);
await page.click('button:has-text("Gestão financeira completa")');
await page.waitForTimeout(2500);
const state = await page.evaluate(() => ({
  scrollY: window.scrollY,
  active: [...document.querySelectorAll("section h3")].findIndex((h) =>
    h.className.includes("opacity-100")
  ),
}));
console.log("after click:", state);
await page.screenshot({ path: "scripts/.recordings/verify-click.png" });

await browser.close();
console.log("ok");
