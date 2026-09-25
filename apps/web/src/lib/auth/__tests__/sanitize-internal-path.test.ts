import { describe, it, expect } from "vitest";
import { sanitizeInternalPath } from "../sanitize-internal-path";

const FALLBACK = "/dashboard";
const clean = (raw: string | null) => sanitizeInternalPath(raw, FALLBACK);

describe("sanitizeInternalPath", () => {
  it("mantém caminhos internos, com query e hash", () => {
    expect(clean("/proposals")).toBe("/proposals");
    expect(clean("%2Fsettings%2Fteam")).toBe("/settings/team");
    expect(clean("/subscribe?plan=pro#x")).toBe("/subscribe?plan=pro#x");
  });

  it("cai no fallback sem destino", () => {
    expect(clean(null)).toBe(FALLBACK);
    expect(clean("")).toBe(FALLBACK);
  });

  it("recusa URL absoluta, protocolo e caminho sem barra", () => {
    expect(clean("https://evil.com")).toBe(FALLBACK);
    expect(clean("javascript:alert(1)")).toBe(FALLBACK);
    expect(clean("evil.com")).toBe(FALLBACK);
  });

  it("recusa protocolo relativo, literal e codificado", () => {
    expect(clean("//evil.com")).toBe(FALLBACK);
    expect(clean("%2F%2Fevil.com")).toBe(FALLBACK);
  });

  // Regressão: estes passavam na checagem antiga e o navegador os lia como
  // `//evil.com`, levando o usuário para fora do domínio.
  it("recusa barra invertida, literal e codificada", () => {
    expect(clean("/\\evil.com")).toBe(FALLBACK);
    expect(clean("/%5Cevil.com")).toBe(FALLBACK);
    expect(clean("/%5C%5Cevil.com")).toBe(FALLBACK);
  });

  it("recusa TAB e quebra de linha que o parser descarta", () => {
    expect(clean("/%09/evil.com")).toBe(FALLBACK);
    expect(clean("/%0A/evil.com")).toBe(FALLBACK);
    expect(clean("/\t/evil.com")).toBe(FALLBACK);
  });
});
