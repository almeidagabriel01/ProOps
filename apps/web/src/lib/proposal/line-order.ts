/**
 * Ordem das linhas escolhida por quem vende, arrastando dentro do ambiente ou
 * grupo. A posição vai em `sortOrder`, que `compareConfiguredDisplayItem` lê
 * antes da ordem padrão; formulário, resumo, visualização e PDF usam o mesmo
 * comparador, então a ordem é uma só em todo lugar.
 */

interface OrderedLine {
  lineItemId?: string;
  sortOrder?: number;
}

/** Grava a posição de cada linha listada; as outras ficam como estão. */
export function applyLineOrder<T extends OrderedLine>(
  lines: readonly T[],
  orderedLineItemIds: readonly string[],
): T[] {
  const position = new Map(orderedLineItemIds.map((id, index) => [id, index]));
  return lines.map((line) => {
    const index = line.lineItemId ? position.get(line.lineItemId) : undefined;
    return index === undefined ? line : { ...line, sortOrder: index };
  });
}

/**
 * A ordem nova de um ambiente depois de arrastar `activeId` para o lugar de
 * `overId` na lista VISÍVEL. As linhas escondidas (quantidade 0 com "Ocultar
 * qtd. 0" ligado) vão para o fim, na ordem em que já estavam, para nenhuma
 * ficar sem posição.
 */
export function reorderVisibleLines(
  visibleIds: readonly string[],
  hiddenIds: readonly string[],
  activeId: string,
  overId: string,
): string[] | null {
  const from = visibleIds.indexOf(activeId);
  const to = visibleIds.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = [...visibleIds];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return [...next, ...hiddenIds];
}
