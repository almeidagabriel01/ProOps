"use client";

import React from "react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  type AnimationPlaybackControls,
} from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { cn } from "@/lib/utils";

import {
  deslocamento,
  estiloDaLinha,
  indiceNaPosicao,
  posicaoDeParada,
  posicaoMaisProxima,
  raioParaAltura,
} from "./roda-math";

export interface ItemDaRoda {
  id: string;
  rotulo: string;
}

interface RodaDePedidosProps {
  itens: ItemDaRoda[];
  indice: number;
  aoEscolher: (indice: number) => void;
  /** Nome acessível da lista. */
  rotulo: string;
  className?: string;
}

/** Altura de uma linha, em px. A geometria inteira deriva dela. */
const ALTURA = 44;
/** Linhas acima e abaixo da lente que cabem na caixa. */
const LINHAS_NA_CAIXA = 7;
const RAIO = raioParaAltura(ALTURA);
/** Menos que isto de movimento entre apertar e soltar é um toque, não arrasto. */
const LIMIAR_DE_ARRASTO = 4;

/** A mola do encaixe: firme, com um assentamento quase imperceptível. */
const MOLA = {
  type: "spring",
  stiffness: 260,
  damping: 32,
  mass: 0.9,
} as const;

/**
 * O seletor em roda do iOS, com os pedidos que a pessoa pode fazer.
 *
 * ── Duas camadas, como no sistema ──────────────────────────────────────────
 *
 * O cilindro é desenhado uma vez, em cor apagada. A lente no centro guarda uma
 * SEGUNDA cópia das frases, plana e em cor cheia, recortada pela própria
 * lente. Enquanto a roda gira as duas se movem juntas, e a frase acende
 * exatamente ao cruzar a borda da lente, sem nenhuma transição de cor. É o que
 * o UIPickerView faz, e é o detalhe que separa uma roda de uma lista rolando.
 *
 * ── Nenhum re-render por quadro ────────────────────────────────────────────
 *
 * A posição é um `MotionValue`. Um único ouvinte escreve `transform` e
 * `opacity` direto nos elementos, então arrastar não passa pelo React. O
 * `style` do JSX só carrega a posição inicial, calculada a partir do índice com
 * que a roda NASCEU: se ele acompanhasse o índice atual, o React reescreveria
 * as linhas a cada troca e brigaria com a animação.
 *
 * ── A roda do mouse fica livre de propósito ───────────────────────────────
 *
 * A página inteira rola com Lenis. Capturar `wheel` aqui prenderia a rolagem da
 * página sempre que o cursor passasse sobre a roda, que é justamente o caminho
 * de quem só está descendo. Arrasto, toque e teclado bastam.
 */
export function RodaDePedidos({
  itens,
  indice,
  aoEscolher,
  rotulo,
  className,
}: RodaDePedidosProps) {
  const total = itens.length;
  const idBase = React.useId();
  const reduzido = useReducedMotion();
  const [indiceInicial] = React.useState(indice);

  const posicao = useMotionValue(indiceInicial);
  const alvo = React.useRef(indiceInicial);
  const linhas = React.useRef<(HTMLDivElement | null)[]>([]);
  const nitidas = React.useRef<(HTMLSpanElement | null)[]>([]);
  const animacao = React.useRef<AnimationPlaybackControls | null>(null);
  const arrasto = React.useRef<{
    id: number;
    inicioY: number;
    inicioPosicao: number;
    ultimoY: number;
    ultimoT: number;
    velocidade: number;
    moveu: boolean;
    /** A linha sob o dedo no começo. Com captura, o `pointerup` não a traz. */
    tocado: number | null;
  } | null>(null);

  const pintar = React.useCallback(
    (p: number) => {
      for (let i = 0; i < total; i += 1) {
        const d = deslocamento(i, p, total);
        const linha = linhas.current[i];
        if (linha) {
          const estilo = estiloDaLinha(d, RAIO);
          linha.style.transform = estilo.transform;
          linha.style.opacity = String(estilo.opacity);
          linha.style.pointerEvents = estilo.visivel ? "" : "none";
        }
        const nitida = nitidas.current[i];
        if (nitida) {
          nitida.style.transform = `translateY(${(d * ALTURA).toFixed(2)}px)`;
          nitida.style.opacity = Math.abs(d) < 1.5 ? "1" : "0";
        }
      }
    },
    [total],
  );

  useMotionValueEvent(posicao, "change", pintar);

  const irPara = React.useCallback(
    (destino: number, velocidade = 0) => {
      alvo.current = destino;
      animacao.current?.stop();
      animacao.current = reduzido
        ? animate(posicao, destino, { duration: 0 })
        : animate(posicao, destino, { ...MOLA, velocity: velocidade });
    },
    [posicao, reduzido],
  );

  // O índice vem de fora (revezamento, teclado, toque). Se a roda já está a
  // caminho dele, não há o que fazer: recomeçar a mola do zero aqui mataria a
  // velocidade de um arremesso que acabou de ser solto.
  React.useEffect(() => {
    if (arrasto.current) return;
    if (indiceNaPosicao(alvo.current, total) === indice) return;
    irPara(posicaoMaisProxima(posicao.get(), indice, total));
  }, [indice, total, irPara, posicao]);

  React.useEffect(() => () => animacao.current?.stop(), []);

  function aoApertar(evento: React.PointerEvent<HTMLDivElement>) {
    if (evento.button !== 0) return;
    const linha = (evento.target as HTMLElement).closest<HTMLElement>(
      "[data-indice]",
    );
    evento.currentTarget.setPointerCapture(evento.pointerId);
    animacao.current?.stop();
    arrasto.current = {
      id: evento.pointerId,
      inicioY: evento.clientY,
      inicioPosicao: posicao.get(),
      ultimoY: evento.clientY,
      ultimoT: evento.timeStamp,
      velocidade: 0,
      moveu: false,
      tocado: linha ? Number(linha.dataset.indice) : null,
    };
  }

  function aoMover(evento: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a || a.id !== evento.pointerId) return;
    const dy = evento.clientY - a.inicioY;
    if (Math.abs(dy) > LIMIAR_DE_ARRASTO) a.moveu = true;
    if (!a.moveu) return;
    posicao.set(a.inicioPosicao - dy / ALTURA);

    const dt = evento.timeStamp - a.ultimoT;
    if (dt > 0) {
      const instantanea =
        -((evento.clientY - a.ultimoY) / ALTURA) / (dt / 1000);
      // Média móvel: um único evento lento no fim do gesto não pode zerar a
      // velocidade de um arremesso inteiro.
      a.velocidade = a.velocidade * 0.6 + instantanea * 0.4;
    }
    a.ultimoY = evento.clientY;
    a.ultimoT = evento.timeStamp;
  }

  function aoSoltar(evento: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a || a.id !== evento.pointerId) return;
    arrasto.current = null;

    if (!a.moveu) {
      const tocado = a.tocado ?? indice;
      irPara(posicaoMaisProxima(posicao.get(), tocado, total));
      aoEscolher(tocado);
      return;
    }

    // Um arremesso parado no ar há mais de 80ms não tem velocidade nenhuma.
    const velocidade = evento.timeStamp - a.ultimoT > 80 ? 0 : a.velocidade;
    const parada = posicaoDeParada(posicao.get(), velocidade);
    irPara(parada, velocidade);
    aoEscolher(indiceNaPosicao(parada, total));
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const destinos: Record<string, number> = {
      ArrowDown: (indice + 1) % total,
      ArrowUp: (indice - 1 + total) % total,
      Home: 0,
      End: total - 1,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    aoEscolher(destinos[evento.key]);
  }

  const altura = ALTURA * LINHAS_NA_CAIXA;

  return (
    <div
      className={cn("relative select-none", className)}
      style={{ height: altura }}
    >
      <div
        role="listbox"
        tabIndex={0}
        aria-label={rotulo}
        aria-activedescendant={`${idBase}-${indice}`}
        onKeyDown={aoTeclar}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60 active:cursor-grabbing"
      >
        {/* A faixa da lente é recortada do cilindro. Sem o recorte, a linha
            apagada aparecia por trás do vidro translúcido, um pixel fora da
            cópia nítida, e a frase do centro lia como texto duplicado. */}
        <div
          style={{
            maskImage: `linear-gradient(180deg, #000 calc(50% - ${ALTURA / 2}px), transparent calc(50% - ${ALTURA / 2}px), transparent calc(50% + ${ALTURA / 2}px), #000 calc(50% + ${ALTURA / 2}px))`,
          }}
          className="absolute inset-0 [perspective:1000px]"
        >
          <div className="absolute inset-x-0 top-1/2 h-0 [transform-style:preserve-3d]">
            {itens.map((item, i) => {
              const inicial = estiloDaLinha(
                deslocamento(i, indiceInicial, total),
                RAIO,
              );
              return (
                <div
                  key={item.id}
                  id={`${idBase}-${i}`}
                  ref={(el) => {
                    linhas.current[i] = el;
                  }}
                  role="option"
                  aria-selected={i === indice}
                  data-indice={i}
                  style={{
                    height: ALTURA,
                    marginTop: -ALTURA / 2,
                    transform: inicial.transform,
                    opacity: inicial.opacity,
                    pointerEvents: inicial.visivel ? undefined : "none",
                  }}
                  className="absolute inset-x-0 flex items-center justify-center px-6 text-[15px] text-[var(--app-text-muted)] [backface-visibility:hidden] will-change-transform"
                >
                  <span className="truncate">{item.rotulo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* A lente. Plana, recortada, e com a cópia nítida das frases dentro. */}
      <div
        aria-hidden="true"
        style={{ height: ALTURA, marginTop: -ALTURA / 2 }}
        className="pointer-events-none absolute inset-x-2 top-1/2 overflow-hidden rounded-2xl bg-[var(--app-text)]/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.35)]"
      >
        {itens.map((item, i) => {
          const d = deslocamento(i, indiceInicial, total);
          return (
            <span
              key={item.id}
              ref={(el) => {
                nitidas.current[i] = el;
              }}
              style={{
                transform: `translateY(${d * ALTURA}px)`,
                opacity: Math.abs(d) < 1.5 ? 1 : 0,
              }}
              className="absolute inset-0 flex items-center justify-center px-4 text-[15px] font-medium text-[var(--app-text)] will-change-transform"
            >
              <span className="truncate">{item.rotulo}</span>
            </span>
          );
        })}
      </div>

      {/* As bordas do cilindro somem na superfície, como a roda some na
          moldura do sistema. Sem isso as linhas de 80° pareciam cortadas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-t-[1.75rem] bg-[linear-gradient(180deg,var(--app-surface),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-[1.75rem] bg-[linear-gradient(0deg,var(--app-surface),transparent)]"
      />
    </div>
  );
}
