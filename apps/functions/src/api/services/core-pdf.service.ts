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
/**
 * Loopback so e liberado DENTRO do emulador.
 *
 * Em desenvolvimento o proprio app e `http://localhost:3000`, entao a guarda de
 * SSRF barrava a pagina que o render precisa abrir: nenhum PDF era gerado
 * localmente, e por tabela a entrega da proposta no Drive nunca podia ser
 * testada fora da nuvem.
 *
 * `FUNCTIONS_EMULATOR` e posta pelo emulador do Firebase e **nunca** existe em
 * Cloud Run, entao producao segue com a regra inalterada: loopback e faixas
 * privadas continuam bloqueadas. A relaxacao vale so para o alvo de loopback;
 * metadados de cloud e faixas RFC-1918 permanecem barrados mesmo no emulador,
 * porque ali o risco nao e "e a minha propria maquina", e sim credencial de
 * instancia.
 */
function loopbackLiberado(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

const LOOPBACK_PATTERNS: RegExp[] = [/^localhost$/i, /^127\./, /^\[?::1\]?$/];

export function isSsrfBlockedUrl(url: string): boolean {
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

  const ehLoopback = LOOPBACK_PATTERNS.some((pattern) => pattern.test(hostname));
  if (ehLoopback) {
    return !loopbackLiberado();
  }

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
/**
 * O binario empacotado do `@sparticuz/chromium` e Linux-only.
 *
 * Isolado para ser testavel: trocar esta condicao por engano faria producao
 * procurar um navegador que nao existe na imagem do Cloud Run, e o sintoma
 * (PDF que nao gera) so apareceria depois do deploy.
 */
export function useServerlessChromium(
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "linux";
}

export async function renderPageToPdfBuffer(options: RenderPdfOptions): Promise<Buffer> {
  const { url, readySelector, vercelBypassSecret } = options;

  // Lazy-load to keep module initialization fast (avoids 10s timeout during Firebase spec detection)
  const { chromium } = await import("playwright-core");
  const pageErrors: string[] = [];

  // `@sparticuz/chromium` empacota um binario LINUX. Em Cloud Run e no CI isso
  // e exatamente o certo; numa maquina Windows ou macOS o `executablePath()`
  // aponta para um arquivo que nao existe e o launch morre com
  // `spawn ...\Temp\chromium ENOENT`. Como a entrega no Drive renderiza um PDF,
  // o efeito era a entrega falhar sempre em desenvolvimento — e, ate a fila
  // passar a olhar o desfecho, falhar em silencio.
  //
  // Fora do Linux usamos o Chromium que o proprio Playwright instala. Exige
  // `npx playwright install chromium` uma vez dentro de `apps/functions`,
  // porque a revisao e casada com a versao do `playwright-core` de la.
  const launchOptions = useServerlessChromium()
    ? await (async () => {
        const chromiumPackage = (await import("@sparticuz/chromium")).default;
        chromiumPackage.setGraphicsMode = false;
        return {
          executablePath: await chromiumPackage.executablePath(),
          args: chromiumPackage.args,
          headless: true as const,
        };
      })()
    : { headless: true as const };

  console.time("pdf:launch");
  const browser = await chromium.launch(launchOptions);
  console.timeEnd("pdf:launch");

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
      extraHeaders["x-vercel-set-bypass-cookie"] = "samesitenone";
    }
    await page.setExtraHTTPHeaders(extraHeaders);

    console.log("[core-pdf] Headers configurados", {
      hasVercelBypass: Boolean(vercelBypassSecret),
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error?.message || "unknown_page_error");
    });

    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "request_failed";
      pageErrors.push(`${request.method()} ${request.url()} :: ${failure}`);
    });

    console.time("pdf:goto");
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });
    console.timeEnd("pdf:goto");

    // Aguardar marcador de pronto + imagens.
    console.time("pdf:ready");
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
    console.timeEnd("pdf:ready");

    // Pausa para layout/paint completarem após React commit.
    // 1000ms é necessário: o marker de readiness dispara no mesmo tick que o
    // viewer é montado; 150ms não é suficiente para layout + paint de grids complexos.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.emulateMedia({ media: "print" });

    // Guard pré-PDF: verifica que a página ainda está em estado de sucesso.
    // Sem este guard, se o fetch in-page falhar após o waitForFunction passar,
    // page.pdf() captura a UI de erro e o buffer é salvo no cache como PDF válido.
    const ERROR_PHRASES = [
      "erro ao carregar",
      "algo deu errado",
      "link inválido",
      "link expirado",
      "não foi possível",
      "não encontrada",
      "não encontrado",
    ];
    const prePdfState = await page.evaluate(
      (args: { selector: string; errorPhrases: string[] }) => {
        const bodyText = (document.body.innerText || "").toLowerCase();
        return {
          markerPresent: !!document.querySelector(args.selector),
          errorTextPresent: args.errorPhrases.some((p) => bodyText.includes(p)),
          bodyTextPreview: bodyText.slice(0, 200),
          bodyH: document.body.offsetHeight,
          htmlLen: document.documentElement.outerHTML.length,
        };
      },
      { selector: readySelector, errorPhrases: ERROR_PHRASES },
    );

    console.log("[core-pdf] pre-pdf state", prePdfState);

    if (!prePdfState.markerPresent || prePdfState.errorTextPresent) {
      throw new Error(
        `PDF_RENDER_ERROR_STATE: marker=${prePdfState.markerPresent} errorText=${prePdfState.errorTextPresent} preview="${prePdfState.bodyTextPreview.slice(0, 100)}"`,
      );
    }

    console.time("pdf:generate");
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
    console.timeEnd("pdf:generate");

    if (pageErrors.length > 0) {
      console.warn("[core-pdf] Render concluiu mas com pageErrors", {
        pageErrors: pageErrors.slice(0, 8),
      });
    }
    console.log("[core-pdf] PDF renderizado", { bufferSize: pdf.length });

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
