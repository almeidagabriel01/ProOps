// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildImpersonationHeaders,
  clearViewingTenantId,
  readImpersonationWriteEnabled,
  writeImpersonationWriteEnabled,
  writeViewingTenantId,
} from "../viewing-tenant-session";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("cabecalhos do Acessar Painel", () => {
  it("fora da impersonacao nao manda nada", () => {
    expect(buildImpersonationHeaders()).toEqual({});
  });

  it("empresa aberta vai sempre em somente leitura", () => {
    writeViewingTenantId("t1");
    expect(buildImpersonationHeaders()).toEqual({ "x-tenant-id": "t1" });
  });

  it("edicao habilitada acrescenta o cabecalho de escrita", () => {
    writeViewingTenantId("t1");
    writeImpersonationWriteEnabled(true);
    expect(buildImpersonationHeaders()).toEqual({
      "x-tenant-id": "t1",
      "x-impersonation-write": "1",
    });
  });

  it("a edicao nao vaza para a proxima empresa aberta", () => {
    writeViewingTenantId("t1");
    writeImpersonationWriteEnabled(true);
    writeViewingTenantId("t2");
    expect(readImpersonationWriteEnabled()).toBe(false);
    expect(buildImpersonationHeaders()).toEqual({ "x-tenant-id": "t2" });
  });

  it("sair da empresa limpa tambem a edicao", () => {
    writeViewingTenantId("t1");
    writeImpersonationWriteEnabled(true);
    clearViewingTenantId();
    writeViewingTenantId("t1");
    expect(readImpersonationWriteEnabled()).toBe(false);
  });

  it("habilitar sem empresa aberta nao tem efeito", () => {
    writeImpersonationWriteEnabled(true);
    expect(readImpersonationWriteEnabled()).toBe(false);
  });
});
