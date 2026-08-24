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

export function setLandingLenis(lenis: Lenis | null): void {
  instance = lenis;
}

export function scrollToOffset(top: number): void {
  const target = Math.max(top, 0);
  if (instance) {
    instance.scrollTo(target);
    return;
  }
  window.scrollTo({ top: target, behavior: "smooth" });
}
