/**
 * Monta o endereço livre a partir do endereço fiscal estruturado.
 *
 * Existe para o usuário não digitar o mesmo endereço duas vezes. O cadastro tem
 * dois campos por um motivo técnico — `address` é uma string boa para o dia a
 * dia, e a SEFAZ valida logradouro, número, bairro, UF e código IBGE separados,
 * o que não se obtém quebrando texto livre com segurança. Mas essa é uma razão
 * nossa, e o usuário só vê digitação repetida.
 *
 * A direção é sempre estruturado → livre, nunca o contrário: derivar o campo
 * fiscal de uma string erraria em toda ambiguidade de vírgula, e um endereço
 * fiscal errado vira rejeição.
 */

interface EnderecoFiscalParts {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

/** `Rua A, 10, Centro, Machado/MG, 37750-000`. Partes vazias somem. */
export function formatEnderecoFiscal(endereco: EnderecoFiscalParts): string {
  const logradouroComNumero = [endereco.logradouro, endereco.numero]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");

  const cidadeUf = [endereco.municipio, endereco.uf]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("/");

  return [
    logradouroComNumero,
    String(endereco.complemento ?? "").trim(),
    String(endereco.bairro ?? "").trim(),
    cidadeUf,
    String(endereco.cep ?? "").trim(),
  ]
    .filter(Boolean)
    .join(", ");
}
