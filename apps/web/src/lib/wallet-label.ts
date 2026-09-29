/**
 * O nome da carteira de um lançamento. O campo `wallet` guarda o NOME nos
 * lançamentos antigos e o ID nos novos (a OS lançada no financeiro, a
 * mensalidade do contrato, o formulário atual), então toda tela que mostra a
 * carteira passa por aqui: sem isso o id aparecia cru para o usuário.
 */
export function walletLabel(
  value: string | null | undefined,
  wallets: ReadonlyArray<{ id: string; name: string }>,
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const found = wallets.find((w) => w.id === raw) ?? wallets.find((w) => w.name === raw);
  return found?.name ?? raw;
}

/** A carteira do lançamento é esta? Compara pelo id ou pelo nome. */
export function isSameWallet(value: string | null | undefined, wallet: { id: string; name: string }): boolean {
  return value === wallet.id || value === wallet.name;
}
