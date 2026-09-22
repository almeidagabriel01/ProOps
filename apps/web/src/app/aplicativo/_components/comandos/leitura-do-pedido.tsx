"use client";

import React from "react";
import gsap from "gsap";

import {
  ROTULO_DA_ENTIDADE,
  textoDoPedido,
  type Parte,
  type Pedido,
} from "../../_content/comandos";
import { FichaDaLeitura } from "./ficha-da-leitura";
import type { MotionValue } from "motion/react";

import { useCena } from "./use-cena";

interface LeituraDoPedidoProps {
  pedido: Pedido;
  armado: boolean;
  /** 0..1 da animação desta frase, vindo da rolagem. */
  progresso: MotionValue<number>;
}

/**
 * Uma frase sendo escrita e, na sequência, lida.
 *
 * A referência é o Fantastical: o texto em linguagem natural acende nas partes
 * que o aplicativo reconheceu. Aqui a leitura vai um passo além, porque o
 * produto vai: cada parte reconhecida SAI da frase e pousa no campo da ficha
 * que ela preencheu. O leitor não precisa acreditar que o agente entendeu,
 * ele vê para onde cada palavra foi.
 *
 * Quatro tempos, numa timeline só (`useCena`), com a posição dada pela
 * rolagem: descer escreve a frase e monta a ficha, subir desfaz na ordem
 * inversa, com os tokens voltando para a frase.
 *
 * 1. **Digitação.** Um caractere por vez, em ritmo humano: pausa maior depois
 *    de espaço e de pontuação, e um jitter determinístico por posição, para a
 *    mesma frase sempre ser digitada igual.
 * 2. **Reconhecimento.** Cada entidade ganha o marcador (que varre da esquerda),
 *    acende do cinza para o branco e mostra o próprio tipo em cima.
 * 3. **Ficha.** O objeto entra, e os tokens voam até os campos: `x` e `y` com
 *    curvas diferentes, o que desenha um arco em vez de uma reta, e o texto do
 *    token vira o valor formatado no meio do caminho ("45" chega "R$ 45,00").
 * 4. **Dedução.** Só depois entram os campos que ninguém escreveu.
 *
 * A frase é quebrada em caracteres pelo próprio React, e não pelo `SplitText`:
 * ele mede layout ao retalhar, e é esse tipo de medição que a página não pode
 * pagar. Os caracteres são `aria-hidden`; a frase inteira é lida uma vez pelo
 * texto `sr-only`.
 */
export function LeituraDoPedido({
  pedido,
  armado,
  progresso,
}: LeituraDoPedidoProps) {
  const raiz = React.useRef<HTMLDivElement>(null);
  const final =
    pedido.resposta?.valor.tipo === "moeda"
      ? pedido.resposta.valor.numero
      : undefined;
  const [numero, setNumero] = React.useState(final);

  useCena(
    raiz,
    (tl, { marco, acompanhar }) => {
      const el = raiz.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const caracteres = q<HTMLElement>(".leitura-char");
      const tokens = q<HTMLElement>("[data-token]");
      const ficha = q<HTMLElement>(".ficha")[0];

      // Tudo que depende de posição é medido AGORA, com a cena no estado
      // final. Depois dos `set` a ficha estaria deslocada e encolhida, e os
      // voos pousariam fora do lugar.
      const base = el.getBoundingClientRect();
      // O GSAP não interpola `var()`: as cores do tema entram resolvidas.
      const tema = getComputedStyle(el);
      const corTinta = tema.getPropertyValue("--app-tint").trim();
      const corTexto = tema.getPropertyValue("--app-text").trim();
      const voos = pedido.campos.flatMap((campo) => {
        if (!campo.entidade) return [];
        const token = el.querySelector<HTMLElement>(
          `[data-token="${campo.entidade}"] .leitura-palavra`,
        );
        const alvo = el.querySelector<HTMLElement>(
          `[data-alvo="${campo.entidade}"]`,
        );
        if (!token || !alvo) return [];
        const de = token.getBoundingClientRect();
        const para = alvo.getBoundingClientRect();
        const tamanhoDe = parseFloat(getComputedStyle(token).fontSize);
        const estiloAlvo = getComputedStyle(alvo);
        const tamanhoPara = parseFloat(estiloAlvo.fontSize);
        // O fantasma usa a entrelinha do campo, para pousar exatamente sobre o
        // texto dele. Na partida ele é centrado no token, que tem outra caixa.
        const entrelinha =
          parseFloat(estiloAlvo.lineHeight) || tamanhoPara * 1.5;
        const escala = tamanhoDe / tamanhoPara;
        return [
          {
            alvo,
            textoDe: token.textContent ?? "",
            textoPara: campo.valor,
            token,
            de: {
              x: de.left - base.left,
              y: de.top - base.top + de.height / 2 - (entrelinha * escala) / 2,
            },
            para: { x: para.left - base.left, y: para.top - base.top },
            escala,
            tamanhoPara,
            entrelinha,
          },
        ];
      });

      const fantasmas = voos.map((voo) => {
        const fantasma = document.createElement("span");
        fantasma.setAttribute("aria-hidden", "true");
        fantasma.className =
          "leitura-fantasma pointer-events-none absolute left-0 top-0 z-20 whitespace-nowrap font-semibold text-[var(--app-tint)] [text-shadow:0_8px_24px_rgba(0,0,0,0.6)]";
        fantasma.style.fontSize = `${voo.tamanhoPara}px`;
        fantasma.style.lineHeight = `${voo.entrelinha}px`;
        fantasma.style.transformOrigin = "0 0";
        fantasma.textContent = voo.textoDe;
        el.appendChild(fantasma);
        return fantasma;
      });

      gsap.set(caracteres, { opacity: 0 });
      gsap.set(q(".leitura-marca"), { scaleX: 0 });
      gsap.set(q(".leitura-tipo"), { autoAlpha: 0, y: 6 });
      gsap.set(tokens, { "--aceso": 0 });
      gsap.set(ficha, { autoAlpha: 0, y: 24, scale: 0.97 });
      gsap.set(q(".ficha-selo, .ficha-desfecho"), { autoAlpha: 0, x: -10 });
      gsap.set(q(".ficha-campo"), { autoAlpha: 0, y: 10 });
      gsap.set(q(".ficha-resposta"), { autoAlpha: 0, y: 12 });
      gsap.set(
        voos.map((v) => v.alvo),
        { autoAlpha: 0 },
      );
      gsap.set(q(".ficha-deduzido"), { autoAlpha: 0, scale: 0.8 });

      // 1. Digitação.
      let t = 0.3;
      const aparece: number[] = [];
      caracteres.forEach((caractere, i) => {
        aparece.push(t);
        tl.set(caractere, { opacity: 1 }, t);
        t += ritmo(caractere.textContent ?? "", i);
      });

      // 2. Reconhecimento.
      t += 0.5;
      tokens.forEach((token, i) => {
        const em = t + i * PASSO_DO_TOKEN;
        tl.to(
          token.querySelector(".leitura-marca"),
          { scaleX: 1, duration: 0.55, ease: "expo.out" },
          em,
        )
          .to(token, { "--aceso": 1, duration: 0.4, ease: "power2.out" }, em)
          .to(
            token.querySelector(".leitura-tipo"),
            { autoAlpha: 1, y: 0, duration: 0.45, ease: "back.out(2)" },
            em + 0.08,
          );
      });
      t += tokens.length * PASSO_DO_TOKEN + 0.35;

      // 3. Ficha e voos.
      tl.to(
        ficha,
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.7, ease: "expo.out" },
        t,
      )
        .to(
          q(".ficha-selo, .ficha-desfecho"),
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.08,
          },
          t + 0.15,
        )
        .to(
          q(".ficha-campo"),
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            ease: "power3.out",
            stagger: 0.06,
          },
          t + 0.2,
        )
        .to(
          q(".ficha-resposta"),
          { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" },
          t + 0.25,
        );
      if (final !== undefined) {
        marco(t + 0.45, (depois) => setNumero(depois ? final : 0));
      }

      t += 0.4;
      voos.forEach((voo, i) => {
        const fantasma = fantasmas[i];
        const em = t + i * PASSO_DO_VOO;
        const duracao = DURACAO_DO_VOO;
        marco(em + duracao * 0.5, (depois) => {
          fantasma.textContent = depois ? voo.textoPara : voo.textoDe;
        });
        tl.fromTo(
          fantasma,
          { x: voo.de.x, y: voo.de.y, scale: voo.escala, autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.12, ease: "none" },
          em,
        )
          .to(
            fantasma,
            { x: voo.para.x, duration: duracao, ease: "power2.inOut" },
            em,
          )
          // `back.in` sobe antes de descer: o token sai por CIMA da frase, em
          // vez de deslizar sobre ela, e o arco fica evidente.
          .to(
            fantasma,
            { y: voo.para.y, duration: duracao, ease: "back.in(1.4)" },
            em,
          )
          .to(
            fantasma,
            { scale: 1, duration: duracao, ease: "power2.inOut" },
            em,
          )
          // O original some enquanto a cópia é carregada e volta aceso: lê
          // como a palavra sendo levada, e não como duas palavras iguais.
          .to(
            voo.token,
            { opacity: 0.25, duration: 0.2, ease: "power1.out" },
            em,
          )
          .to(
            voo.token,
            { opacity: 1, duration: 0.5, ease: "power2.out" },
            em + duracao * 0.7,
          )
          .to(fantasma, { autoAlpha: 0, duration: 0.2 }, em + duracao)
          .fromTo(
            voo.alvo,
            { autoAlpha: 0, scale: 1.12, color: corTinta },
            {
              autoAlpha: 1,
              scale: 1,
              color: corTexto,
              duration: 0.6,
              ease: "expo.out",
            },
            em + duracao - 0.04,
          );
      });
      t += voos.length * PASSO_DO_VOO + DURACAO_DO_VOO;

      // 4. Dedução, e o cursor sai de cena.
      tl.to(
        q(".ficha-deduzido"),
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.4,
          ease: "back.out(2.2)",
          stagger: 0.1,
        },
        t,
      );
      // O cursor fica na frase até a ficha terminar; o espaçador estende a
      // timeline até esse ponto.
      const fimDoCursor = t + 0.6;
      tl.to({}, { duration: 0.6 }, t);

      // O cursor mora no último caractere já escrito. Com a rolagem indo e
      // voltando, ele é recalculado a cada quadro em vez de trocado por
      // evento, que só saberia andar para a frente.
      let comCursor: HTMLElement | undefined;
      acompanhar((tempo) => {
        let ultimo = -1;
        while (ultimo + 1 < aparece.length && aparece[ultimo + 1] <= tempo) {
          ultimo += 1;
        }
        const alvo =
          tempo < fimDoCursor && ultimo >= 0 ? caracteres[ultimo] : undefined;
        if (alvo === comCursor) return;
        comCursor?.classList.remove("leitura-cursor");
        alvo?.classList.add("leitura-cursor");
        comCursor = alvo;
      });

      return () => {
        fantasmas.forEach((f) => f.remove());
        caracteres.forEach((c) => c.classList.remove("leitura-cursor"));
        setNumero(final);
      };
    },
    { armado, progresso, chave: pedido.id },
  );

  return (
    <div ref={raiz} className="relative">
      <p className="[font-family:var(--font-hanken)] text-[1.45rem] font-semibold leading-[1.55] tracking-[-0.025em] text-[var(--app-text-muted)] md:text-[2.4rem] md:leading-[1.65] tela-baixa:text-[2rem] tela-baixa:leading-[1.5]">
        <span className="sr-only">{textoDoPedido(pedido)}</span>
        <span aria-hidden="true">
          {pedido.partes.map((parte, i) => (
            <Trecho key={i} parte={parte} />
          ))}
        </span>
      </p>

      <div className="mt-4 md:mt-8 tela-baixa:mt-5">
        <FichaDaLeitura pedido={pedido} numero={numero} />
      </div>
    </div>
  );
}

function Trecho({ parte }: { parte: Parte }) {
  if (typeof parte === "string") return <Caracteres texto={parte} />;

  return (
    <span
      data-token={parte.entidade}
      // `--aceso` vai de 0 a 1 e mistura as duas cores do tema: um GSAP não
      // interpola `var()` de cor, mas interpola um número sem problema.
      style={
        {
          "--aceso": 1,
          color:
            "color-mix(in srgb, var(--app-text) calc(var(--aceso) * 100%), var(--app-text-muted))",
        } as React.CSSProperties
      }
      className="relative inline-block whitespace-nowrap"
    >
      <span className="leitura-marca absolute -inset-x-[0.14em] bottom-[0.18em] top-[0.26em] origin-left rounded-[0.22em] border-b-2 border-[var(--app-tint)] bg-[var(--app-tint)]/[0.13]" />
      <span className="leitura-tipo absolute left-0 top-0 -translate-y-[35%] whitespace-nowrap text-[11px] font-medium leading-none tracking-normal text-[var(--app-tint)] md:text-xs">
        {ROTULO_DA_ENTIDADE[parte.entidade]}
      </span>
      <span className="leitura-palavra relative">
        <Caracteres texto={parte.texto} />
      </span>
    </span>
  );
}

function Caracteres({ texto }: { texto: string }) {
  return (
    <>
      {Array.from(texto).map((caractere, i) => (
        <span key={i} className="leitura-char relative">
          {caractere}
        </span>
      ))}
    </>
  );
}

/**
 * Quanto esperar depois de um caractere.
 *
 * O jitter vem da posição, não de `Math.random`, para a frase ser digitada
 * sempre do mesmo jeito: uma digitação que muda a cada volta parece defeito
 * quando o leitor volta a ela.
 */
export function ritmo(caractere: string, posicao: number): number {
  const jitter = (((Math.sin(posicao * 12.9898) * 43758.5453) % 1) + 1) % 1;
  const base = RITMO.base + jitter * RITMO.variacao;
  if (caractere === " ") return base + RITMO.espaco;
  if (/[,.:?!]/.test(caractere)) return base + RITMO.pontuacao;
  return base;
}

/**
 * Os tempos da leitura, em segundos de timeline. Como a timeline inteira é
 * esticada sobre a fatia de rolagem, o que conta é a PROPORÇÃO entre eles: a
 * digitação e os voos ganharam peso para não passarem num piscar enquanto a
 * pessoa rola.
 */
export const RITMO = {
  base: 0.05,
  variacao: 0.045,
  espaco: 0.07,
  pontuacao: 0.2,
};
const PASSO_DO_TOKEN = 0.3;
const PASSO_DO_VOO = 0.35;
const DURACAO_DO_VOO = 1.3;
