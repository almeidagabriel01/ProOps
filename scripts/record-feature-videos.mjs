/**
 * Grava 3 vídeos curtos (IA, Financeiro, Proposta+PDF) navegando no app local.
 * Uso: node scripts/record-feature-videos.mjs
 * Saída: scripts/.recordings/feature-{1,2,3}.webm
 *
 * Firebase Auth persiste em IndexedDB (não em cookies), então o login precisa
 * acontecer no MESMO contexto das gravações. Cada página do contexto gera seu
 * próprio vídeo — login roda numa página descartável e cada feature numa página nova.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "lyft@gmail.com";
const PASSWORD = "1234567";
const OUT_DIR = path.resolve("scripts/.recordings");
const SIZE = { width: 1280, height: 800 };

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: OUT_DIR, size: SIZE },
});

async function dismissCookies(page) {
  await page.locator('button:has-text("Entendi")').first().click({ timeout: 3000 }).catch(() => {});
}

async function smoothScroll(page, px, steps = 30) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await page.waitForTimeout(50);
  }
}

// ---- login (página descartável; vídeo dela é deletado) ----
const loginPage = await ctx.newPage();
await loginPage.goto(`${BASE}/login`);
// inputs ficam readonly até receberem foco (anti-autofill)
await loginPage.click("#email");
await loginPage.evaluate(() => document.getElementById("email")?.removeAttribute("readonly"));
await loginPage.locator("#email").pressSequentially(EMAIL, { delay: 20 });
await loginPage.click("#password");
await loginPage.evaluate(() => document.getElementById("password")?.removeAttribute("readonly"));
await loginPage.locator("#password").pressSequentially(PASSWORD, { delay: 20 });
await loginPage.click('button[type="submit"]');
await loginPage.waitForURL(/dashboard/, { timeout: 30000 });
await loginPage.waitForTimeout(2000);
await dismissCookies(loginPage);
// warm-up: visita as rotas antes de gravar para evitar telas de loading
// (compile sob demanda do dev server + cache de dados)
for (const route of ["/dashboard", "/transactions", "/proposals"]) {
  await loginPage.goto(`${BASE}${route}`);
  await loginPage.waitForLoadState("networkidle").catch(() => {});
  await loginPage.waitForTimeout(3000);
}
const warmHref = await loginPage
  .goto(`${BASE}/proposals`)
  .then(() => loginPage.locator('a[href*="/view"]').first().getAttribute("href"))
  .catch(() => null);
if (warmHref) {
  await loginPage.goto(`${BASE}${warmHref}`);
  await loginPage.waitForLoadState("networkidle").catch(() => {});
  await loginPage.waitForTimeout(3000);
}
const loginVideo = loginPage.video();
await loginPage.close();

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

async function record(name, run) {
  if (ONLY && !ONLY.includes(name)) return;
  const page = await ctx.newPage();
  try {
    await run(page);
  } finally {
    const video = page.video();
    await page.close();
    if (video) {
      const src = await video.path();
      const dest = path.join(OUT_DIR, `${name}.webm`);
      fs.rmSync(dest, { force: true });
      fs.renameSync(src, dest);
      console.log(`gravado: ${dest}`);
    }
  }
}

// 1 — IA / Lia
await record("feature-1", async (page) => {
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissCookies(page);
  await page.locator('[aria-label="Abrir Lia"]').waitFor({ timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.click('[aria-label="Abrir Lia"]');
  await page.waitForTimeout(1200);
  const input = page.locator('[aria-label="Mensagem para Lia"]').first();
  await input.click();
  await input.pressSequentially("Qual foi meu faturamento este mês?", { delay: 45 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);
});

// 2 — Financeiro
await record("feature-2", async (page) => {
  await page.goto(`${BASE}/transactions`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissCookies(page);
  await page.waitForTimeout(2500);
  await smoothScroll(page, 500);
  await page.waitForTimeout(1000);
  await smoothScroll(page, -500);
  await page.waitForTimeout(1200);
});

// 3 — Proposta + PDF
await record("feature-3", async (page) => {
  await page.goto(`${BASE}/proposals`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissCookies(page);
  await page.waitForTimeout(2500);
  // o link de view fica oculto num menu — navega direto pelo href
  const href = await page
    .locator('a[href*="/view"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (href) {
    await page.goto(`${BASE}${href}`);
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);
  await smoothScroll(page, 600);
  await page.waitForTimeout(1500);
});

await ctx.close();
// descarta o vídeo do login (contém credenciais sendo digitadas)
if (loginVideo) {
  const p = await loginVideo.path().catch(() => null);
  if (p) fs.rmSync(p, { force: true });
}
await browser.close();
console.log("ok");
