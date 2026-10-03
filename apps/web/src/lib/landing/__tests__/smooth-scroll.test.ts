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
let listeners: Map<string, Set<() => void>>;
let fakeWindow: {
  scrollTo: typeof scrollTo;
  scrollY: number;
  innerHeight: number;
  addEventListener: (name: string, fn: () => void) => void;
  removeEventListener: (name: string, fn: () => void) => void;
};

function fire(name: string): void {
  for (const fn of [...(listeners.get(name) ?? [])]) fn();
}

function makeLenis(): LenisStub {
  return { scrollTo: vi.fn() };
}

beforeEach(() => {
  scrollTo.mockClear();
  listeners = new Map();
  fakeWindow = {
    scrollTo,
    scrollY: 0,
    innerHeight: 800,
    addEventListener: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(fn);
    },
    removeEventListener: (name, fn) => {
      listeners.get(name)?.delete(fn);
    },
  };
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", { documentElement: { scrollHeight: 20000 } });
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

  it("com immediate, salta sem suavizar nos dois caminhos", () => {
    scrollToOffset(900, { immediate: true });
    expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: "instant" });

    const lenis = makeLenis();
    setLandingLenis(lenis as never);
    scrollToOffset(900, { immediate: true });
    expect(lenis.scrollTo).toHaveBeenCalledWith(900, { immediate: true });
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

/**
 * LANDING-ANCHOR-SCROLL-02: o Lenis nasce no meio de uma rolagem nativa.
 *
 * Bug: clicar em "Funcionalidades" antes do `requestIdleCallback` que cria o
 * Lenis começava uma rolagem nativa suave; o Lenis, ao nascer, fixava a
 * posição em que a página estava e a reafirmava a cada frame. A página parava
 * no meio do caminho (no CI, a ~700px de uma seção a ~5600px).
 */
describe("rolagem nativa interrompida pelo Lenis", () => {
  it("o Lenis registrado no meio do caminho retoma o destino", () => {
    scrollToOffset(5600);
    fakeWindow.scrollY = 700;

    const lenis = makeLenis();
    setLandingLenis(lenis as never);

    expect(lenis.scrollTo).toHaveBeenCalledWith(5600);
  });

  it("depois de chegar ao destino, o Lenis não rola mais nada", () => {
    scrollToOffset(5600);
    fakeWindow.scrollY = 5600;
    fire("scrollend");

    const lenis = makeLenis();
    setLandingLenis(lenis as never);

    expect(lenis.scrollTo).not.toHaveBeenCalled();
  });

  it("o scrollend de uma rolagem anterior, longe do destino, não encerra", () => {
    scrollToOffset(5600);
    fakeWindow.scrollY = 600;
    fire("scrollend");

    const lenis = makeLenis();
    setLandingLenis(lenis as never);

    expect(lenis.scrollTo).toHaveBeenCalledWith(5600);
  });

  it("destino além do fim da página conta como chegada no fim", () => {
    scrollToOffset(30000);
    fakeWindow.scrollY = 20000 - 800;
    fire("scrollend");

    const lenis = makeLenis();
    setLandingLenis(lenis as never);

    expect(lenis.scrollTo).not.toHaveBeenCalled();
  });

  it.each(["wheel", "touchstart", "keydown"])(
    "se a pessoa assume a rolagem (%s), o Lenis não a puxa de volta",
    (event) => {
      scrollToOffset(5600);
      fire(event);

      const lenis = makeLenis();
      setLandingLenis(lenis as never);

      expect(lenis.scrollTo).not.toHaveBeenCalled();
    },
  );

  it("salto imediato não deixa destino pendente", () => {
    scrollToOffset(900, { immediate: true });

    const lenis = makeLenis();
    setLandingLenis(lenis as never);

    expect(lenis.scrollTo).not.toHaveBeenCalled();
  });

  it("o destino é retomado uma vez só", () => {
    scrollToOffset(5600);
    const first = makeLenis();
    setLandingLenis(first as never);
    setLandingLenis(null);

    const second = makeLenis();
    setLandingLenis(second as never);

    expect(first.scrollTo).toHaveBeenCalledTimes(1);
    expect(second.scrollTo).not.toHaveBeenCalled();
  });
});
