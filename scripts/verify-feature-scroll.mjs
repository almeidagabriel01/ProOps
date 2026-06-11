import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();

// Desktop: percorre a seção pinada
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(BASE);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(2000);

const sectionTop = await page.evaluate(() => {
  const el = document.querySelector('section[aria-label="Conheça a plataforma ProOps"]');
  return el ? el.getBoundingClientRect().top + window.scrollY : null;
});
console.log("sectionTop:", sectionTop);

const vh = 900;
const stops = [0, 0.85, 1.7]; // progresso ~0, ~0.5, ~1 dentro dos 250vh-100vh de distância
for (let i = 0; i < stops.length; i++) {
  await page.evaluate(([top, off]) => window.scrollTo(0, top + off), [sectionTop, stops[i] * vh]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `scripts/.recordings/verify-desktop-${i}.png` });
}

// Mobile
const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await mob.goto(BASE);
await mob.waitForTimeout(2500);
await mob.evaluate(() => {
  document.querySelector('section[aria-label="Conheça a plataforma ProOps"]')?.scrollIntoView();
});
await mob.waitForTimeout(1500);
await mob.screenshot({ path: "scripts/.recordings/verify-mobile.png" });

// Reduced motion (desktop)
const rm = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
await rm.goto(BASE);
await rm.waitForTimeout(2500);
await rm.evaluate(() => {
  const els = document.querySelectorAll('section[aria-label="Conheça a plataforma ProOps"]');
  els[els.length - 1]?.scrollIntoView();
});
await rm.waitForTimeout(1500);
await rm.screenshot({ path: "scripts/.recordings/verify-reduced.png" });

await browser.close();
console.log("ok");
