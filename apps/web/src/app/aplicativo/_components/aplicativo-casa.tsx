"use client";

import React from "react";
import Image from "next/image";
import gsap from "gsap";

import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { ScrubCounter } from "@/components/marketing/_shared/scrub-counter";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import {
  CENA_REPETE,
  SCENE_ANY_WIDTH,
  useScrollScene,
} from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

/**
 * De quem é este aplicativo.
 *
 * A prova social aqui é EMPRESTADA, e isso é uma decisão de produto, não uma
 * economia. Os cinco concorrentes diretos abrem com número de usuários: 250 mil,
 * 17 mil, 15 mil, nota da loja, depoimento com nome e foto. A ProOps Pessoal não
 * tem base para afirmar nada disso, e número enfeitado em página de produto
 * financeiro é a única mentira que o cliente descobre sozinho, na primeira
 * semana.
 *
 * O que existe de verdade é a casa: a ProOps nasceu em novembro de 2025 dentro
 * da empresa de automação residencial de um dos sócios, porque montar uma
 * proposta levava horas, e o ERP está em produção desde então com cliente
 * pagando. Isso responde "de quem eu estou comprando" sem inventar usuário.
 *
 * ⚠️ **Os três números são do ERP, e a tela diz isso.** Eles vêm de
 * `institucional-copy.ts`, onde já estão publicados e conferidos. Mostrá-los sem
 * o rótulo "no ERP" seria transformar prova emprestada em prova falsa, que é
 * exatamente o que esta seção existe para não fazer.
 */

const NUMEROS_DO_ERP = [
  { valor: 2, digitos: 2, rotulo: "Empresas usando o ERP" },
  { valor: 70, digitos: 2, rotulo: "Propostas já emitidas" },
  { valor: 8, digitos: 2, sufixo: " min", rotulo: "Para uma proposta de 40 itens" },
];

const PESSOAS = [
  {
    nome: "Mauricio Krziminski",
    papel: "Cofundador, engenharia e produto",
    foto: "/founders/mauricio-krziminski.webp",
  },
  {
    nome: "Gabriel Almeida",
    papel: "Cofundador, engenharia e produto",
    foto: "/founders/gabriel-almeida.jpeg",
  },
  {
    nome: "Winicius Gonçalves",
    papel: "Cofundador, comercial e financeiro",
    foto: "/founders/winicius-goncalves.png",
  },
];

export function AplicativoCasa() {
  return (
    <HidratarPerto>
      <CorpoDaCasa />
    </HidratarPerto>
  );
}

function CorpoDaCasa() {
  const secao = React.useRef<HTMLElement>(null);
  const trilha = React.useRef<HTMLDivElement>(null);
  const { progress } = useScrollProgress(trilha, {
    start: "top 80%",
    end: "bottom 75%",
    fallback: 1,
  });

  useScrollScene(
    secao,
    () => {
      const retratos = gsap.utils.toArray<HTMLElement>(".pessoa-card");
      if (!retratos.length) return;
      const tween = gsap.fromTo(
        retratos,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.09,
          scrollTrigger: {
            trigger: retratos[0],
            start: "top 90%",
            toggleActions: CENA_REPETE,
          },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { query: SCENE_ANY_WIDTH },
  );

  return (
    <section
      ref={secao}
      id="quem-faz"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          Quem faz
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          O segundo produto de uma casa que já tem um no ar.
        </h2>

        <p className="mt-7 max-w-2xl text-base leading-relaxed text-[var(--app-text-muted)] md:text-lg">
          A ProOps nasceu em novembro de 2025 dentro da empresa de automação
          residencial de um dos sócios, porque montar uma proposta levava horas.
          O ERP está em produção desde então, com cliente pagando. A {APP_NAME} é
          feita pelas mesmas três pessoas.
        </p>

        {/* Os números são do ERP, e o rótulo da faixa diz isso antes de o
            primeiro dígito aparecer. */}
        <div ref={trilha} className="mt-14 md:mt-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-muted)]">
            No ERP da ProOps, hoje
          </p>
          <dl className="mt-6 grid gap-8 border-t border-white/[0.07] pt-8 sm:grid-cols-3">
            {NUMEROS_DO_ERP.map((numero, i) => (
              <div key={numero.rotulo}>
                <dt className="sr-only">{numero.rotulo}</dt>
                <dd>
                  <ScrubCounter
                    progresso={progress}
                    valor={numero.valor}
                    digitos={numero.digitos}
                    sufixo={numero.sufixo}
                    de={i * 0.12}
                    ate={0.55 + i * 0.12}
                    className="block [font-family:var(--font-jetbrains-mono)] text-4xl font-bold leading-none tracking-[-0.02em] text-[var(--app-tint)] md:text-5xl"
                  />
                  <span
                    aria-hidden="true"
                    className="mt-3 block text-sm leading-snug text-[var(--app-text-muted)]"
                  >
                    {numero.rotulo}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3 md:mt-20">
          {PESSOAS.map((pessoa) => (
            <article
              key={pessoa.nome}
              className="pessoa-card rounded-3xl border border-[var(--app-card-border)] bg-[var(--app-surface)] p-6"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-full">
                <Image
                  src={pessoa.foto}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <h3 className="mt-5 [font-family:var(--font-hanken)] text-base font-semibold">
                {pessoa.nome}
              </h3>
              <p className="mt-1.5 text-sm leading-snug text-[var(--app-text-muted)]">
                {pessoa.papel}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-[var(--app-text-muted)]">
          <a
            href={`${SITE_URLS.institucional}/sobre`}
            className="underline decoration-[var(--app-text-muted)]/40 underline-offset-4 transition-colors hover:text-[var(--app-text)]"
          >
            A história inteira, no site da ProOps
          </a>
        </p>
      </div>
    </section>
  );
}
