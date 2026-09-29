import { defineConfig } from "@playwright/test";

import { URL_WEB } from "./ambiente";

/**
 * As capturas do ERP: prints de verdade das telas, usados nas páginas de
 * funcionalidade e nas landings de nicho. Não é teste; é o jeito reproduzível
 * de refazer as imagens quando uma tela muda.
 *
 *   npx tsx tests/capturas-do-erp/preparar.ts      # emuladores + empresas de exemplo
 *   npm -w proops-web run dev:capturas             # o Next das capturas, na 3005
 *   npx playwright test --config=tests/capturas-do-erp/playwright.config.ts
 *   npx tsx tests/capturas-do-erp/encerrar.ts
 *
 * As imagens saem em `apps/web/public/capturas/`, em WebP.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "capturas.spec.ts",
  timeout: 180_000,
  workers: 1,
  reporter: [["list"]],
  outputDir: "../../test-results/capturas-do-erp",
  use: {
    baseURL: URL_WEB,
    colorScheme: "light",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
});
