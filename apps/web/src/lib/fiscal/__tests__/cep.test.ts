import { describe, expect, it } from "vitest";
import { maskCep } from "../cep";

/**
 * O campo de CEP do destinatário aceitava qualquer coisa sem formatar, e a
 * busca de endereço só disparava no `blur` — quem digitava o CEP e ia direto
 * no botão de salvar nunca a acionava, e o endereço ficava vazio sem sinal
 * nenhum de que algo deveria ter vindo.
 */

describe("maskCep", () => {
  it("formata o CEP do primeiro emitente", () => {
    expect(maskCep("37750000")).toBe("37750-000");
  });

  it("não insere o hífen antes da hora", () => {
    // Separador cedo demais faz o cursor pular enquanto se digita.
    expect(maskCep("377")).toBe("377");
    expect(maskCep("37750")).toBe("37750");
    expect(maskCep("377500")).toBe("37750-0");
  });

  it("descarta o excesso em vez de aceitar em silêncio", () => {
    expect(maskCep("377500001234")).toBe("37750-000");
  });

  it("é idempotente sobre um valor já formatado", () => {
    // O onChange remascara a cada tecla; sem isso, apagar um caractere
    // reintroduziria o hífen e o cursor saltaria.
    expect(maskCep("37750-000")).toBe("37750-000");
  });

  it("ignora o que não for dígito", () => {
    expect(maskCep("37.750-000")).toBe("37750-000");
    expect(maskCep("abc")).toBe("");
    expect(maskCep("")).toBe("");
  });
});
