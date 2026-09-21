"use client";

import React from "react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  type AnimationPlaybackControls,
  type MotionValue,
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

/**
 * A roda dirigida pela página: a posição vem da rolagem, e arrastar a roda
 * rola a página. Ausente, a roda é um controle comum, com mola própria.
 */
export interface RodaNaRolagem {
  posicao: MotionValue<number>;
  /** Pede à página a posição da roda sob o dedo, sem suavização. */
  aoArrastar: (posicao: number) => void;
}

interface RodaDePedidosProps {
  itens: ItemDaRoda[];
  indice: number;
  aoEscolher: (indice: number) => void;
  /** Nome acessível da lista. */
  rotulo: string;
  rolagem?: RodaNaRolagem;
  /** Inclui a altura: a geometria funciona com qualquer uma. */
  className?: string;
}

/** Altura de uma linha, em px. A geometria inteira deriva dela. */
const ALTURA = 44;
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
 * ── Dois modos ─────────────────────────────────────────────────────────────
 *
 * Na página, a roda é o próprio indicador da rolagem (`rolagem`): ela gira
 * junto com a página, e um arrasto nela move a página, então a roda e a leitura
 * ao lado nunca discordam. Nesse modo ela NÃO é circular, porque a rolagem tem
 * começo e fim, e mostrar a última frase acima da primeira prometeria uma
 * rolagem para cima que não existe.
 *
 * Sem `rolagem` (movimento reduzido), ela é um controle comum e circular, com
 * mola própria até o índice escolhido.
 *
 * ── Nenhum re-render por quadro ────────────────────────────────────────────
 *
 * A posição é um `MotionValue`. Um único ouvinte escreve `transform` e
 * `opacity` direto nos elementos, então girar não passa pelo React. O `style`
 * do JSX só carrega a posição inicial: se ele acompanhasse o índice atual, o
 * React reescreveria as linhas a cada troca e brigaria com a animação.
 *
 * ── A roda do mouse fica livre de propósito ───────────────────────────────
 *
 * Capturar `wheel` aqui prenderia a rolagem da página sempre que o cursor
 * passasse sobre a roda. No modo rolado isso nem faz falta: a roda do mouse já
 * gira a roda, porque rola a página.
 */
export function RodaDePedidos({
  itens,
  indice,
  aoEscolher,
  rotulo,
  rolagem,
  className,
}: RodaDePedidosProps) {
  const total = itens.length;
  const idBase = React.useId();
  const reduzido = useReducedMotion();
  const circular = !rolagem;
  const [indiceInicial] = React.useState(indice);

  const interna = useMotionValue(indiceInicial);
  const fonte = rolagem?.posicao ?? interna;
  const alvo = React.useRef(indiceInicial);
  const linhas = React.useRef<(HTMLDivElement | null)[]>([]);
  const nitidas = React.useRef<(HTMLSpanElement | null)[]>([]);
  const animacao = React.useRef<AnimationPlaybackControls | null>(null);
  const arrasto = React.useRef<{
    id: number;
    inicioY: number;
    inicioPosicao: number;
    posicao: number;
    ultimoY: number;
    ultimoT: number;
    velocidade: number;
    moveu: boolean;
    /** A linha sob o dedo no começo. Com captura, o `pointerup` não a traz. */
    tocado: number | null;
    /** Falso no dedo dentro da página: ali quem rola é o navegador. */
    arrastavel: boolean;
  } | null>(null);

  const distancia = React.useCallback(
    (i: number, p: number) => (circular ? deslocamento(i, p, total) : i - p),
    [circular, total],
  );

  const pintar = React.useCallback(
    (p: number) => {
      for (let i = 0; i < total; i += 1) {
        const d = distancia(i, p);
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
    [distancia, total],
  );

  useMotionValueEvent(fonte, "change", pintar);

  // A fonte pode trocar depois da hidratação (o modo rolado só se decide no
  // cliente), e o `change` só dispara na PRÓXIMA mudança: pinta já.
  React.useLayoutEffect(() => {
    pintar(fonte.get());
  }, [fonte, pintar]);

  const irPara = React.useCallback(
    (destino: number, velocidade = 0) => {
      alvo.current = destino;
      animacao.current?.stop();
      animacao.current = reduzido
        ? animate(interna, destino, { duration: 0 })
        : animate(interna, destino, { ...MOLA, velocity: velocidade });
    },
    [interna, reduzido],
  );

  // Só no modo controle: o índice vem de fora (teclado, toque), e a mola leva
  // a roda até ele. Se ela já está a caminho, recomeçar mataria a velocidade de
  // um arremesso que acabou de ser solto.
  React.useEffect(() => {
    if (rolagem || arrasto.current) return;
    if (indiceNaPosicao(alvo.current, total) === indice) return;
    irPara(posicaoMaisProxima(interna.get(), indice, total));
  }, [indice, total, irPara, interna, rolagem]);

  React.useEffect(() => () => animacao.current?.stop(), []);

  function aoApertar(evento: React.PointerEvent<HTMLDivElement>) {
    if (evento.button !== 0) return;
    const linha = (evento.target as HTMLElement).closest<HTMLElement>(
      "[data-indice]",
    );
    // No modo rolado, o DEDO não arrasta a roda: ele rola a página, e a página
    // gira a roda. Capturar o ponteiro aqui era o que fazia o palco tremer num
    // celular (ver o comentário do `touch-action` no JSX).
    const arrastavel = !(rolagem && evento.pointerType === "touch");
    if (arrastavel) evento.currentTarget.setPointerCapture(evento.pointerId);
    animacao.current?.stop();
    arrasto.current = {
      id: evento.pointerId,
      inicioY: evento.clientY,
      inicioPosicao: fonte.get(),
      posicao: fonte.get(),
      ultimoY: evento.clientY,
      ultimoT: evento.timeStamp,
      velocidade: 0,
      moveu: false,
      tocado: linha ? Number(linha.dataset.indice) : null,
      arrastavel,
    };
  }

  function aoMover(evento: React.PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (!a || a.id !== evento.pointerId) return;
    const dy = evento.clientY - a.inicioY;
    if (Math.abs(dy) > LIMIAR_DE_ARRASTO) a.moveu = true;
    if (!a.moveu) return;
    // O `moveu` acima continua valendo mesmo sem arrasto: é ele que impede um
    // deslize de virar escolha ao soltar.
    if (!a.arrastavel) return;
    a.posicao = a.inicioPosicao - dy / ALTURA;
    if (rolagem) rolagem.aoArrastar(a.posicao);
    else interna.set(a.posicao);

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
      if (!rolagem) irPara(posicaoMaisProxima(interna.get(), tocado, total));
      aoEscolher(tocado);
      return;
    }

    // Deslize de dedo no modo rolado: quem moveu a página foi o navegador, e a
    // roda já acompanhou. Não há arremesso a completar nem parada a calcular.
    if (!a.arrastavel) return;

    // Um arremesso parado no ar há mais de 80ms não tem velocidade nenhuma.
    const velocidade = evento.timeStamp - a.ultimoT > 80 ? 0 : a.velocidade;
    const parada = posicaoDeParada(a.posicao, velocidade);
    if (rolagem) {
      // A página faz o resto: ela leva a roda até a frase e a leitura junto.
      aoEscolher(Math.min(Math.max(parada, 0), total - 1));
      return;
    }
    irPara(parada, velocidade);
    aoEscolher(indiceNaPosicao(parada, total));
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const ultimo = total - 1;
    const destinos: Record<string, number> = {
      ArrowDown: circular ? (indice + 1) % total : Math.min(indice + 1, ultimo),
      ArrowUp: circular
        ? (indice - 1 + total) % total
        : Math.max(indice - 1, 0),
      Home: 0,
      End: ultimo,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    aoEscolher(destinos[evento.key]);
  }

  return (
    <div className={cn("relative h-[308px] select-none", className)}>
      {/* `touch-pan-y` no modo rolado, e isto é a correção de um defeito
          concreto: com `touch-action: none` a roda engolia todo toque que
          começasse em cima dela, que num celular é metade do palco. O dedo
          deixava de rolar a página e passava a dirigi-la por saltos, um por
          `pointermove`; e como `posicaoDaRoda` tem encaixe, a volta pela
          inversa não cai no mesmo ponto, então o primeiro movimento
          teleportava a página ~1000px e os seguintes andavam aos trancos de 4,
          8 e 16px, repetindo posição. Era isso que se via como tremor.

          No modo controle (movimento reduzido) o arrasto é o único jeito de
          girar a roda, então ali ele continua capturando o gesto. */}
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
        className={cn(
          "absolute inset-0 cursor-grab overflow-hidden rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60 active:cursor-grabbing",
          rolagem ? "touch-pan-y" : "touch-none",
        )}
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
              const estilo = estiloDaLinha(
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
                    transform: estilo.transform,
                    opacity: estilo.opacity,
                    pointerEvents: estilo.visivel ? undefined : "none",
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
