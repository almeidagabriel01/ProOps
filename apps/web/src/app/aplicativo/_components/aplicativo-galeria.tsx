"use client";

import React from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";

type Plataforma = "ios" | "android";

/**
 * Uma tela da prateleira. Aqui é SEMPRE a captura original: a aba Agente já foi
 * uma réplica em DOM, e a tab bar redesenhada à mão saía diferente da do
 * aplicativo, bem ao lado de cinco capturas verdadeiras.
 */
interface Tela {
  nome: string;
  descricao: string;
  /** A captura, dentro de `public/mockup-<plataforma>/`. */
  arquivo: string | Record<Plataforma, string>;
}

/**
 * The six screens, in the order the app's own tab bar puts them: Hoje, Notas,
 * Financeiro, Agente, Perfil. Someone who has the app reads the shelf in the
 * order they already navigate it, and someone who does not is being taught
 * that order before they ever open it.
 *
 * Financeiro appears twice because the tab has two faces worth showing, the
 * month at the top and the cards and budgets further down. It stays in the
 * tab's position either way.
 *
 * Deliberately one list rather than two: the shelf must be the same length
 * whichever platform is showing, otherwise switching would change the track
 * width and the pinned pan would have to be recalculated mid-scroll. Only the
 * folder changes, and the one file whose name differs between the two capture
 * runs is remapped below.
 */
const TELAS: Tela[] = [
  {
    nome: "Hoje",
    descricao: "Sobra projetada e pendências do dia",
    arquivo: "hoje.jpg",
  },
  {
    nome: "Notas",
    descricao: "Pastas, tags e checklist",
    arquivo: "notas.jpg",
  },
  {
    nome: "Financeiro",
    descricao: "O mês, com saldo projetado",
    arquivo: "financeiro2.jpg",
  },
  {
    nome: "Cartões e orçamentos",
    descricao: "Limites, faturas e o que falta",
    arquivo: "financeiro.jpg",
  },
  {
    nome: "Agente",
    descricao: "A assistente dentro do aplicativo",
    // As duas rodadas de captura deram nomes diferentes à mesma aba.
    arquivo: { ios: "agenda.jpg", android: "agente.jpg" },
  },
  {
    nome: "Perfil",
    descricao: "WhatsApp e a cota de IA por canal",
    arquivo: "perfil.jpg",
  },
];

function arquivoDa(tela: Tela, plataforma: Plataforma): string {
  return typeof tela.arquivo === "string"
    ? tela.arquivo
    : tela.arquivo[plataforma];
}

const ROTULO: Record<Plataforma, string> = { ios: "iOS", android: "Android" };

/**
 * The real screens, as proof, on the platform of your choosing.
 *
 * The hero shows one screen still. This is the opposite job, and only actual
 * captures do it. They come from the app's `design-preview` route, which
 * renders the real screens with sample data and no login.
 *
 * Above `md` the section pins and the vertical scroll drags the shelf sideways,
 * so the screens pass by as you keep scrolling down instead of asking for a
 * second, horizontal gesture. Below `md` the same markup falls back to a native
 * snap-scrolling row: pinning the page on a touch screen, where swiping
 * sideways is already natural, would be hijacking the scroll to make it worse.
 */
export function AplicativoGaleria() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLUListElement>(null);
  const [plataforma, setPlataforma] = React.useState<Plataforma>("ios");

  // Uma lista só: as duas plataformas têm as mesmas telas, e só a PASTA muda
  // (mais o nome da captura da aba Agente, resolvido em `arquivoDa`).
  const telas = TELAS;

  useScrollScene(sectionRef, () => {
    const track = trackRef.current;
    if (!track) return;

    const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);

    // How much page scroll the pan is spread over. Lower than it once was:
    // the lead-in and lead-out that let the end screens reach the centre also
    // made the track genuinely long, so it no longer needs stretching to be
    // worth pinning for.
    const SCROLL_STRETCH = 1.4;

    // Emphasis: whatever is crossing the middle of the screen is at full size
    // and full strength, and everything falls away towards the edges. It is
    // what gives a shelf depth instead of the flatness of a filmstrip.
    // Written straight to the CSS `scale` and `opacity` properties rather than
    // through gsap. `gsap.quickSetter(el, "scale")` looks like it should work
    // and does nothing: without a unit it sets a plain JS property on the
    // element, which the DOM ignores, so the opacity half of the effect landed
    // and the size half silently did not. Nothing here fights gsap, because
    // gsap only ever touches the track's `x`, never these elements.
    const itens = gsap.utils.toArray<HTMLElement>(".tela-item");

    // Centres are measured once per refresh rather than read every frame:
    // getBoundingClientRect in a scroll handler forces layout on each tick,
    // and the track only moves by transform, which does not change offsets.
    let centros: number[] = [];
    const medir = () => {
      const x = Number(gsap.getProperty(track, "x")) || 0;
      const base = track.getBoundingClientRect().left - x;
      centros = itens.map((el) => base + el.offsetLeft + el.offsetWidth / 2);
    };

    const aplicar = () => {
      if (!centros.length) return;
      const x = Number(gsap.getProperty(track, "x")) || 0;
      const meio = window.innerWidth / 2;
      const alcance = window.innerWidth * 0.52;

      for (let i = 0; i < itens.length; i += 1) {
        const perto = gsap.utils.clamp(
          0,
          1,
          1 - Math.abs(centros[i] + x - meio) / alcance,
        );
        itens[i].style.scale = String(0.9 + 0.1 * perto);
        itens[i].style.opacity = String(0.42 + 0.58 * perto);
      }
    };

    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      onUpdate: aplicar,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        // Derived from the real distance, so the section does not steal scroll
        // on a screen where there is genuinely nothing to pan.
        end: () => `+=${Math.max(Math.round(distance() * SCROLL_STRETCH), 1)}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onRefresh: () => {
          medir();
          aplicar();
        },
      },
    });

    medir();
    aplicar();

    // gsap has nothing recorded to revert, since these were written by hand.
    // Below `md`, and under reduced motion, every screen has to be back at
    // full size and full strength.
    return () => {
      itens.forEach((el) => {
        el.style.scale = "";
        el.style.opacity = "";
      });
    };
  });

  // Both platforms have the same number of screens, so switching cannot change
  // the track width. The caption underneath can still reflow by a line, and a
  // pinned trigger holding a stale height is the kind of thing that only shows
  // up as the last screen never quite arriving.
  React.useEffect(() => {
    ScrollTrigger.refresh();
  }, [plataforma]);

  return (
    <section
      ref={sectionRef}
      className="border-t border-white/[0.06] bg-[var(--app-bg)] py-28 text-[var(--app-text)] md:py-0"
    >
      <div className="md:h-[100svh] md:overflow-hidden">
        <div className="md:flex md:h-full md:flex-col md:justify-center">
          <div className="px-6 md:px-10">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
                  <span className="h-px w-7 bg-[var(--app-tint)]/50" />
                  Por dentro
                </p>
                {/* Sem `SplitReveal`: esta já é a cena mais cara da página (pin
                    mais pan horizontal mais seis molduras), e cada um deles soma
                    um `SplitText`, que retalha o DOM medindo layout, e mais um
                    ScrollTrigger, os dois criados na hidratação. O fecho é o
                    único lugar da página que guarda tipografia cinética. */}
                <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-4xl">
                  A {APP_NAME}, tela por tela.
                </h2>
              </div>

              {/* The switch is shaped like the thing it switches: two device
                  silhouettes, the selected one lit. A pair of text tabs would
                  have worked and would have said nothing. */}
              <div
                role="radiogroup"
                aria-label="Sistema operacional"
                className="relative flex shrink-0 items-center gap-1 self-start rounded-full border border-white/10 bg-[var(--app-element)] p-1 sm:self-auto"
              >
                {/* The lit pill slides rather than blinking between the two. */}
                <span
                  aria-hidden="true"
                  style={{
                    transform:
                      plataforma === "ios"
                        ? "translateX(0)"
                        : "translateX(100%)",
                  }}
                  className="absolute left-1 top-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded-full bg-[var(--app-tint)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                />
                {(["ios", "android"] as const).map((opcao) => {
                  const ativo = plataforma === opcao;
                  return (
                    <button
                      key={opcao}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setPlataforma(opcao)}
                      className={`relative z-10 flex w-[5.5rem] items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60 ${
                        ativo
                          ? "text-[var(--app-on-tint)]"
                          : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-3.5 w-[0.55rem] rounded-[3px] border ${
                          ativo
                            ? "border-[var(--app-on-tint)]"
                            : "border-current"
                        }`}
                      >
                        <span
                          className={`mx-auto mt-[1px] block ${
                            opcao === "ios"
                              ? "h-[2px] w-[5px] rounded-full"
                              : "h-[2px] w-[2px] rounded-full"
                          } ${ativo ? "bg-[var(--app-on-tint)]" : "bg-current"}`}
                        />
                      </span>
                      {ROTULO[opcao]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/*
            The lead-in and lead-out are half a viewport minus half a screen,
            which is exactly what it takes for the FIRST screen to start
            centred and the LAST to end centred. Without them the track runs
            edge to edge and the screens at the two ends never reach the middle
            at all, so the emphasis only ever lands on the ones in between: the
            first and last are dim and small for the whole pan and then the
            section is gone.
          */}
          {/* No celular a prateleira é uma fileira que se arrasta, e ela
              precisa PARECER uma. Com molduras de 52% cabiam duas inteiras e
              nada mais: a segunda encostava na borda, não havia barra de
              rolagem à vista e a seção lia como "o aplicativo tem duas telas".
              Três coisas dizem o contrário, e nenhuma é um texto pedindo
              desculpas: as molduras encolhem até a terceira espiar, a máscara
              apaga a fileira contra a borda direita em vez de cortá-la, e a
              legenda abaixo diz quantas são.

              `scroll-px-6` não é enfeite: com `snap-mandatory` o navegador
              alinha a borda da primeira moldura ao início da área de rolagem,
              que ignora o `padding`. Sem ele a fileira nascia rolada em 24px e
              a primeira moldura encostava na borda esquerda da tela, enquanto
              o título ao lado respeitava a margem. */}
          <ul
            ref={trackRef}
            className="landing-scrollbar mt-10 flex snap-x snap-mandatory scroll-px-6 gap-5 overflow-x-auto px-6 pb-8 [mask-image:linear-gradient(90deg,#000_calc(100%-2.5rem),transparent)] md:mt-10 md:w-max md:snap-none md:gap-8 md:overflow-visible md:px-[calc(50vw_-_7.5rem)] md:pb-0 md:[mask-image:none] lg:px-[calc(50vw_-_9.5rem)]"
          >
            {telas.map((tela, index) => (
              <li
                key={tela.nome}
                className="tela-item w-[43%] shrink-0 snap-start sm:w-[33%] md:w-[15rem] lg:w-[19rem]"
              >
                <DeviceFrame platform={plataforma}>
                  <Image
                    // Keyed by platform so React swaps the element instead of
                    // mutating src on the same node, which leaves the previous
                    // capture on screen until the new one decodes.
                    key={plataforma}
                    src={`/mockup-${plataforma}/${arquivoDa(tela, plataforma)}`}
                    alt={`Tela ${tela.nome} da ${APP_NAME} no ${ROTULO[plataforma]}: ${tela.descricao}`}
                    fill
                    sizes="(min-width: 1024px) 19rem, (min-width: 768px) 15rem, 43vw"
                    loading={index < 2 ? "eager" : "lazy"}
                    className="object-cover"
                  />
                </DeviceFrame>
                <p className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="[font-family:var(--font-hanken)] text-sm font-semibold text-[var(--app-text)]">
                    {tela.nome}
                  </span>
                </p>
                <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">
                  {tela.descricao}
                </p>
              </li>
            ))}

            {/*
              The shelf ends somewhere instead of trailing off. This also earns
              the pan its length honestly: six screens at a readable size
              already fit a wide monitor, and padding the track with empty
              space to force movement would be moving nothing.
            */}
            <li className="flex w-[43%] shrink-0 snap-start items-center sm:w-[33%] md:w-[15rem] lg:w-[19rem]">
              <a
                href="#planos"
                className="flex aspect-[9/19.5] w-full flex-col justify-center rounded-[1.75rem] border border-dashed border-white/15 px-6 text-center transition-colors hover:border-[var(--app-tint)]/50 hover:bg-white/[0.02]"
              >
                <span className="[font-family:var(--font-hanken)] text-lg font-bold leading-tight text-[var(--app-text)]">
                  Quanto custa?
                </span>
                <span className="mt-3 text-sm leading-relaxed text-[var(--app-text-muted)]">
                  Sete dias para testar, e dois planos.
                </span>
                <span className="mt-5 text-sm font-semibold text-[var(--app-tint)]">
                  Ver os planos
                </span>
              </a>
            </li>
          </ul>

          {/* Só no celular: no desktop a prateleira anda sozinha com a rolagem
              e não há gesto a ensinar. O número vem da lista, então ele não
              mente se uma tela entrar ou sair. */}
          <p className="-mt-4 px-6 text-xs text-[var(--app-text-muted)] md:hidden">
            {telas.length} telas. Arraste para o lado.
          </p>
        </div>
      </div>
    </section>
  );
}
