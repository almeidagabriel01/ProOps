interface StatusColumnLike {
  id: string;
  label: string;
  mappedStatus?: string;
}

export interface StatusFilterOption {
  value: string;
  label: string;
}

/**
 * Opções do filtro de status da lista de propostas.
 *
 * O status gravado na proposta é o que a mudança de status grava: o
 * `mappedStatus` para as colunas padrão (`default_*`, que existem só na tela
 * quando a empresa nunca personalizou o funil) e o `id` da coluna nas
 * personalizadas. O filtro precisa usar o MESMO valor, senão não acha nada.
 */
export function proposalStatusFilterOptions(
  columns: StatusColumnLike[],
): StatusFilterOption[] {
  const options: StatusFilterOption[] = [{ value: "draft", label: "Rascunho" }];
  const seen = new Set(["draft"]);
  for (const column of columns) {
    const value =
      column.id.startsWith("default_") && column.mappedStatus
        ? column.mappedStatus
        : column.id;
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: column.label });
  }
  return options;
}
