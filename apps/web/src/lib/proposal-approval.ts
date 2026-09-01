/**
 * "Esta proposta está ganha?" — em um lugar só.
 *
 * O tenant pode renomear e recriar as colunas do funil, então não basta olhar
 * `status === "approved"`: uma coluna própria chamada "Fechado" com categoria
 * `won` também é aprovação. O critério já vivia duplicado na lista de propostas
 * e no serviço do kanban; virou util quando o convite de emissão precisou dele
 * numa terceira tela — e é exatamente o tipo de regra que, duplicada, faz o
 * botão aparecer numa superfície e não na outra.
 */

export interface ApprovalColumnLike {
  mappedStatus?: string | null;
  category?: string | null;
  label?: string | null;
}

export function isApprovedColumn(column: ApprovalColumnLike | undefined | null): boolean {
  if (!column) return false;
  return (
    column.mappedStatus === "approved" ||
    column.category === "won" ||
    /aprovad/i.test(column.label ?? "")
  );
}
