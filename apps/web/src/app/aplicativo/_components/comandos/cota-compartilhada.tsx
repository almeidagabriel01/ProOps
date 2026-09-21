"use client";

import React from "react";
import gsap from "gsap";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { APP_NAME } from "@/lib/site/app-brand";
import { cn } from "@/lib/utils";

import { Contagem, useValores } from "./cenas/pecas-da-cena";
import { useCena } from "./use-cena";
import { useVisibilidade } from "./use-visibilidade";

const LIMITE = 100;

type Canal = "whatsapp" | "app";

/**
 * Os pedidos do mês, na ordem em que foram feitos.
 *
 * A ordem intercala os canais de propósito: é ela que faz as marcas acesas do
 * mostrador saírem misturadas, e não em dois blocos, que pareceriam duas
 * cotas.
 */
const PEDIDOS_DO_MES: Canal[] = [
  "whatsapp",
  "app",
  "app",
  "whatsapp",
  "app",
  "app",
];

const USADOS = PEDIDOS_DO_MES.length;

const CANAIS: {
  id: Canal;
  nome: string;
  cor: string;
  traco: string;
  exemplo: string;
}[] = [
  {
    id: "whatsapp",
    nome: "No WhatsApp",
    cor: "bg-[var(--app-tint)]",
    traco: "var(--app-tint)",
    exemplo: "gastei 45 no mercado",
  },
  {
    id: "app",
    nome: `Dentro da ${APP_NAME}`,
    cor: "bg-[var(--app-text)]/70",
    traco: "var(--app-text)",
    exemplo: "paguei a fatura do cartão",
  },
];

const RAIO_INTERNO = 74;
const RAIO_EXTERNO = 88;
const CAIXA = 200;

/** Quando cada marca acende, em segundos de timeline. */
const passo = (ordem: number) => 0.5 + ordem * 0.22;

/**
 * Duas conversas, uma cota.
 *
 * Terceira tentativa, e as duas anteriores erraram pelo mesmo motivo: contavam
 * a separação das conversas com MAIS coisa na tela (dois fios que se juntavam
 * numa barra; depois duas conversas de mentira e uma grade de cem quadradinhos
 * com legenda). O que se quer dizer é uma frase só, e ela é sobre CONTAGEM.
 *
 * Aqui o mostrador é a peça, e é literal: cem marcas em volta, uma por pedido
 * do mês, e as seis já usadas acesas na cor do canal de onde vieram. Como a
 * escala é o mês inteiro, "6 de 100" se lê de longe, sem legenda e sem
 * porcentagem. Os dois canais aparecem ao lado como duas linhas, com um
 * exemplo do que cada um recebeu: é o que diz que os históricos são separados.
 *
 * O número grande usa `Contagem`, e não `Moeda`: aqui a unidade é pedido, não
 * real.
 */
export function CotaCompartilhada() {
  const { ref, armado } = useVisibilidade<HTMLDivElement>();
  const { progress } = useScrollProgress(ref, {
    start: "top 88%",
    end: "top 34%",
  });
  const [valores, definir] = useValores({ usados: USADOS });

  useCena(
    ref,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(ref);

      tl.fromTo(
        q(".cota-mostrador"),
        { autoAlpha: 0, scale: 0.94, transformOrigin: "50% 50%" },
        { autoAlpha: 1, scale: 1, duration: 0.7, ease: "expo.out" },
        0,
      )
        .fromTo(
          q(".cota-canal"),
          { autoAlpha: 0, x: -12 },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.12,
          },
          0.2,
        )
        .fromTo(
          q(".cota-livre"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.5 },
          1.4,
        );

      PEDIDOS_DO_MES.forEach((_, ordem) => {
        tl.fromTo(
          q(`.cota-marca-${ordem}`),
          { scale: 0.2, autoAlpha: 0, transformOrigin: "50% 50%" },
          { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(2.6)" },
          passo(ordem),
        );
      });

      acompanhar((tempo) => {
        let acesas = 0;
        while (acesas < USADOS && tempo >= passo(acesas)) acesas += 1;
        definir({ usados: acesas });
      });

      return () => definir({ usados: USADOS });
    },
    { armado, progresso: progress },
  );

  return (
    <div
      ref={ref}
      className="grid gap-8 rounded-[1.75rem] border border-[var(--app-card-border)] bg-[var(--app-surface)] p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-12 md:p-8"
    >
      <div>
        <p className="[font-family:var(--font-hanken)] text-xl font-semibold text-[var(--app-text)] md:text-2xl">
          Duas conversas, uma cota só
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">
          Cada lugar guarda o próprio histórico: o que você fala no WhatsApp não
          aparece na conversa do aplicativo, e vice-versa. O limite mensal de
          pedidos, esse, é um só para os dois.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {CANAIS.map((canal) => {
            const quantos = PEDIDOS_DO_MES.filter((c) => c === canal.id).length;
            return (
              <li
                key={canal.id}
                className="cota-canal flex items-center gap-3 border-t border-white/[0.06] pt-3"
              >
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", canal.cor)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--app-text)]">
                    {canal.nome}
                  </span>
                  <span className="block truncate text-xs text-[var(--app-text-muted)]">
                    “{canal.exemplo}”
                  </span>
                </span>
                <span className="shrink-0 [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-text-muted)] [font-variant-numeric:tabular-nums]">
                  {quantos} {quantos === 1 ? "pedido" : "pedidos"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Mostrador usados={valores.usados} />
    </div>
  );
}

/**
 * O mês inteiro em cem marcas, com as usadas acesas.
 *
 * As marcas são desenhadas em volta de um círculo, começando no topo. Uma
 * barra de progresso mostraria 6% como um risco; cem marcas mostram seis
 * marcas, que é a unidade em que a cota é contada e cobrada.
 */
/**
 * As cem marcas do mostrador, já em coordenadas do desenho.
 *
 * Arredondadas, e isto é obrigatório: `Math.cos`/`Math.sin` não são exigidos
 * pelo padrão a devolver o mesmo último dígito em implementações diferentes, e
 * o V8 do servidor e o do navegador discordavam na 15ª casa
 * ("35.1533056767541" contra "35.153305676754115"). Cada marca virava um
 * desencontro de hidratação: noventa e poucos avisos no console por uma casa
 * decimal que não move um pixel.
 */
export function marcasDoMostrador(): {
  i: number;
  canal?: Canal;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}[] {
  return Array.from({ length: LIMITE }, (_, i) => {
    const angulo = ((i * 360) / LIMITE - 90) * (Math.PI / 180);
    const ponto = (raio: number, eixo: "cos" | "sin") =>
      Number((CAIXA / 2 + Math[eixo](angulo) * raio).toFixed(2));
    return {
      i,
      canal: PEDIDOS_DO_MES[i],
      x1: ponto(RAIO_INTERNO, "cos"),
      y1: ponto(RAIO_INTERNO, "sin"),
      x2: ponto(RAIO_EXTERNO, "cos"),
      y2: ponto(RAIO_EXTERNO, "sin"),
    };
  });
}

function Mostrador({ usados }: { usados: number }) {
  const marcas = marcasDoMostrador();

  return (
    <div className="cota-mostrador relative mx-auto aspect-square w-52 shrink-0 md:w-60">
      <svg
        viewBox={`0 0 ${CAIXA} ${CAIXA}`}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        {marcas.map((marca) => (
          <line
            key={marca.i}
            className={marca.canal ? `cota-marca-${marca.i}` : undefined}
            x1={marca.x1}
            y1={marca.y1}
            x2={marca.x2}
            y2={marca.y2}
            stroke={
              marca.canal
                ? CANAIS.find((c) => c.id === marca.canal)!.traco
                : "var(--app-text)"
            }
            strokeOpacity={
              marca.canal ? (marca.canal === "app" ? 0.7 : 1) : 0.1
            }
            strokeWidth={marca.canal ? 3.4 : 2.2}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="[font-family:var(--font-jetbrains-mono)] text-4xl font-semibold leading-none text-[var(--app-text)] [font-variant-numeric:tabular-nums] md:text-5xl">
          <Contagem valor={usados} />
        </p>
        <p className="mt-1.5 text-xs text-[var(--app-text-muted)]">
          de {LIMITE} pedidos no mês
        </p>
        <p className="cota-livre mt-3 rounded-full bg-[var(--app-tint)]/[0.12] px-3 py-1 text-xs font-medium text-[var(--app-tint)]">
          {LIMITE - USADOS} livres
        </p>
      </div>
    </div>
  );
}
