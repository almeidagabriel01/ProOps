/**
 * core-pdf.service.ts
 *
 * Serviço base de renderização PDF via Playwright.
 * Centraliza toda a lógica de browser lifecycle, headers, SSRF defence e
 * readiness-wait. Os serviços específicos (proposal, transaction) delegam
 * aqui e apenas fornecem a URL e o seletor de marcador de "pronto".
 *
 * SEGURANÇA (SSRF):
 *   A mitigação foca em bloquear IPs privados/internos e endpoints de metadados
 *   de provedores de cloud (AWS IMDSv1, Azure IMDS, GCP metadata) — que são o
 *   vetor real de SSRF. Isso é feito bloqueando requisições a:
 *     - Faixas de IP de loopback (127.x, ::1)
 *     - Faixas de IP privadas (10.x, 172.16-31.x, 192.168.x)
 *     - Link-local (169.254.x.x) — inclui AWS IMDSv1
 *     - Unique local IPv6 (fc00::/7)
 *   URLs com HTTPS para domínios públicos (incluindo o backend API do app) são
 *   permitidas normalmente — necessário para que a página renderizada consiga
 *   buscar seus dados.
 */

import { chromium } from "playwright-core";
import chromiumPackage from "@sparticuz/chromium";
import { resolveFrontendAppOrigin } from "../../lib/frontend-app-url";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
export const PDF_VIEWPORT_WIDTH = 1280;
export const PDF_VIEWPORT_HEIGHT = 1700;
export const PDF_PAGE_READY_TIMEOUT_MS = 45_000;
export const PDF_RENDER_ASSET_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Constantes de proteção SSRF
// ---------------------------------------------------------------------------

/**
 * Prefixos de hostname/IP que nunca devem ser acessados pelo Playwright.
 * Cobre loopback, private ranges RFC-1918, link-local (AWS IMDSv1) e
 * endereços de metadados de cloud conhecidos.
 */
const BLOCKED_IP_PATTERNS: RegExp[] = [
  // Loopback
  /^localhost$/i,
  /^127\./,
  /^\[?::1\]?$/,
  // Private RFC-1918
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  // Link-local / AWS IMDSv1 / Azure IMDS / GCP metadata
  /^169\.254\./,
  /^\[?fe80:/i,
  // Unique-local IPv6
  /^\[?f[cd][0-9a-f]{2}:/i,
  // Cloud metadata hostnames conhecidos
  /^metadata\.google\.internal$/i,
];

/**
 * Retorna true quando o request deve ser bloqueado por ser SSRF.
 * Apenas bloqueia protocolos que não sejam http/https, ou hostnames/IPs internos.
 * URLs https para domínios públicos são sempre permitidas.
 */
function isSsrfBlockedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // URL malformada — bloquear por segurança.
    return true;
  }

  // Apenas protocolos seguros são permitidos.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true;
  }

  // Credenciais embutidas na URL são suspeitas.
  if (parsed.username || parsed.password) {
    return true;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // remove brackets IPv6

  // Verificar contra padrões de IP/hostname bloqueados.
  return BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------
export interface RenderPdfOptions {
  /** URL completa (já incluindo query strings necessárias como ?print=1). */
  url: string;
  /**
   * Seletor CSS ou atributo data-* que identifica quando a página está
   * completamente pronta para impressão.
   * Exemplo: '[data-pdf-products-ready="1"]'
   */
  readySelector: string;
  /**
   * Origem do app (proto+host) usada para contexto de logging.
   */
  appOrigin: string;
  /**
   * Secret para bypassar Vercel Preview Protection no ambiente correto.
   */
  vercelBypassSecret?: string;
}

// ---------------------------------------------------------------------------
// Função principal de renderização
// ---------------------------------------------------------------------------
/**
 * Abre o Playwright, navega até `url`, aguarda o `readySelector` e retorna
 * o Buffer do PDF gerado.
 *
 * Toda lógica de browser é encapsulada aqui; os serviços específicos (proposal
 * e transaction) apenas chamam esta função.
 */
export async function renderPageToPdfBuffer(options: RenderPdfOptions): Promise<Buffer> {
  const { url, readySelector, vercelBypassSecret } = options;

  chromiumPackage.setGraphicsMode = false;
  const executablePath = await chromiumPackage.executablePath();
  const pageErrors: string[] = [];

  const browser = await chromium.launch({
    executablePath,
    args: chromiumPackage.args,
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: PDF_VIEWPORT_WIDTH, height: PDF_VIEWPORT_HEIGHT },
    });

    // ---------------------------------------------------------------------------
    // SSRF Defence: bloquear requisições para IPs privados/internos e
    // endpoints de metadados de cloud. URLs HTTPS públicas são permitidas.
    // ---------------------------------------------------------------------------
    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (isSsrfBlockedUrl(requestUrl)) {
        console.warn(`[core-pdf] Blocked SSRF-risk request: ${requestUrl}`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    const page = await context.newPage();

    // Headers de autenticação interna para o render.
    const extraHeaders: Record<string, string> = {
      "x-pdf-generator": "true",
    };
    if (vercelBypassSecret) {
      extraHeaders["x-vercel-protection-bypass"] = vercelBypassSecret;
    }
    await page.setExtraHTTPHeaders(extraHeaders);

    page.on("pageerror", (error) => {
      pageErrors.push(error?.message || "unknown_page_error");
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "request_failed";
      pageErrors.push(`${request.method()} ${request.url()} :: ${failure}`);
    });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    // Aguardar marcador de pronto + imagens.
    await page.waitForFunction(
      async (selector: string) => {
        try {
          await document.fonts.ready;
        } catch {
          // Ignorar falhas de carregamento de fontes.
        }

        const marker = document.querySelector(selector);
        if (!marker) return false;

        const imageWaiters = Array.from(document.images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            }),
        );
        await Promise.all(imageWaiters);
        return true;
      },
      readySelector,
      { timeout: PDF_RENDER_ASSET_TIMEOUT_MS },
    );

    // Pequena pausa para garantir animações CSS.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics = pageErrors.slice(0, 8).join(" || ") || "UNAVAILABLE";
    throw new Error(`PDF_RENDER_FAILED: ${message} | pageErrors=${diagnostics}`);
  } finally {
    await browser.close();
  }
}

/**
 * Utilitário para resolver a URL base do app a partir das variáveis de ambiente.
 * Centralizado aqui para evitar duplicação entre os serviços.
 */
export function resolveAppBaseUrl(): string {
  return resolveFrontendAppOrigin();
}
