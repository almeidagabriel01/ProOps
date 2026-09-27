/**
 * Semântica de acessibilidade do toast do sileo.
 *
 * O sileo desenha o toast inteiro como um `<button>` e a ação ("Desfazer")
 * como um `<a href="#">` lá dentro. O conteúdo de um botão é apresentacional
 * na árvore de acessibilidade, então o leitor de tela lia o toast como um
 * botão só, com o texto todo, e a ação não existia como controle próprio.
 *
 * Não dá para trocar a tag sem mexer na biblioteca (e um patch no
 * `node_modules` hoisted da raiz não tem garantia de ser aplicado no build da
 * Vercel), então a correção é de atributos, aplicada a cada toast que entra:
 * - o toast vira um grupo, fora da ordem de tabulação (ele não faz nada no
 *   clique; arrastar para fechar continua funcionando);
 * - o desenho em SVG, cujo `<title>` é "Sileo Notification", sai da leitura;
 * - a ação vira um botão, que também responde ao Espaço.
 */

const ENHANCED = "data-a11y-enhanced";

function activateOnSpace(event: KeyboardEvent) {
  if (event.key !== " ") return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).click();
}

export function enhanceToastAccessibility(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(`[data-sileo-toast]:not([${ENHANCED}])`).forEach((toast) => {
    toast.setAttribute(ENHANCED, "");
    toast.setAttribute("role", "group");
    toast.setAttribute("tabindex", "-1");
  });

  root.querySelectorAll<HTMLElement>(`[data-sileo-canvas]:not([${ENHANCED}])`).forEach((canvas) => {
    canvas.setAttribute(ENHANCED, "");
    canvas.setAttribute("aria-hidden", "true");
  });

  root.querySelectorAll<HTMLElement>(`[data-sileo-button]:not([${ENHANCED}])`).forEach((action) => {
    action.setAttribute(ENHANCED, "");
    action.setAttribute("role", "button");
    action.addEventListener("keydown", activateOnSpace);
  });
}

/** Aplica a correção agora e a cada toast novo. Devolve a função que para. */
export function observeToastAccessibility(root: HTMLElement): () => void {
  enhanceToastAccessibility(root);
  const observer = new MutationObserver(() => enhanceToastAccessibility(root));
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
