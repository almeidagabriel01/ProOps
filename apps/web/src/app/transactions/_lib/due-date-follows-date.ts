/**
 * Vencimento do lançamento novo acompanha a Data enquanto o usuário não o
 * separou dela.
 *
 * O vencimento é obrigatório na receita e quase sempre igual à data; antes ele
 * nascia vazio e custava uma ida ao calendário em todo lançamento. Se o usuário
 * já escolheu um vencimento diferente, a mudança da Data não o apaga.
 */
export function dueDateAfterDateChange(
  previous: { date: string; dueDate: string },
  newDate: string,
): string {
  const followsDate = !previous.dueDate || previous.dueDate === previous.date;
  return followsDate ? newDate : previous.dueDate;
}
