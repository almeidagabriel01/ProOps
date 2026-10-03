import type Lenis from "lenis";

/**
 * A landing roda Lenis (smooth scroll), que assume o controle do scroll do
 * documento: um `window.scrollTo({ behavior: "smooth" })` é desfeito pelo rAF
 * do Lenis no mesmo frame e a página não sai do lugar. Todo scroll programático
 * da landing precisa passar pela instância do Lenis quando ela existe.
 *
 * O Lenis só é criado depois do primeiro paint (requestIdleCallback) e nunca
 * sob `prefers-reduced-motion`, então o fallback nativo continua necessário.
 */
let instance: Lenis | null = null;

/**
 * Destino de uma rolagem nativa suave ainda em curso. O Lenis, ao nascer, fixa
 * a posição em que a página está e a reafirma a cada frame: um clique na
 * navbar antes do `requestIdleCallback` (comum em máquina lenta) ficava
 * parado no meio do caminho, longe da seção. Quem registra o Lenis retoma
 * daqui o que o nativo não terminou.
 */
let pendingTarget: number | null = null;
let stopTrackingPending: (() => void) | null = null;

const USER_TAKEOVER_EVENTS = ["wheel", "touchstart", "keydown"] as const;

function trackPendingNativeScroll(target: number): void {
  stopTrackingPending?.();
  pendingTarget = target;

  const stop = () => {
    pendingTarget = null;
    stopTrackingPending = null;
    window.removeEventListener("scrollend", onScrollEnd);
    for (const name of USER_TAKEOVER_EVENTS) {
      window.removeEventListener(name, stop);
    }
  };
  // `scrollend` também chega de uma rolagem anterior (a roda do mouse que
  // revelou a navbar), então só encerra quem de fato chegou ao destino.
  const onScrollEnd = () => {
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(window.scrollY - Math.min(target, maxScroll)) < 2) stop();
  };

  window.addEventListener("scrollend", onScrollEnd);
  for (const name of USER_TAKEOVER_EVENTS) {
    window.addEventListener(name, stop, { passive: true });
  }
  stopTrackingPending = stop;
}

export function setLandingLenis(lenis: Lenis | null): void {
  instance = lenis;
  if (lenis && pendingTarget !== null) {
    const target = pendingTarget;
    stopTrackingPending?.();
    lenis.scrollTo(target);
  }
}

/**
 * Trava e destrava a rolagem da página, para um painel que cobre a tela.
 *
 * Duas metades porque há dois donos possíveis do scroll. Com Lenis no ar é ele
 * quem manda, e `overflow: hidden` sozinho não o impede de continuar aplicando
 * a própria posição; sem Lenis (movimento reduzido, ou antes do
 * `requestIdleCallback` que o cria) quem manda é o navegador, e aí o
 * `overflow` é o único freio. Aplicar os dois cobre as duas situações sem
 * precisar saber em qual delas a página está.
 */
export function setScrollLocked(locked: boolean): void {
  if (locked) {
    instance?.stop();
    document.documentElement.style.overflow = "hidden";
    return;
  }
  instance?.start();
  document.documentElement.style.removeProperty("overflow");
}

/**
 * `immediate` pula a suavização: é o caso de um controle arrastado que move a
 * página junto com o dedo, onde qualquer atraso descola a página do gesto.
 */
export function scrollToOffset(
  top: number,
  { immediate = false }: { immediate?: boolean } = {},
): void {
  const target = Math.max(top, 0);
  if (instance) {
    if (immediate) instance.scrollTo(target, { immediate: true });
    else instance.scrollTo(target);
    return;
  }
  window.scrollTo({ top: target, behavior: immediate ? "instant" : "smooth" });
  if (!immediate) trackPendingNativeScroll(target);
}

/**
 * Jumps to the top with no animation, for a route change.
 *
 * The App Router resets the scroll position itself, but Lenis keeps its own
 * internal position and reasserts it on the next frame, so the new page opens
 * wherever the old one was left. `immediate` is what skips the easing: a
 * smooth-scrolled reset is visible, and it competes with the curtain covering
 * the transition.
 */
export function jumpToTop(): void {
  if (instance) {
    instance.scrollTo(0, { immediate: true });
    return;
  }
  window.scrollTo(0, 0);
}
