"use client";

import React from "react";
import gsap from "gsap";
import NumberFlow from "@number-flow/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { APP_NAME } from "@/lib/site/app-brand";
import { cn } from "@/lib/utils";

import { useValores } from "./cenas/pecas-da-cena";
import { useCena } from "./use-cena";
import { useVisibilidade } from "./use-visibilidade";

const LIMITE = 100;

type Canal = "whatsapp" | "app";

/**
 * Os pedidos do mês, na ordem em que foram feitos. A ordem intercala os dois
 * canais de propósito: é ela que faz a grade da cota se encher com as duas
 * cores misturadas, e não em dois blocos que pareceriam dois limites.
 */
const PEDIDOS_DO_MES: { canal: Canal; texto: string }[] = [
  { canal: "whatsapp", texto: "gastei 45 no mercado" },
  { canal: "app", texto: "parcela a geladeira em 10x" },
  { canal: "app", texto: "paguei a fatura do cartão" },
  { canal: "whatsapp", texto: "quanto sobra esse mês?" },
  { canal: "app", texto: "guarda 200 na meta" },
  { canal: "app", texto: "desfaz o último" },
];

const USADOS = PEDIDOS_DO_MES.length;

const CANAIS: Record<
  Canal,
  { nome: string; onde: string; bolha: string; casa: string }
> = {
  whatsapp: {
    nome: "WhatsApp",
    onde: "Conversa no WhatsApp",
    bolha: "bg-[var(--app-tint)]/[0.14] text-[var(--app-text)]",
    casa: "bg-[var(--app-tint)]",
  },
  app: {
    nome: "No app",
    onde: `Conversa na ${APP_NAME}`,
    bolha: "bg-[var(--app-element)] text-[var(--app-text)]",
    casa: "bg-[var(--app-text)]/75",
  },
};

/** Quando cada pedido aparece na timeline, em segundos. */
const passo = (ordem: number) => 0.45 + ordem * 0.32;

/**
 * Duas conversas, uma cota.
 *
 * É a única coisa desta página que as pessoas assumem ao contrário, e a
 * versão anterior (dois fios desembocando numa barra de 6%) dizia isso tão mal
 * que precisava do texto para ser entendida. Aqui o desenho diz sozinho:
 *
 * - duas conversas lado a lado, cada uma com os próprios pedidos: o histórico
 *   é separado;
 * - embaixo, uma grade de 100 casas, que é o mês inteiro;
 * - cada pedido que aparece numa conversa acende a PRÓXIMA casa da mesma
 *   grade, na cor do canal de onde veio. As duas cores se misturam numa conta
 *   só.
 *
 * Uma grade e não uma barra porque a unidade é o pedido: 6 casas acesas de 100
 * se contam com o olho, e 6% de uma barra é um risco que ninguém lê. No
 * desktop ela é uma faixa de 50 por 2, para as casas ficarem pequenas; em 25
 * por 4 cada casa tinha quase 4rem e a grade pesava mais que as conversas.
 *
 * A montagem acompanha a rolagem, curta, enquanto o cartão entra na tela.
 */
export function CotaCompartilhada() {
  const { ref, armado } = useVisibilidade<HTMLDivElement>();
  const { progress } = useScrollProgress(ref, {
    start: "top 88%",
    end: "top 30%",
  });
  const [valores, definir] = useValores({ usados: USADOS });

  useCena(
    ref,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(ref);

      tl.fromTo(
        q(".cota-conversa"),
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: "power3.out",
          stagger: 0.1,
        },
        0,
      ).fromTo(
        q(".cota-grade"),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.4 },
        0.15,
      );

      PEDIDOS_DO_MES.forEach((_, ordem) => {
        const em = passo(ordem);
        tl.fromTo(
          q(`.cota-pedido-${ordem}`),
          { autoAlpha: 0, y: 10, scale: 0.94 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.35,
            ease: "back.out(1.8)",
          },
          em,
        ).fromTo(
          q(`.cota-luz-${ordem}`),
          { scale: 0.2, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(2.4)" },
          em + 0.12,
        );
      });

      acompanhar((tempo) => {
        let acesos = 0;
        while (acesos < USADOS && tempo >= passo(acesos) + 0.12) acesos += 1;
        definir({ usados: acesos });
      });

      return () => definir({ usados: USADOS });
    },
    { armado, progresso: progress },
  );

  return (
    <div
      ref={ref}
      className="rounded-[1.75rem] border border-[var(--app-card-border)] bg-[var(--app-surface)] p-6 md:p-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
        <div>
          <p className="[font-family:var(--font-hanken)] text-xl font-semibold text-[var(--app-text)] md:text-2xl">
            Duas conversas, uma cota só
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">
            O que você conversa no WhatsApp não se mistura com o que você
            conversa dentro da {APP_NAME}. O limite do mês, sim, é o mesmo para
            os dois.
          </p>
        </div>
        <p className="shrink-0 [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text-muted)] [font-variant-numeric:tabular-nums]">
          <span className="sr-only">
            {valores.usados} de {LIMITE} usados no mês
          </span>
          <span aria-hidden="true">
            <NumberFlow
              value={valores.usados}
              className="text-2xl font-semibold text-[var(--app-text)]"
            />{" "}
            de {LIMITE} no mês
          </span>
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(["whatsapp", "app"] as const).map((canal) => (
          <Conversa key={canal} canal={canal} />
        ))}
      </div>

      <div className="cota-grade mt-6">
        <div
          aria-hidden="true"
          className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-1 md:grid-cols-[repeat(50,minmax(0,1fr))]"
        >
          {Array.from({ length: LIMITE }, (_, i) => {
            const pedido = PEDIDOS_DO_MES[i];
            return (
              <span
                key={i}
                className="relative aspect-square rounded-[2px] bg-[var(--app-text)]/[0.07]"
              >
                {pedido ? (
                  <span
                    className={cn(
                      `cota-luz-${i} absolute inset-0 rounded-[2px]`,
                      CANAIS[pedido.canal].casa,
                    )}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--app-text-muted)]">
          {(["whatsapp", "app"] as const).map((canal) => (
            <span key={canal} className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 rounded-[2px]", CANAIS[canal].casa)}
              />
              {CANAIS[canal].nome}
            </span>
          ))}
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-[2px] bg-[var(--app-text)]/[0.12]"
            />
            Livre
          </span>
        </div>
      </div>
    </div>
  );
}

/** Uma das conversas, com os pedidos que saíram dela. */
function Conversa({ canal }: { canal: Canal }) {
  const { onde, bolha, casa } = CANAIS[canal];
  const pedidos = PEDIDOS_DO_MES.flatMap((pedido, ordem) =>
    pedido.canal === canal ? [{ ...pedido, ordem }] : [],
  );

  return (
    <div className="cota-conversa rounded-2xl border border-[var(--app-card-border)] bg-[var(--app-bg)]/60 p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-[var(--app-text-muted)]">
        <span
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-[2px]", casa)}
        />
        {onde}
        <span className="ml-auto [font-family:var(--font-jetbrains-mono)] [font-variant-numeric:tabular-nums]">
          {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
        </span>
      </p>
      <ul className="mt-3 flex flex-col items-end justify-end gap-1.5 sm:min-h-[9.5rem]">
        {pedidos.map((pedido) => (
          <li
            key={pedido.ordem}
            className={cn(
              `cota-pedido-${pedido.ordem} max-w-full truncate rounded-2xl rounded-br-md px-3 py-1.5 text-[13px]`,
              bolha,
            )}
          >
            {pedido.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
