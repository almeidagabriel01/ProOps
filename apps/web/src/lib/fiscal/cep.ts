/**
 * Máscara de CEP, compartilhada pelos formulários fiscais.
 *
 * Existe como módulo próprio porque o emitente e o destinatário precisam da
 * mesma regra — e porque uma cópia num teste testaria a cópia, não o produto.
 */

export function onlyDigits(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** `37750000` → `37750-000`. */
export function maskCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
