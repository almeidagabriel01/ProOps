/**
 * Versão da aba contra a versão publicada.
 *
 * O código de uma aba só muda quando ela recarrega. O `deploymentId` do
 * `next.config.ts` já faz o Next recarregar numa troca de tela que vá ao
 * servidor, mas quem deixa o ERP aberto por dias na mesma tela, e só volta
 * para a aba, segue na versão antiga indefinidamente: foi assim que o dono da
 * AWA ficou sem o aviso de presença depois da publicação que o trouxe.
 */

/** A versão desta aba, embutida no build. Vazia fora da Vercel. */
export const CURRENT_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_DEPLOYMENT_ID ?? "";

/**
 * Saiu outra publicação? Só com as duas versões conhecidas: sem uma delas
 * (desenvolvimento, teste, falha na consulta) a resposta é não.
 */
export function isNewerDeployment(current: string | null | undefined, live: string | null | undefined): boolean {
  if (!current || !live) return false;
  return current !== live;
}

/** A versão publicada agora, ou `null` se a consulta falhar. */
export async function fetchLiveDeploymentId(): Promise<string | null> {
  try {
    const response = await fetch("/api/version", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { deploymentId?: unknown };
    return typeof body.deploymentId === "string" && body.deploymentId ? body.deploymentId : null;
  } catch {
    return null;
  }
}

/** Recarrega a aba (separado para o teste poder observar). */
export function reloadPage(): void {
  window.location.reload();
}
