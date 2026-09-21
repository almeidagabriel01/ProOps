"use client";

import React from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/dist/DrawSVGPlugin";

import { cn } from "@/lib/utils";

import { useCena } from "../use-cena";
import { Moeda, Rotulo, useValores } from "./pecas-da-cena";
import {
  ATE_HOJE,
  A_VISTA,
  CAIXA,
  DIAS_DO_MES,
  HOJE,
  MARGEM,
  PRECO,
  SEM_COMPRAR,
  SOBRA_EM_10X,
  area,
  caminho,
  diasNoVermelho,
  eixoX,
  eixoY,
} from "./simulacao-serie";
import type { PropsDaCena } from "./tipos";

if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin);
}

const SOBRA_SEM = SEM_COMPRAR[SEM_COMPRAR.length - 1];
const SOBRA_A_VISTA = A_VISTA[A_VISTA.length - 1];
const DIAS_VERMELHOS = diasNoVermelho(A_VISTA);
const PRECO_TEXTO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(PRECO);

/** As linhas de referência do eixo, nos valores que significam alguma coisa. */
const REFERENCIAS = [3000, 0, -3000];

/** Posição em % da caixa, para os rótulos em HTML acompanharem o desenho. */
const pct = (x: number, y: number) => ({
  left: `${(x / CAIXA.largura) * 100}%`,
  top: `${(y / CAIXA.altura) * 100}%`,
});

/**
 * "posso comprar um celular de 3 mil?".
 *
 * A primeira versão era duas curvas e dois rótulos, e não dizia a coisa que
 * importa: a compra não é um número menor no fim do mês, é um buraco no meio
 * dele. Esta mostra o mês inteiro:
 *
 * - o que já aconteceu até hoje, com os lançamentos marcados na linha;
 * - a queda de R$ 3.000,00 no dia da compra, com o valor escrito na queda;
 * - a faixa em que a projeção fica ABAIXO de zero, hachurada, com quantos dias
 *   são (contados da série, não escritos à mão);
 * - os três desfechos possíveis lado a lado, com o de 10x marcado como o que
 *   cabe no mês.
 *
 * A série vive em `simulacao-serie.ts`: a queda vale o preço e a sobra final
 * bate com a da ficha porque são a mesma conta, não dois números digitados.
 *
 * O desenho mantém a proporção (`preserveAspectRatio` no padrão) porque tem
 * círculos: esticado, as pontas e os lançamentos virariam elipses. A caixa
 * usa a mesma proporção do `viewBox`, então não sobra margem. Os rótulos são
 * HTML posicionado em porcentagem das mesmas coordenadas, porque texto dentro
 * do SVG não herda a tipografia da página.
 */
export function CenaSimulacao({ armado, progresso, tocar }: PropsDaCena) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [valores, definir] = useValores({
    sem: SOBRA_SEM,
    vista: SOBRA_A_VISTA,
    dezVezes: SOBRA_EM_10X,
  });

  useCena(
    raiz,
    (tl, { acompanhar }) => {
      const q = gsap.utils.selector(raiz);

      tl.fromTo(
        q(".sim-grade"),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.4, stagger: 0.06 },
        0,
      )
        .fromTo(
          q(".sim-ate-hoje"),
          { drawSVG: "0%" },
          { drawSVG: "100%", duration: 1.1, ease: "power2.inOut" },
          0.2,
        )
        .fromTo(
          q(".sim-area-passado"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.5 },
          0.8,
        )
        .fromTo(
          q(".sim-lancamento"),
          { scale: 0, transformOrigin: "50% 50%" },
          { scale: 1, duration: 0.3, ease: "back.out(2.6)", stagger: 0.05 },
          0.5,
        )
        .fromTo(
          q(".sim-hoje"),
          { autoAlpha: 0, y: -6 },
          { autoAlpha: 1, y: 0, duration: 0.4 },
          1.2,
        )
        // A compra: a ficha do celular desce até a linha e a puxa para baixo.
        .fromTo(
          q(".sim-compra"),
          { autoAlpha: 0, y: -26 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
          1.5,
        )
        .fromTo(
          q(".sim-queda"),
          { drawSVG: "0%" },
          { drawSVG: "100%", duration: 0.5, ease: "power2.in" },
          1.9,
        )
        .fromTo(
          q(".sim-sem-comprar"),
          { drawSVG: "0%" },
          { drawSVG: "100%", duration: 1, ease: "power2.inOut" },
          2.2,
        )
        .fromTo(
          q(".sim-a-vista"),
          { drawSVG: "0%" },
          { drawSVG: "100%", duration: 1, ease: "power2.inOut" },
          2.4,
        )
        .fromTo(
          q(".sim-area-vermelha"),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.6 },
          3,
        )
        .fromTo(
          q(".sim-vermelho-rotulo"),
          { autoAlpha: 0, x: -8 },
          { autoAlpha: 1, x: 0, duration: 0.5, ease: "power3.out" },
          3.2,
        )
        .fromTo(
          q(".sim-ponta"),
          { scale: 0.4, autoAlpha: 0, transformOrigin: "50% 50%" },
          {
            scale: 1,
            autoAlpha: 1,
            duration: 0.45,
            ease: "back.out(2.4)",
            stagger: 0.12,
          },
          3.2,
        )
        .fromTo(
          q(".sim-cenario"),
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.12,
          },
          3.5,
        );

      acompanhar((tempo) =>
        definir({
          sem: tempo >= 3.4 ? SOBRA_SEM : 0,
          vista: tempo >= 3.6 ? SOBRA_A_VISTA : 0,
          dezVezes: tempo >= 3.9 ? SOBRA_EM_10X : 0,
        }),
      );

      return () =>
        definir({
          sem: SOBRA_SEM,
          vista: SOBRA_A_VISTA,
          dezVezes: SOBRA_EM_10X,
        });
    },
    { armado, progresso, tocar },
  );

  const xHoje = eixoX(HOJE);

  return (
    <div ref={raiz} className="flex h-full flex-col justify-between gap-4">
      <div
        className="relative w-full flex-1"
        style={{ aspectRatio: `${CAIXA.largura} / ${CAIXA.altura}` }}
      >
        <svg
          viewBox={`0 0 ${CAIXA.largura} ${CAIXA.altura}`}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="sim-verde" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--app-tint)"
                stopOpacity="0.26"
              />
              <stop offset="100%" stopColor="var(--app-tint)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sim-neutro" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--app-text)"
                stopOpacity="0.16"
              />
              <stop offset="100%" stopColor="var(--app-text)" stopOpacity="0" />
            </linearGradient>
            {/* Hachura: o vermelho chapado competia com a linha; o risco diz
                "zona ruim" sem virar um bloco de cor no meio do gráfico. */}
            <pattern
              id="sim-hachura"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="var(--app-danger)"
                strokeOpacity="0.45"
                strokeWidth="1.4"
              />
            </pattern>
          </defs>

          {REFERENCIAS.map((valor) => (
            <line
              key={valor}
              className="sim-grade"
              x1={MARGEM.esquerda}
              x2={CAIXA.largura - MARGEM.direita}
              y1={eixoY(valor)}
              y2={eixoY(valor)}
              stroke={valor === 0 ? "var(--app-separator)" : "var(--app-text)"}
              strokeOpacity={valor === 0 ? 0.9 : 0.08}
              strokeDasharray={valor === 0 ? "4 4" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path
            className="sim-area-passado"
            d={area(ATE_HOJE, 1, -2300)}
            fill="url(#sim-neutro)"
          />
          <path
            className="sim-area-verde"
            d={area(SEM_COMPRAR, HOJE, -2300)}
            fill="url(#sim-verde)"
            opacity={0.85}
          />
          <path
            className="sim-area-vermelha"
            d={area(A_VISTA, HOJE, 0)}
            fill="url(#sim-hachura)"
          />

          <path
            className="sim-ate-hoje"
            d={caminho(ATE_HOJE, 1)}
            fill="none"
            stroke="var(--app-text)"
            strokeOpacity={0.85}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="sim-sem-comprar"
            d={caminho(SEM_COMPRAR, HOJE)}
            fill="none"
            stroke="var(--app-tint)"
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="sim-queda"
            d={`M${xHoje} ${eixoY(SEM_COMPRAR[0])} L${xHoje} ${eixoY(A_VISTA[0])}`}
            fill="none"
            stroke="var(--app-danger)"
            strokeWidth={2.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="sim-a-vista"
            d={caminho(A_VISTA, HOJE)}
            fill="none"
            stroke="var(--app-danger)"
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Os lançamentos que já aconteceram, nos dias em que o saldo deu um
              passo maior. Eles são o que faz a linha parecer um extrato. */}
          {[3, 6, 9, 13].map((dia) => (
            <circle
              key={dia}
              className="sim-lancamento"
              cx={eixoX(dia)}
              cy={eixoY(ATE_HOJE[dia - 1])}
              r={2.6}
              fill="var(--app-bg)"
              stroke="var(--app-text)"
              strokeOpacity={0.6}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <line
            className="sim-hoje"
            x1={xHoje}
            x2={xHoje}
            y1={MARGEM.topo}
            y2={CAIXA.altura - MARGEM.base}
            stroke="var(--app-text)"
            strokeOpacity={0.18}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />

          <circle
            className="sim-ponta"
            cx={eixoX(DIAS_DO_MES)}
            cy={eixoY(SOBRA_SEM)}
            r={4}
            fill="var(--app-tint)"
          />
          <circle
            className="sim-ponta"
            cx={eixoX(DIAS_DO_MES)}
            cy={eixoY(SOBRA_A_VISTA)}
            r={4}
            fill="var(--app-danger)"
          />
        </svg>

        {/* Os valores do eixo, o "hoje" e a etiqueta da compra. */}
        {REFERENCIAS.map((valor) => (
          <span
            key={valor}
            style={{ ...pct(0, eixoY(valor)), transform: "translateY(-50%)" }}
            className="sim-grade absolute [font-family:var(--font-jetbrains-mono)] text-[10px] text-[var(--app-text-muted)]"
          >
            {valor === 0
              ? "R$ 0"
              : `${valor > 0 ? "" : "-"}${Math.abs(valor) / 1000}k`}
          </span>
        ))}

        <span
          style={{
            ...pct(xHoje, MARGEM.topo),
            transform: "translate(6px,-2px)",
          }}
          className="sim-hoje absolute text-[11px] text-[var(--app-text-muted)]"
        >
          hoje
        </span>
        <span
          style={{
            ...pct(eixoX(1), CAIXA.altura - 10),
            transform: "translateY(-50%)",
          }}
          className="sim-grade absolute text-[10px] text-[var(--app-text-muted)]"
        >
          dia 1
        </span>
        <span
          style={{
            ...pct(eixoX(DIAS_DO_MES), CAIXA.altura - 10),
            transform: "translate(-100%,-50%)",
          }}
          className="sim-grade absolute whitespace-nowrap text-[10px] text-[var(--app-text-muted)]"
        >
          dia 30
        </span>

        {/* A compra, escrita na própria queda. */}
        <span
          style={{
            ...pct(xHoje, eixoY(SEM_COMPRAR[0])),
            transform: "translate(-108%,-120%)",
          }}
          className="sim-compra absolute flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--app-danger)]/40 bg-[var(--app-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-danger)] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.9)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={1.8}
            className="h-3 w-3 stroke-current"
          >
            <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
            <path d="M10.5 18.6h3" strokeLinecap="round" />
          </svg>
          Celular, -{PRECO_TEXTO}
        </span>

        <span
          style={{
            // Dentro da faixa hachurada e ACIMA da curva vermelha, que desce
            // para a direita: no meio da faixa o rótulo cruzava a linha.
            ...pct(eixoX(HOJE + 3), eixoY(-500)),
            transform: "translateY(-50%)",
          }}
          className="sim-vermelho-rotulo absolute hidden whitespace-nowrap rounded-full bg-[var(--app-danger)]/[0.16] px-2.5 py-1 text-[11px] font-medium text-[var(--app-danger)] sm:block"
        >
          {DIAS_VERMELHOS} dias no vermelho
        </span>
      </div>

      {/* Os três desfechos, comparáveis.

          Lado a lado só de `sm` para cima. Num celular a coluna do palco tem
          ~270px, então cada cartão ficava com 63px úteis, e "-R$ 1.715,10" em
          mono a 13px pede ~94: o valor saía cortado pela borda, que é o
          sintoma que se via. Encolher a fonte não resolve (a 11px ainda são
          ~79px), então abaixo de `sm` os três viram linhas de largura inteira,
          com o rótulo à esquerda e o valor à direita. A comparação continua
          existindo, lida de cima para baixo em vez de lado a lado. */}
      <div className="grid gap-1.5 sm:grid-cols-3 sm:gap-2 md:gap-3">
        <Cenario
          rotulo="Não comprar"
          valor={valores.sem}
          tom="tint"
          nota="sobra do mês"
        />
        <Cenario
          rotulo="Em 10x"
          valor={valores.dezVezes}
          tom="tint"
          nota="cabe no mês"
          destacado
        />
        <Cenario
          rotulo="À vista"
          valor={valores.vista}
          tom="danger"
          nota={`${DIAS_VERMELHOS} dias negativos`}
        />
      </div>
    </div>
  );
}

function Cenario({
  rotulo,
  valor,
  tom,
  nota,
  destacado = false,
}: {
  rotulo: string;
  valor: number;
  tom: "tint" | "danger";
  nota: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "sim-cenario grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl border px-3 py-2 sm:block sm:px-2.5 md:px-3 md:py-2.5",
        destacado
          ? "border-[var(--app-tint)]/45 bg-[var(--app-tint)]/[0.07]"
          : "border-[var(--app-card-border)] bg-[var(--app-surface)]",
      )}
    >
      {/* A ordem no DOM é a do desktop (rótulo, valor, nota) e não muda: quem
          reposiciona no celular é a grade, e `sm:block` a desliga inteira,
          tornando as classes de linha e coluna inertes. */}
      <Rotulo className="col-start-1 row-start-1 truncate text-[11px] sm:text-[10px] md:text-[11px]">
        {rotulo}
      </Rotulo>
      <Moeda
        valor={valor}
        className={cn(
          "col-start-2 row-span-2 row-start-1 whitespace-nowrap text-sm font-semibold sm:mt-0.5 sm:block sm:text-[13px] md:text-base",
          tom === "danger"
            ? "text-[var(--app-danger)]"
            : "text-[var(--app-text)]",
        )}
      />
      <p className="col-start-1 row-start-2 truncate text-[10px] text-[var(--app-text-muted)] sm:mt-0.5">
        {nota}
      </p>
    </div>
  );
}
