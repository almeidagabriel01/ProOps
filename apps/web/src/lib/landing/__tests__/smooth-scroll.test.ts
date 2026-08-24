/**
 * LANDING-ANCHOR-SCROLL-01 (unidade): roteamento do scroll programático da landing.
 *
 * Bug: `scrollToAnchor` usava `window.scrollTo({ behavior: "smooth" })`, que o rAF
 * do Lenis desfaz no mesmo frame — clicar em "Planos" na navbar trocava a URL para
 * `#pricing` e a página não saía do lugar.
 *
 * O fix roteia pelo Lenis quando ele existe e mantém o `window.scrollTo` como
 * fallback (reduced-motion nunca cria o Lenis, e ele só nasce depois do
 * `requestIdleCallback`). Este teste fixa exatamente essa decisão de roteamento —
 * o E2E cobre o clique real na navbar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrollToOffset, setLandingLenis } from "../smooth-scroll";

type LenisStub = { scrollTo: ReturnType<typeof vi.fn> };

const scrollTo = vi.fn();

function makeLenis(): LenisStub {
  return { scrollTo: vi.fn() };
}

beforeEach(() => {
  scrollTo.mockClear();
  vi.stubGlobal("window", { scrollTo });
  setLandingLenis(null);
});

afterEach(() => {
  setLandingLenis(null);
  vi.unstubAllGlobals();
});

describe("scrollToOffset", () => {
  it("sem Lenis registrado, cai no window.scrollTo nativo", () => {
    scrollToOffset(1500);

    expect(scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: "smooth" });
  });

  it("com Lenis registrado, rola pelo Lenis e nunca pelo nativo", () => {
    const lenis = makeLenis();
    setLandingLenis(lenis as never);

    scrollToOffset(1500);

    expect(lenis.scrollTo).toHaveBeenCalledWith(1500);
    // O ponto da regressão: chamar o nativo aqui é o que o Lenis desfazia.
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("depois do cleanup (setLandingLenis(null)) volta para o fallback nativo", () => {
    const lenis = makeLenis();
    setLandingLenis(lenis as never);
    setLandingLenis(null);

    scrollToOffset(800);

    expect(lenis.scrollTo).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({ top: 800, behavior: "smooth" });
  });

  it("nunca rola para posição negativa (âncora acima do topo com o offset da navbar)", () => {
    scrollToOffset(-120);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    const lenis = makeLenis();
    setLandingLenis(lenis as never);
    scrollToOffset(-120);
    expect(lenis.scrollTo).toHaveBeenCalledWith(0);
  });
});
