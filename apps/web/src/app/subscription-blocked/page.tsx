import { loadBlockedSession } from "./_lib/blocked-session";
import { SubscriptionBlockedView } from "./_components/subscription-blocked-view";

/**
 * Tela de quem perdeu o acesso. O contexto (dono ou membro, plano manual ou
 * Stripe, data do fim, empresa e responsável) é lido no servidor, junto da
 * decisão do layout; a mensagem sai de `resolveBlockedScreen`.
 */
export default async function SubscriptionBlockedPage() {
  const { screen } = await loadBlockedSession();
  return <SubscriptionBlockedView screen={screen} />;
}
