function isEqualValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }

  // Timestamp do Firestore (e afins) trazem a própria comparação.
  const withIsEqual = a as { isEqual?: (other: unknown) => boolean };
  if (typeof withIsEqual.isEqual === "function") {
    try {
      return withIsEqual.isEqual(b);
    } catch {
      return false;
    }
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isEqualValue(item, b[i]));
  }

  const aKeys = Object.keys(a as object);
  const bKeys = Object.keys(b as object);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      isEqualValue(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}

/**
 * Devolve `prev` quando `next` tem o mesmo conteúdo, preservando a
 * referência. O listener do tenant entregava, no primeiro snapshot, uma cópia
 * idêntica ao objeto já carregado, e a troca de referência fazia rodar de novo
 * todo efeito que dependia de `tenant`: na prática, cada tela buscava os
 * próprios dados duas vezes ao abrir.
 */
export function keepIfUnchanged<T>(prev: T, next: T): T {
  return isEqualValue(prev, next) ? prev : next;
}
