"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m as motion, useMotionValue } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { setScrollLocked } from "@/lib/landing/smooth-scroll";
import { institucionalHomeUrl, SITE_URLS } from "@/lib/site/surfaces";
import { cn } from "@/lib/utils";

import { Marca } from "./marca";
import { EMPRESA_LINKS } from "./nav-links";

const MOLA = { type: "spring" as const, stiffness: 420, damping: 38 };
const SAIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Quanto se rola antes de a barra virar cápsula. */
const CONDENSA_EM = 24;
/** Só depois disto a barra some ao descer: perto do topo ela fica sempre. */
const ESCONDE_DEPOIS_DE = 1.2;

/**
 * Chrome for the company site, on every one of its pages.
 *
 * Not the ERP's `LandingNavbar`: that one is built out of anchors into the ERP
 * home (`#showcase`, `#pricing`) and drives them through the landing's own Lenis
 * instance, so reusing it here would ship links that scroll to nothing.
 *
 * **No "Entrar" here, deliberately.** This is the company: who ProOps is and
 * what it builds. Nothing on it is behind a login, so a sign-in button would be
 * a destination competing with the ones that matter, and it would hand a visitor
 * who has never heard of the ERP a login form for a product they have not been
 * shown. Whoever already has an account arrives at the ERP directly, and the
 * sign-in lives on the ERP's own navbar, which owns the session.
 *
 * ## A barra faz quatro coisas, e cada uma resolve um problema desta superfície
 *
 * A primeira versão era uma barra fixa comum: fundo que aparecia ao rolar e
 * links à direita. Funcionava e não dizia nada, o que num site inteiro
 * construído sobre movimento lê como a única peça que ninguém desenhou.
 *
 * - **Ela se contrai numa cápsula.** No topo da página é uma barra larga sobre o
 *   herói; passados poucos pixels vira uma cápsula flutuante, mais estreita,
 *   com vidro e um filete. É a mesma barra o tempo todo (um `<nav>` só, que
 *   muda de forma), e não duas que se revezam: duas seriam dois conjuntos do
 *   mesmo menu no DOM, ou seja, o link "Manifesto" existindo em dois lugares
 *   para um leitor de tela e para um teste.
 * - **A pílula segue o ponteiro e volta para a página atual.** Um só elemento
 *   com `layoutId`, então ela DESLIZA de um destino a outro em vez de piscar no
 *   lugar novo. Sublinhado por link não conseguiria isso: cada um seria uma
 *   animação independente, e o que dá a sensação de um controle só é o objeto
 *   ser um só.
 * - **Ela sai da frente enquanto se desce e volta ao subir.** As páginas daqui
 *   são cenas de tela cheia presas ao scroll, e uma barra parada por cima delas
 *   é ruído sobre a única coisa que a página está tentando mostrar. Perto do
 *   topo ela nunca some, para não sumir bem quando alguém a procura.
 * - **Um filete mede o quanto falta.** São páginas longas, e a barra de
 *   progresso é a informação que a cápsula tem espaço para dar de graça. É
 *   `scaleX` num `MotionValue` escrito fora do React: escrever progresso em
 *   estado seria um render por quadro de scroll.
 *
 * O menu do celular não é um sanfona: é um índice de tela cheia, com os quatro
 * destinos em corpo grande e numerados, revelados em escada. O gesto é o mesmo
 * da cortina de transição e da abertura, de propósito, porque as três coisas
 * são a mesma ideia (a tela é coberta, e o que estava atrás mudou).
 *
 * Um listener passivo de scroll, com o trabalho coalescido em `requestAnimation
 * Frame`, cobre as três reações ao scroll. Três listeners fariam três leituras
 * de `scrollY` por quadro para calcular a mesma coisa.
 */
export function EmpresaNavbar() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [condensada, setCondensada] = useState(false);
  const [escondida, setEscondida] = useState(false);
  const [pairado, setPairado] = useState<number | null>(null);
  // The sheet remembers WHICH page it was opened on, not merely that it is open.
  // Comparing that to the current path closes it on navigation for free: an
  // effect watching `pathname` to call `setAberta(false)` is a setState inside an
  // effect, which cascades a render, and the derived form cannot get out of sync.
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const aberta = abertaEm === pathname;
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const progresso = useMotionValue(0);

  const indiceAtivo = EMPRESA_LINKS.findIndex((l) => l.href === pathname);
  const destacado = pairado ?? (indiceAtivo >= 0 ? indiceAtivo : null);

  useEffect(() => {
    let ultimo = window.scrollY;
    let agendado = false;
    let escondidoAgora = false;

    const medir = () => {
      agendado = false;
      const y = window.scrollY;
      const alcance =
        document.documentElement.scrollHeight - window.innerHeight;
      progresso.set(alcance > 0 ? Math.min(y / alcance, 1) : 0);
      setCondensada(y > CONDENSA_EM);

      /*
        O estado é PEGAJOSO: escondida continua escondida até alguém subir.

        A primeira versão derivava direto do delta do quadro ("está descendo?"),
        e com isso a barra voltava sozinha no instante em que o scroll parava,
        que é toda vez que alguém para para ler. Ela piscava de volta no meio de
        cada cena, que é pior do que nunca ter saído.

        Zona morta de 4px porque o Lenis desacelera em frações de pixel: sem ela
        o fim de cada rolagem conta como subida.
      */
      const piso = window.innerHeight * ESCONDE_DEPOIS_DE;
      let proximo = escondidoAgora;
      if (y <= piso) proximo = false;
      else if (y > ultimo + 4) proximo = true;
      else if (y < ultimo - 4) proximo = false;

      if (proximo !== escondidoAgora) {
        escondidoAgora = proximo;
        setEscondida(proximo);
      }
      ultimo = y;
    };

    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, [progresso]);

  // O índice cobre a tela inteira: deixar a página rolando atrás dele faz o
  // leitor voltar para outro lugar ao fechar.
  useEffect(() => {
    if (!aberta) return;
    setScrollLocked(true);
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        setAbertaEm(null);
        botaoMenu.current?.focus();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      setScrollLocked(false);
    };
  }, [aberta]);

  return (
    <>
      {/*
        O índice é IRMÃO do `<header>`, e não filho dele, e isso é obrigatório.

        O header carrega `translate-y-0` / `-translate-y-full` para sair da
        frente ao descer. No Tailwind v4 essas classes compilam para a
        propriedade CSS `translate`, que, como `transform`, torna o elemento um
        bloco de contenção para descendentes `fixed`. Um painel `fixed inset-0`
        dentro dele não cobre a tela: cobre a CAIXA DO HEADER, que tem a altura
        da cápsula. O sintoma é um menu de tela cheia recortado numa faixa de uns
        cento e cinquenta pixels, com a página aparecendo por baixo, e nada falha
        em lugar nenhum. É a mesma armadilha que já custou uma vez na cortina de
        transição, por outro caminho.
      */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[80] transition-transform duration-500 ease-out",
          escondida && !aberta ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <div className="px-3 pt-3 md:px-6 md:pt-4">
          <nav
            aria-label="Principal"
            className={cn(
              "relative mx-auto flex items-center justify-between gap-3 transition-[max-width,padding,background-color,border-color,border-radius,box-shadow] duration-500 ease-out",
              condensada || aberta
                ? "max-w-4xl rounded-full border border-white/12 bg-neutral-950/80 px-3 py-2 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl md:px-4 md:py-2.5"
                : "max-w-6xl rounded-[2rem] border border-transparent bg-transparent px-3 py-3 md:px-5 md:py-4",
            )}
          >
            {/* `institucionalHomeUrl()` e nao "/": enquanto o apex serve o ERP, a
              raiz deste site e /institucional, e um "/" cru levaria de /sobre
              direto para a landing do ERP. */}
            <CurtainLink
              href={institucionalHomeUrl()}
              aria-label="ProOps, página inicial"
              className="group flex shrink-0 items-center gap-2.5 rounded-full px-2 py-1"
              onClick={() => setAbertaEm(null)}
            >
              <Marca className="h-6 w-6 shrink-0 text-white transition-transform duration-500 ease-out group-hover:rotate-[18deg]" />
              {/* A palavra encolhe junto com a cápsula: a marca sozinha basta
                quando a barra já contou o que é, e o espaço vale mais para os
                destinos. Largura e opacidade, nunca `display`, senão não há o
                que animar. */}
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap [font-family:var(--font-bricolage)] text-[18px] font-bold tracking-tight text-white transition-[max-width,opacity] duration-500 ease-out",
                  condensada && !aberta
                    ? "max-w-0 opacity-0 md:max-w-0"
                    : "max-w-[7rem] opacity-100",
                )}
              >
                ProOps
              </span>
            </CurtainLink>

            <div
              className="hidden items-center gap-1 md:flex"
              onMouseLeave={() => setPairado(null)}
            >
              {EMPRESA_LINKS.map((link, indice) => {
                const ativo = pathname === link.href;
                return (
                  <span
                    key={link.href}
                    className="relative"
                    onMouseEnter={() => setPairado(indice)}
                  >
                    {destacado === indice && (
                      // Um elemento só, movido por `layoutId`: é isso que faz a
                      // pílula deslizar entre os destinos em vez de reaparecer no
                      // destino novo.
                      <motion.span
                        aria-hidden="true"
                        layoutId="pilula-do-menu"
                        transition={reduce ? { duration: 0 } : MOLA}
                        className={cn(
                          "absolute inset-0 rounded-full",
                          ativo ? "bg-white/[0.14]" : "bg-white/[0.07]",
                        )}
                      />
                    )}
                    <CurtainLink
                      href={link.href}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "relative z-10 block px-4 py-2 text-sm transition-colors duration-300",
                        ativo ? "text-white" : "text-white/60 hover:text-white",
                      )}
                    >
                      {link.rotulo}
                    </CurtainLink>
                  </span>
                );
              })}
            </div>

            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <a
                href={SITE_URLS.app}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-3 py-2 text-sm text-white/55 transition-colors duration-300 hover:bg-white/[0.06] hover:text-white"
              >
                Aplicativo
              </a>
              <Magnetic forca={8}>
                <a
                  href={SITE_URLS.erp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-sm text-white transition-colors duration-300 hover:border-white/50 hover:bg-white/[0.06]"
                >
                  ERP
                  <span
                    aria-hidden="true"
                    className="inline-block text-[11px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  >
                    &#8599;
                  </span>
                </a>
              </Magnetic>
            </div>

            <button
              ref={botaoMenu}
              type="button"
              onClick={() => setAbertaEm(aberta ? null : pathname)}
              aria-expanded={aberta}
              aria-controls="indice-empresa"
              className="relative z-10 flex items-center gap-2.5 rounded-full border border-white/15 py-2 pl-4 pr-3.5 text-white transition-colors duration-300 hover:border-white/40 md:hidden"
            >
              <span className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em]">
                {aberta ? "Fechar" : "Menu"}
              </span>
              <span
                aria-hidden="true"
                className="flex h-4 w-4 flex-col items-center justify-center gap-[4px]"
              >
                <span
                  className={cn(
                    "block h-px w-4 bg-white transition-transform duration-300",
                    aberta && "translate-y-[2.5px] rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "block h-px w-4 bg-white transition-transform duration-300",
                    aberta && "-translate-y-[2.5px] -rotate-45",
                  )}
                />
              </span>
            </button>

            {/* O quanto falta da página, rente à borda de baixo da cápsula. Só
              existe quando ela é cápsula: sobre o herói não há o que medir
              ainda, e um filete cruzando a tela ali seria enfeite. */}
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-5 bottom-0 h-px overflow-hidden rounded-full transition-opacity duration-500",
                condensada && !aberta ? "opacity-100" : "opacity-0",
              )}
            >
              <motion.span
                className="block h-full w-full origin-left bg-white/45"
                style={{ scaleX: progresso }}
              />
            </span>
          </nav>
        </div>
      </header>

      {/*
        O índice, no celular. Fora do `<nav>` de propósito: os mesmos quatro
        destinos dentro dele fariam cada link existir duas vezes no menu
        principal, para um leitor de tela e para qualquer seletor por papel.

        O painel desce por cima da página, que é o mesmo gesto da transição entre
        páginas e da abertura da raiz. Sob movimento reduzido ele simplesmente
        aparece.

        O movimento é `y` e não `clip-path`: `inset(0 0 100% 0)` e
        `inset(0 0 0% 0)` misturam `0` sem unidade com `0%`, e o interpolador
        para no meio do caminho. O painel ficava cortado num ponto qualquer,
        mostrando a página por baixo, sem erro nenhum no console. `y` também é
        composição pura, enquanto animar `clip-path` custa um repaint de tela
        cheia por quadro.
      */}
      <AnimatePresence>
        {aberta && (
          <motion.div
            id="indice-empresa"
            initial={reduce ? { opacity: 0 } : { y: "-100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "-100%" }}
            transition={{ duration: reduce ? 0.2 : 0.55, ease: SAIDA }}
            className="fixed inset-0 z-[75] flex flex-col justify-between overflow-y-auto bg-neutral-950 px-6 pb-8 pt-24 md:hidden"
          >
            <div
              aria-hidden="true"
              className="grade-pontos pointer-events-none absolute inset-0 opacity-50"
            />

            <ul className="relative flex flex-col">
              {EMPRESA_LINKS.map((link, indice) => (
                <motion.li
                  key={link.href}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.6,
                    ease: SAIDA,
                    delay: reduce ? 0 : 0.22 + indice * 0.07,
                  }}
                  className="border-b border-white/[0.08]"
                >
                  <CurtainLink
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    onClick={() => setAbertaEm(null)}
                    className="flex items-baseline gap-4 py-4"
                  >
                    <span
                      aria-hidden="true"
                      className="[font-family:var(--font-geist-mono)] text-[11px] tabular-nums tracking-[0.2em] text-white/30"
                    >
                      {String(indice + 1).padStart(2, "0")}
                    </span>
                    <span className="block">
                      <span
                        className={cn(
                          "block [font-family:var(--font-bricolage)] text-[1.7rem] font-semibold leading-tight tracking-tight",
                          pathname === link.href
                            ? "text-white"
                            : "text-white/85",
                        )}
                      >
                        {link.rotulo}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-white/45">
                        {link.resumo}
                      </span>
                    </span>
                  </CurtainLink>
                </motion.li>
              ))}
            </ul>

            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduce ? 0 : 0.5,
                delay: reduce ? 0 : 0.55,
              }}
              className="relative mt-8"
            >
              <p className="[font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.24em] text-white/30">
                Os produtos
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={SITE_URLS.erp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-sm text-white"
                >
                  ERP
                  <span aria-hidden="true" className="text-[11px]">
                    &#8599;
                  </span>
                </a>
                <a
                  href={SITE_URLS.app}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-sm text-white"
                >
                  Aplicativo
                  <span aria-hidden="true" className="text-[11px]">
                    &#8599;
                  </span>
                </a>
              </div>
              <a
                href="mailto:gestao@proops.com.br"
                className="mt-7 block [font-family:var(--font-geist-mono)] text-xs uppercase tracking-[0.2em] text-white/45"
              >
                gestao@proops.com.br
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
