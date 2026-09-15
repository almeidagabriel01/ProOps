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

/**
 * Enquanto o painel cobre a tela, a entrada do herói da página que está
 * chegando fica parada no primeiro quadro.
 *
 * A página nova monta ATRÁS do painel, e `.hero-enter` / `.hero-rise-line` são
 * keyframes que tocam sozinhos no primeiro paint (é o contrato de LCP desta
 * superfície: o texto acima da dobra não pode esperar JavaScript). Sem esta
 * pausa a entrada inteira, que dura pouco mais de um segundo, acontecia no
 * escuro: quando o painel subia, o herói já estava parado no estado final.
 *
 * A regra CSS vive em `globals.css`. Aqui só se liga e desliga o atributo, e
 * ele é escrito no `<html>` de propósito: a página que vai animar ainda não
 * existe no momento em que a cortina fecha, então o sinal precisa morar acima
 * de qualquer subárvore que a navegação troque.
 *
 * `data-heroi`, e não `data-cortina`: o palco do painel já carrega
 * `data-cortina`, e um seletor `[data-cortina]` procurando o palco passaria a
 * casar também com o `<html>` enquanto a transição corre.
 */
const ATRIBUTO_ESPERA = "data-heroi";

function seguraHeroi() {
  document.documentElement.setAttribute(ATRIBUTO_ESPERA, "espera");
}

function liberaHeroi() {
  document.documentElement.removeAttribute(ATRIBUTO_ESPERA);
}

/**
 * `true` quando a página que está montando agora veio de uma navegação por
 * cortina, e portanto está nascendo debaixo do painel preto.
 *
 * Existe para a abertura da raiz: ela toca uma vez por documento, e se a
 * primeira visita à raiz acontecer por dentro do site, a cortina acabou de
 * cobrir a troca e as seis lâminas entrariam logo por cima dela. É o mesmo
 * gesto duas vezes seguidas, que é exatamente o que a abertura tocar só uma vez
 * existia para evitar.
 */
export function chegouSobACortina(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute(ATRIBUTO_ESPERA) === "espera";
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
 * **Which is why every page it serves has to share ONE layout.** Beat 3 runs in
 * the same provider instance that ran beat 1; if the navigation crosses a layout
 * boundary, React unmounts this component with the panel still down and mounts a
 * fresh one, whose `primeiroRender` guard makes it do nothing. The panel does not
 * lift, it simply ceases to exist, and the page appears in a cut. The company
 * site had exactly that between its root and its sub-pages until the two layouts
 * were merged into `app/(empresa)/layout.tsx`, and nothing failed: the URL
 * changed, the content was right, and only the animation was missing, in one
 * direction out of two.
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
  const destravamento = useRef<number | undefined>(undefined);
  const revelacao = useRef<gsap.core.Timeline | null>(null);
  const primeiroRender = useRef(true);

  const abre = useCallback(() => {
    const el = palco.current;
    if (!el) return;
    const painel = el.querySelector<HTMLElement>("[data-painel]");
    const arcoTopo = el.querySelector<HTMLElement>("[data-arco='topo']");
    const arcoBase = el.querySelector<HTMLElement>("[data-arco='base']");
    const simbolo = el.querySelector<HTMLElement>("[data-simbolo]");

    revelacao.current?.kill();
    const tl = gsap.timeline({
      onComplete: () => {
        revelacao.current = null;
        gsap.set(el, { autoAlpha: 0 });
        // O painel saiu da frente: agora a entrada do herói pode tocar, com o
        // escalonamento inteiro e ninguém na frente dela.
        liberaHeroi();
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
    // A entrada do herói só começa quando a transição ACABA, e o `onComplete`
    // acima é quem solta. Houve meio segundo de sobreposição aqui, para a
    // página parecer acordar enquanto era destapada; na tela isso vira o herói
    // se mexendo atrás da aresta do painel, ou seja, parte da entrada perdida
    // de novo, só que menos.
    revelacao.current = tl;
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

      // Clicar num segundo link enquanto o painel ainda está SAINDO é o caso em
      // que a cortina se cancelava sozinha: a revelação continuava escrevendo
      // `yPercent: -100` e, no fim, `autoAlpha: 0` por cima do painel que a
      // navegação nova acabara de trazer de volta. A tela ficava destapada, a
      // rota trocava sem transição nenhuma, e o console ficava limpo.
      revelacao.current?.kill();
      revelacao.current = null;

      destino.current = href;
      const painel = el.querySelector<HTMLElement>("[data-painel]");
      const arcoTopo = el.querySelector<HTMLElement>("[data-arco='topo']");
      const arcoBase = el.querySelector<HTMLElement>("[data-arco='base']");
      const simbolo = el.querySelector<HTMLElement>("[data-simbolo]");
      gsap.set(el, { autoAlpha: 1 });

      const tl = gsap.timeline({
        onComplete: () => {
          // A ordem importa: segurar ANTES do push, senão a página nova monta
          // com os keyframes já correndo e a pausa chega tarde demais para o
          // primeiro quadro.
          seguraHeroi();
          router.push(href);
          jumpToTop();
          // Rede de segurança. `router.push` não é promessa e não garante uma
          // troca de rota: se ela não vier (rota inexistente, navegação
          // cancelada), sem isto os heróis do site inteiro ficariam congelados
          // no primeiro quadro, para sempre e sem erro nenhum.
          if (destravamento.current) window.clearTimeout(destravamento.current);
          destravamento.current = window.setTimeout(() => {
            destino.current = null;
            liberaHeroi();
            gsap.set(el, { autoAlpha: 0 });
          }, 6000);
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
    if (destravamento.current) window.clearTimeout(destravamento.current);
    abre();
  }, [pathname, abre]);

  // Sair desta superfície com a cortina no ar deixaria o atributo escrito num
  // documento que ninguém mais vai destravar.
  useEffect(
    () => () => {
      if (destravamento.current) window.clearTimeout(destravamento.current);
      liberaHeroi();
    },
    [],
  );

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
