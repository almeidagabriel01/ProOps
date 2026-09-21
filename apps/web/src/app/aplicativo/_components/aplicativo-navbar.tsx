"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { scrollToOffset } from "@/lib/landing/smooth-scroll";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";
import { cn } from "@/lib/utils";

/**
 * A barra vira cápsula ao descer, e mostra o quanto falta.
 *
 * Era uma faixa estática de ponta a ponta sobre uma página construída em cenas
 * de tela cheia: a única peça que ninguém tinha desenhado. A cápsula é a mesma
 * gramática do site da empresa, e o filete de progresso existe pelo mesmo motivo
 * que lá, que é uma página longa dar essa informação de graça.
 *
 * Três regras herdadas de `empresa-navbar.tsx`, e cada uma custou alguma coisa:
 *
 * - **Um `<nav>` só, que muda de forma.** Duas barras que se revezassem seriam
 *   dois conjuntos do mesmo menu no DOM: cada destino existindo duas vezes para
 *   um leitor de tela e para qualquer seletor por papel.
 * - **O progresso é escrito direto no elemento, nunca em `useState`.** Progresso
 *   de scroll em estado é um render do React por quadro. O trabalho é coalescido
 *   num `requestAnimationFrame` e sai como `transform`, que é composição.
 * - **Só a cápsula é estado**, porque ela vira uma vez e fica.
 *
 * As âncoras rolam pelo Lenis (`scrollToOffset`) e não pelo salto nativo: com o
 * Lenis no ar, um `window.scrollTo` é desfeito pelo rAF dele no mesmo quadro.
 */

const ANCORAS = [
  { href: "#diferenca", rotulo: "A diferença" },
  { href: "#comandos", rotulo: "O que ele faz" },
  { href: "#planos", rotulo: "Planos" },
] as const;

/** Quanto o leitor precisa descer para a barra virar cápsula. */
const LIMIAR = 24;

export function AplicativoNavbar() {
  const [compacta, setCompacta] = React.useState(false);
  const progressoRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    let frame = 0;

    const escreve = () => {
      frame = 0;
      const y = window.scrollY;
      const total =
        document.documentElement.scrollHeight - window.innerHeight || 1;
      const barra = progressoRef.current;
      if (barra) {
        barra.style.transform = `scaleX(${Math.min(y / total, 1)})`;
      }
      // `setCompacta` com o mesmo valor não re-renderiza (React compara), então
      // isto não é um render por quadro: é um render nas duas travessias.
      setCompacta(y > LIMIAR);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(escreve);
    };

    escreve();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const vaiPara = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const alvo = document.querySelector<HTMLElement>(href);
    if (!alvo) return;
    event.preventDefault();
    scrollToOffset(alvo.getBoundingClientRect().top + window.scrollY);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 md:px-6 md:pt-4">
      <nav
        aria-label="Principal"
        className={cn(
          "relative mx-auto flex items-center justify-between gap-6 overflow-hidden transition-all duration-500 ease-out",
          compacta
            ? "max-w-3xl rounded-full border border-[var(--app-card-border)] bg-[var(--app-surface)]/80 px-5 py-2.5 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl md:px-6"
            : "max-w-6xl rounded-full border border-transparent bg-transparent px-2 py-4 md:px-4",
        )}
      >
        <Link
          href={SITE_URLS.institucional}
          aria-label={`${APP_NAME}, uma ProOps`}
          className="flex shrink-0 items-center gap-2.5"
        >
          <Image
            src="/logo/logo2-cropped.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="shrink-0"
          />
          <span className="[font-family:var(--font-hanken)] text-[17px] font-bold tracking-tight text-[var(--app-text)]">
            {APP_NAME}
          </span>
        </Link>

        {/* Abaixo de `md` os três destinos sairiam por cima da marca, e a página
            inteira é rolável de ponta a ponta: o CTA basta. */}
        <ul className="hidden items-center gap-7 md:flex">
          {ANCORAS.map((ancora) => (
            <li key={ancora.href}>
              <a
                href={ancora.href}
                onClick={(event) => vaiPara(event, ancora.href)}
                className="text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
              >
                {ancora.rotulo}
              </a>
            </li>
          ))}
        </ul>

        <Magnetic className="shrink-0">
          <LandingButton href="#planos" variant="inverted" size="sm">
            Ver planos
          </LandingButton>
        </Magnetic>

        {/* Rente à borda de baixo da cápsula, e só quando ela existe: numa barra
            transparente o filete ficaria boiando no meio da página. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 bottom-0 h-px origin-left bg-[var(--app-tint)] transition-opacity duration-500",
            compacta ? "opacity-70" : "opacity-0",
          )}
          ref={progressoRef}
          style={{ transform: "scaleX(0)" }}
        />
      </nav>
    </header>
  );
}
