import { cpf, cnpj } from "cpf-cnpj-validator";

/**
 * Máscara e validação de CPF/CNPJ.
 *
 * Estava duplicado, idêntico, nas duas telas de contato. Virou util quando a
 * proposta passou a precisar do mesmo campo: uma terceira cópia é onde as
 * versões começam a divergir sem ninguém notar.
 */

export function formatDocumento(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * Espelha a regra do backend (`clients.controller.ts`), inclusive tratar vazio
 * como válido — o documento é opcional no cadastro. Validar aqui evita que um
 * dígito errado derrube o salvamento da proposta inteira com um toast genérico.
 */
export function isDocumentoValido(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return true;
  if (digits.length === 11) return cpf.isValid(digits);
  if (digits.length === 14) return cnpj.isValid(digits);
  return false;
}
