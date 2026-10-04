/**
 * Contrato manual (plano dado pelo superadmin) ainda sem assinatura no Stripe.
 * Na aba Planos nenhum card é o "atual" para essa conta: todos levam ao
 * checkout, inclusive o do mesmo plano, que é como o contrato passa para o
 * cartão. O tenant vence o usuário, que é só a reserva de contas antigas.
 */
export function isManualContractWithoutStripe(
  tenant: { isManualSubscription?: boolean } | null | undefined,
  user: { isManualSubscription?: boolean; stripeSubscriptionId?: string } | null | undefined,
): boolean {
  const isManual = (tenant?.isManualSubscription ?? user?.isManualSubscription) === true;
  return isManual && !user?.stripeSubscriptionId;
}
