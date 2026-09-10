"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/dist/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { Marca } from "@/components/institucional/marca";
import { jumpToTop } from "@/lib/landing/smooth-scroll";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);
}

interface CurtainContextValue {
  navegar: (href: string) => void;
}

const CurtainContext = createContext<CurtainContextValue | null>(null);

/**
 * Animated navigation between the company site's pages, on the mark.
 *
 * Um painel sobe por baixo da página com a borda de cima ARQUEADA, e a curva se
 * achata no instante em que ele assenta; o símbolo da ProOps se desenha no
 * meio do preto, segura o tempo da troca de rota, e o painel CONTINUA subindo
 * para fora da tela, agora com a curva na borda de baixo, arrastando atrás de
 * si. A repetição é o ponto: quem passa por quatro páginas vê a marca desenhada
 * quatro vezes, no único momento em que não há mais nada na tela para olhar.
 *
 * Duas decisões que valem a pena:
 *
 * - **O painel sai pelo mesmo lado por onde entrou.** A primeira versão eram
 *   seis lâminas que fechavam de baixo para cima e abriam de cima para baixo,
 *   ou seja, o movimento voltava atrás, e movimento que volta atrás lê como
 *   "cancelei" em vez de "avancei". Continuar na mesma direção é o que faz a
 *   transição parecer uma página sendo puxada e não uma cortina hesitando.
 * - **A curva não é animada, ela é transportada.** Animar `border-radius` ou
 *   um `path` custa um repaint de tela cheia por quadro. Aqui o arco é uma
 *   forma fixa colada na borda do painel: o painel translada (composição pura)
 *   e o arco só é achatado por um `scaleY`, que também é composição.
 *
 * `DrawSVGPlugin` animates the stroke of the real path from
 * `public/logo/logo2-cropped.svg`, so the thing being drawn is the asset and not
 * an approximation of it. It ships free with GSAP since 3.13.
 *
 * Why not View Transitions: `globals.css` disables
 * `::view-transition-old/new(root)` for the whole app, deliberately, because the
 * default cross-fade fought the theme switch. Re-enabling it here would change
 * every route in the product to buy one effect on four pages.
 *
 * The sequence is the only part that needs care. The App Router unmounts the
 * outgoing page synchronously, which is why an `AnimatePresence` exit cannot
 * work: by the time the exit would play there is nothing left to play it on.
 * Instead the curtain lives OUTSIDE the page, in the group layout, and
 * navigation is three beats:
 *
 *   1. o painel sobe e cobre a página que ainda está na tela, a marca se desenha
 *   2. `router.push`, e o scroll salta para o topo enquanto está coberto
 *   3. a marca se recolhe e o painel sai por cima, revelando a página nova
 *
 * Beat 3 is driven by `usePathname` changing, not by the push resolving. The
 * push is not a promise, and a timer would either uncover a page that has not
 * rendered or hold the curtain on one that has.
 *
 * Under `prefers-reduced-motion` the curtain never renders and links are plain
 * `<Link>`s, which is also what a visitor with no JavaScript gets.
 */
export function CurtainProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const palco = useRef<HTMLDivElement>(null);
  const marca = useRef<SVGPathElement>(null);
  const destino = useRef<string | null>(null);
  const primeiroRender = useRef(true);

  const abre = useCallback(() => {
    const el = palco.current;
    if (!el) return;
    const painel = el.querySelector<HTMLElement>("[data-painel]");
    const arcoTopo = el.querySelector<HTMLElement>("[data-arco='topo']");
    const arcoBase = el.querySelector<HTMLElement>("[data-arco='base']");
    const simbolo = el.querySelector<HTMLElement>("[data-simbolo]");

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(el, { autoAlpha: 0 });
        // The incoming page's pinned sections measured their height while the
        // curtain was up. Without this, every ScrollTrigger on the new page is
        // off by the amount the layout settled.
        ScrollTrigger.refresh();
      },
    });

    if (marca.current) {
      // Unwinds from the end, so the stroke retreats the way it arrived instead
      // of erasing from the start, which reads as a rewind.
      tl.to(marca.current, {
        drawSVG: "100% 100%",
        duration: 0.55,
        ease: "power2.in",
      });
    }
    if (simbolo) {
      tl.to(simbolo, { scale: 1.1, opacity: 0, duration: 0.45 }, "<0.06");
    }
    // A curva troca de borda antes de o painel andar: subindo, quem arrasta é a
    // borda de baixo. Sem isto o painel sairia com a aresta reta e a saída não
    // teria nada a ver com a entrada.
    if (arcoTopo) tl.set(arcoTopo, { scaleY: 0 }, "<");
    if (arcoBase) {
      tl.fromTo(
        arcoBase,
        { scaleY: 0 },
        { scaleY: 1, duration: 0.4, ease: "power2.out" },
        "<0.15",
      );
    }
    tl.to(
      painel,
      { yPercent: -100, duration: 1.05, ease: "power3.inOut" },
      "<0.1",
    );
  }, []);

  const navegar = useCallback(
    (href: string) => {
      if (href === pathname) return;
      const el = palco.current;
      if (reduce || !el) {
        router.push(href);
        return;
      }
      if (destino.current) return; // já está saindo

      destino.current = href;
      const painel = el.querySelector<HTMLElement>("[data-painel]");
      const arcoTopo = el.querySelector<HTMLElement>("[data-arco='topo']");
      const arcoBase = el.querySelector<HTMLElement>("[data-arco='base']");
      const simbolo = el.querySelector<HTMLElement>("[data-simbolo]");
      gsap.set(el, { autoAlpha: 1 });

      const tl = gsap.timeline({
        onComplete: () => {
          router.push(href);
          jumpToTop();
        },
      });

      // A curva entra na borda de cima e se achata quando o painel assenta: é
      // ela que dá a sensação de peso, e uma curva que ficasse depois de o
      // painel parar viraria um enfeite parado no meio da tela.
      if (arcoBase) tl.set(arcoBase, { scaleY: 0 });
      if (arcoTopo) tl.set(arcoTopo, { scaleY: 1 }, "<");
      tl.fromTo(
        painel,
        { yPercent: 100 },
        { yPercent: 0, duration: 0.95, ease: "power3.inOut" },
        "<",
      );
      if (arcoTopo) {
        tl.to(arcoTopo, { scaleY: 0, duration: 0.5, ease: "power2.out" }, "-=0.5");
      }
      if (simbolo) {
        tl.fromTo(
          simbolo,
          { scale: 0.88, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "power2.out" },
          "-=0.55",
        );
      }
      if (marca.current) {
        tl.fromTo(
          marca.current,
          { drawSVG: "0% 0%" },
          { drawSVG: "0% 100%", duration: 0.8, ease: "power1.inOut" },
          "<",
        );
      }
    },
    [pathname, reduce, router],
  );

  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    if (!destino.current) return;
    destino.current = null;
    abre();
  }, [pathname, abre]);

  return (
    <CurtainContext.Provider value={{ navegar }}>
      {children}
      {!reduce && (
        <div
          ref={palco}
          aria-hidden="true"
          className="pointer-events-none invisible fixed inset-0 z-[90] overflow-hidden"
          data-cortina
        >
          {/*
            Nada de classe `scale-*` ou `translate-*` do Tailwind em nada disto,
            e não é preferência de estilo.

            No v4 essas classes compilam para as propriedades CSS `scale` e
            `translate`, que COMPÕEM com `transform` em vez de serem
            sobrescritas por ele. Um painel carregando `translate: 0 100%` fica
            fora da tela por mais que o GSAP escreva no transform: a cortina
            fecha sem cobrir um pixel, a navegação parece instantânea, o console
            fica limpo e o efeito simplesmente não existe. Já aconteceu uma vez.
            O transform é do GSAP, e de mais ninguém.

            Nada pisca em repouso porque o palco é `invisible` até uma navegação
            começar, e o `fromTo` escreve `yPercent: 100` na mesma tarefa do
            `autoAlpha: 1`, sem pintura entre as duas.
          */}
          <div data-painel className="absolute inset-0 bg-neutral-950">
            {/* Os dois arcos ficam FORA do painel, colados nas bordas, e são
                transportados por ele. Só um está em `scaleY: 1` de cada vez. */}
            <Arco lado="topo" />
            <Arco lado="base" />
          </div>

          {/* Acima do painel, e centrado no viewport: o símbolo é o assunto, o
              preto é o chão em que ele aparece. */}
          <div
            data-simbolo
            className="absolute inset-0 flex items-center justify-center"
          >
            <Marca contorno pathRef={marca} className="h-20 w-20 text-white" />
          </div>
        </div>
      )}
    </CurtainContext.Provider>
  );
}

/**
 * A borda arqueada do painel, colada por fora de uma das pontas dele.
 *
 * `preserveAspectRatio="none"` é o que permite que a mesma curva sirva a
 * qualquer largura de tela: sem ele, o arco manteria a proporção do viewBox e
 * sobraria (ou faltaria) painel nas pontas em telas largas.
 */
function Arco({ lado }: { lado: "topo" | "base" }) {
  const topo = lado === "topo";
  return (
    <div
      data-arco={lado}
      aria-hidden="true"
      className={cn(
        "absolute inset-x-0 h-[16vh] text-neutral-950",
        topo ? "bottom-full origin-bottom" : "top-full origin-top",
      )}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        <path
          d={
            topo
              ? "M0 100 C 26 0, 74 0, 100 100 Z"
              : "M0 0 C 26 100, 74 100, 100 0 Z"
          }
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

interface CurtainLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * A link inside the company site that closes the curtain on its way out.
 *
 * Still a real `<a>`: the href is there for middle-click, for "open in new
 * tab", for a crawler and for a reader with JavaScript off. Only the plain
 * left-click is intercepted, and modified clicks are let through untouched,
 * because swallowing ctrl-click is the classic way a fancy navigation breaks
 * something the browser already did well.
 */
export function CurtainLink({
  href,
  children,
  className,
  "aria-label": ariaLabel,
}: CurtainLinkProps) {
  const ctx = useContext(CurtainContext);

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(className)}
      onClick={(event) => {
        if (!ctx) return;
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        ctx.navegar(href);
      }}
    >
      {children}
    </Link>
  );
}
