/**
 * Guarda de SSRF do renderizador de PDF.
 *
 * O Playwright abre uma pagina e ela pode pedir qualquer URL. Sem esta guarda,
 * uma URL controlada por dado do tenant alcançaria o endpoint de metadados da
 * instancia e devolveria credencial de servico dentro de um PDF.
 *
 * Loopback tem uma excecao ESTREITA: em desenvolvimento o proprio app e
 * `http://localhost:3000`, entao a guarda barrava a pagina que o render precisa
 * abrir, e nenhum PDF era gerado localmente — por tabela, a entrega da proposta
 * no Google Drive so podia ser testada contra a nuvem.
 *
 * A liberacao vale SO com `FUNCTIONS_EMULATOR`, que o emulador do Firebase põe
 * e o Cloud Run nunca tem. Faixas privadas e metadados de cloud continuam
 * bloqueados mesmo no emulador: ali o risco nao e "e a minha propria maquina",
 * e sim credencial de instancia.
 */

import { isSsrfBlockedUrl } from "./core-pdf.service";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function semEmulador() {
  delete process.env.FUNCTIONS_EMULATOR;
}

function comEmulador() {
  process.env.FUNCTIONS_EMULATOR = "true";
}

describe("alvos sempre bloqueados", () => {
  it.each([
    ["metadados do GCP", "http://metadata.google.internal/computeMetadata/v1/"],
    ["link-local (IMDS)", "http://169.254.169.254/latest/meta-data/"],
    ["RFC-1918 10.x", "http://10.0.0.5/admin"],
    ["RFC-1918 172.16.x", "http://172.16.0.1/"],
    ["RFC-1918 192.168.x", "http://192.168.1.1/"],
    ["IPv6 link-local", "http://[fe80::1]/"],
    ["IPv6 unique-local", "http://[fd00::1]/"],
  ])("%s continua bloqueado FORA do emulador", (_nome, url) => {
    semEmulador();
    expect(isSsrfBlockedUrl(url)).toBe(true);
  });

  it.each([
    ["metadados do GCP", "http://metadata.google.internal/computeMetadata/v1/"],
    ["link-local (IMDS)", "http://169.254.169.254/latest/meta-data/"],
    ["RFC-1918 10.x", "http://10.0.0.5/admin"],
    ["RFC-1918 192.168.x", "http://192.168.1.1/"],
  ])("%s continua bloqueado DENTRO do emulador", (_nome, url) => {
    comEmulador();
    expect(isSsrfBlockedUrl(url)).toBe(true);
  });

  it("protocolo que nao seja http(s) e bloqueado", () => {
    comEmulador();
    expect(isSsrfBlockedUrl("file:///etc/passwd")).toBe(true);
    expect(isSsrfBlockedUrl("gopher://x/")).toBe(true);
  });

  it("credencial embutida na URL e bloqueada", () => {
    comEmulador();
    expect(isSsrfBlockedUrl("http://user:senha@exemplo.com/")).toBe(true);
  });

  it("URL malformada e bloqueada", () => {
    comEmulador();
    expect(isSsrfBlockedUrl("nao-e-url")).toBe(true);
  });
});

describe("loopback", () => {
  it.each([
    "http://localhost:3000/share/abc?print=1",
    "http://127.0.0.1:3000/share/abc",
    "http://[::1]:3000/share/abc",
  ])("%s e BLOQUEADO em producao", (url) => {
    semEmulador();
    expect(isSsrfBlockedUrl(url)).toBe(true);
  });

  it.each([
    "http://localhost:3000/share/abc?print=1",
    "http://127.0.0.1:3000/share/abc",
    "http://[::1]:3000/share/abc",
  ])("%s e liberado dentro do emulador", (url) => {
    comEmulador();
    expect(isSsrfBlockedUrl(url)).toBe(false);
  });

  // A variavel só vale com o valor exato que o emulador escreve; qualquer
  // outra coisa mantém o bloqueio.
  it("valor diferente de 'true' nao libera nada", () => {
    process.env.FUNCTIONS_EMULATOR = "1";
    expect(isSsrfBlockedUrl("http://localhost:3000/x")).toBe(true);
    process.env.FUNCTIONS_EMULATOR = "false";
    expect(isSsrfBlockedUrl("http://localhost:3000/x")).toBe(true);
  });
});

describe("destinos publicos", () => {
  it.each([
    "https://proops.com.br/share/abc",
    "https://southamerica-east1-erp-softcode.cloudfunctions.net/api/health",
    "https://fonts.gstatic.com/s/font.woff2",
  ])("%s e permitido", (url) => {
    semEmulador();
    expect(isSsrfBlockedUrl(url)).toBe(false);
  });
});
