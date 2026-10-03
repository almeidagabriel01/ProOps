/**
 * Traduz a falha de upload do Firebase Storage numa frase que a pessoa entende.
 *
 * A mensagem crua do SDK traz o caminho inteiro do arquivo
 * ("User does not have permission to access 'tenants/tenant_.../foto.jpg'"):
 * em inglês, sem dizer o que fazer, e com um token longo que o toast não
 * consegue quebrar. Erro que não é do Storage passa como veio.
 */
export const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  "storage/unauthorized":
    "Sem permissão para enviar arquivos nesta empresa. Saia e entre de novo; se continuar, fale com o suporte.",
  "storage/unauthenticated": "Sua sessão expirou. Entre de novo para enviar o arquivo.",
  "storage/quota-exceeded":
    "O armazenamento está cheio. Apague arquivos que não usa mais ou faça upgrade do plano.",
  "storage/canceled": "O envio do arquivo foi cancelado.",
  "storage/retry-limit-exceeded":
    "A conexão caiu durante o envio do arquivo. Confira a internet e tente de novo.",
};

const FALLBACK_MESSAGE = "Não foi possível enviar o arquivo. Tente de novo em instantes.";

function storageErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.startsWith("storage/") ? code : null;
}

export function describeUploadError(error: unknown): unknown {
  const code = storageErrorCode(error);
  if (!code) return error;
  return new Error(UPLOAD_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE, { cause: error });
}

/** Roda o upload e troca o erro do Storage pela frase traduzida. */
export async function withFriendlyUploadError<T>(upload: () => Promise<T>): Promise<T> {
  try {
    return await upload();
  } catch (error) {
    throw describeUploadError(error);
  }
}
