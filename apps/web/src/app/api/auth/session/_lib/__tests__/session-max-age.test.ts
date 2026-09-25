import { describe, it, expect } from "vitest";
import {
  DEFAULT_SESSION_MAX_AGE_SECONDS,
  MAX_SESSION_MAX_AGE_SECONDS,
  MIN_SESSION_MAX_AGE_SECONDS,
  resolveSessionMaxAgeSeconds,
} from "../session-max-age";

describe("resolveSessionMaxAgeSeconds", () => {
  // Regressão: com a variável ausente, `Number("")` virava 0 e o clamp
  // entregava 10 minutos. Era o caso de produção.
  it("usa 5 dias quando a variável não existe", () => {
    expect(resolveSessionMaxAgeSeconds(undefined)).toBe(DEFAULT_SESSION_MAX_AGE_SECONDS);
    expect(DEFAULT_SESSION_MAX_AGE_SECONDS).toBe(432_000);
  });

  it("usa 5 dias quando a variável está vazia ou só com espaços", () => {
    expect(resolveSessionMaxAgeSeconds("")).toBe(DEFAULT_SESSION_MAX_AGE_SECONDS);
    expect(resolveSessionMaxAgeSeconds("   ")).toBe(DEFAULT_SESSION_MAX_AGE_SECONDS);
  });

  it("usa 5 dias quando o valor não é numérico", () => {
    expect(resolveSessionMaxAgeSeconds("abc")).toBe(DEFAULT_SESSION_MAX_AGE_SECONDS);
  });

  it("respeita um valor configurado dentro dos limites", () => {
    expect(resolveSessionMaxAgeSeconds("3600")).toBe(3600);
    expect(resolveSessionMaxAgeSeconds(" 86400 ")).toBe(86400);
  });

  it("aplica o piso de 10 minutos a um valor explícito pequeno", () => {
    expect(resolveSessionMaxAgeSeconds("0")).toBe(MIN_SESSION_MAX_AGE_SECONDS);
    expect(resolveSessionMaxAgeSeconds("60")).toBe(MIN_SESSION_MAX_AGE_SECONDS);
  });

  it("aplica o teto de 14 dias do Firebase", () => {
    expect(resolveSessionMaxAgeSeconds("999999999")).toBe(MAX_SESSION_MAX_AGE_SECONDS);
  });
});
