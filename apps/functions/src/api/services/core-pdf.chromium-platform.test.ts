/**
 * Qual Chromium o render usa.
 *
 * `@sparticuz/chromium` empacota um binario LINUX, feito para Cloud Run. Numa
 * maquina Windows ou macOS o `executablePath()` aponta para um arquivo que nao
 * existe e o launch morre com `spawn ...\\Temp\\chromium ENOENT`.
 *
 * Isso nao e cosmetico de ambiente: a entrega da proposta no Google Drive
 * renderiza um PDF, entao em desenvolvimento ela falhava SEMPRE — e, enquanto a
 * fila tratava "nao lancou excecao" como sucesso, falhava em silencio, com o
 * job marcado como entregue e o arquivo nunca chegando na pasta do cliente.
 *
 * Inverter esta condicao por engano faria producao procurar um navegador que
 * nao existe na imagem do Cloud Run, e o sintoma so apareceria depois do
 * deploy, num PDF que nao gera.
 */

import { useServerlessChromium } from "./core-pdf.service";

describe("useServerlessChromium", () => {
  it("Linux usa o binario empacotado — e o caso de Cloud Run e do CI", () => {
    expect(useServerlessChromium("linux")).toBe(true);
  });

  it.each<NodeJS.Platform>(["win32", "darwin"])(
    "%s usa o Chromium do proprio Playwright",
    (platform) => {
      expect(useServerlessChromium(platform)).toBe(false);
    },
  );

  it("le a plataforma do processo por padrao", () => {
    expect(useServerlessChromium()).toBe(process.platform === "linux");
  });
});
