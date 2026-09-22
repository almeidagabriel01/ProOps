"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { DesktopOnlyWebGl } from "@/components/marketing/_shared/webgl/desktop-only";

import {
  COMODOS,
  ITENS,
  LARGO_QUERY,
  centroDoComodo,
  formataReais,
  type ComodoId,
  type LayoutId,
} from "../../_content/cena-planta";
import { comodoEm, daCaixaAoPiso, naCaixa } from "./projecao";
import {
  CAIXA,
  deslocamentoDaCasa,
  deslocamentoDaFolha,
  estadoDaCena,
  paraVariaveis,
  type EstadoDaCena,
  type Realce,
} from "./roteiro";
import type { CenaAoVivo } from "./cena-ao-vivo";

/**
 * A casa em three.js. Só é importada dentro de `DesktopOnlyWebGl`, então um
 * celular e a corrida do Lighthouse (412px) nunca pedem o chunk.
 */
const Planta3d = dynamic(() => import("./planta-3d"), { ssr: false });

/**
 * O diretor da cena: liga a rolagem e o ponteiro ao roteiro.
 *
 * Não renderiza nada visível. A cena inteira já está no HTML do servidor, e o
 * diretor só escreve variáveis CSS na `<section>`, por cima das que o `<style>`
 * do servidor pôs lá. Nenhum estado React muda por quadro: a rolagem vira um
 * número, o número vira variáveis (`paraVariaveis`, o mesmo serializador do
 * servidor) e só as que mudaram são escritas.
 *
 * Três decisões de orçamento:
 *
 * - **Ele começa tarde.** O ScrollTrigger é criado no primeiro `idle` ou no
 *   primeiro gesto (roda, toque, tecla, ponteiro), o que vier antes.
 *   `ScrollTrigger.create` mede layout de forma síncrona, e o herói está na
 *   tela no load: criar ali caía em cheio na janela que o Lighthouse mede.
 * - **A rolagem passa por uma mola.** O progresso chega do Lenis já suavizado,
 *   mas em degraus, e a cena tem peças (a câmera, os chips) em que um degrau se
 *   vê. A mola roda só enquanto há diferença a vencer, e para sozinha.
 * - **Os chips são a única medição.** A posição de repouso de cada linha na
 *   proposta sai de `offsetTop`/`offsetLeft`, que ignoram transform, medidos no
 *   resize e nunca durante a rolagem. O resto é conta.
 */
export function Diretor() {
  const reduzido = useReducedMotion();
  const ancora = useRef<HTMLSpanElement>(null);
  // Um objeto só, criado uma vez e mutado fora do render: é o canal entre o
  // diretor e o 3D (ver `cena-ao-vivo.ts`).
  const [aoVivo] = useState<CenaAoVivo>(() => ({ estado: estadoDaCena(0), versao: 0 }));

  useEffect(() => {
    if (reduzido) return;
    const secao = ancora.current?.closest<HTMLElement>("[data-cena-planta]");
    const palco = secao?.querySelector<HTMLElement>("[data-palco]");
    const elCasa = secao?.querySelector<HTMLElement>("[data-casa]");
    const trilha = palco?.parentElement;
    if (!secao || !palco || !elCasa || !trilha) return;
    return iniciaCena({ secao, palco, casa: elCasa, trilha, aoVivo });
  }, [reduzido, aoVivo]);

  // O diretor mora DENTRO da caixa da casa, e é por isso que o canvas do 3D,
  // renderizado aqui, cai exatamente em cima do desenho.
  return (
    <>
      <span ref={ancora} hidden />
      <DesktopOnlyWebGl>
        <Planta3d aoVivo={aoVivo} />
      </DesktopOnlyWebGl>
    </>
  );
}

interface Pecas {
  secao: HTMLElement;
  palco: HTMLElement;
  casa: HTMLElement;
  trilha: HTMLElement;
  aoVivo: CenaAoVivo;
}

/** A posição de `el` relativa a `ancestral`, sem transforms, pela cadeia de `offsetParent`. */
function posicaoEm(el: HTMLElement, ancestral: HTMLElement): [number, number] {
  let x = 0;
  let y = 0;
  let atual: HTMLElement | null = el;
  while (atual && atual !== ancestral) {
    x += atual.offsetLeft;
    y += atual.offsetTop;
    atual = atual.offsetParent as HTMLElement | null;
  }
  return [x, y];
}

/** Dois chips no mesmo cômodo não podem pousar um em cima do outro. */
const ORDEM_NO_COMODO = ITENS.map(
  (item, i) => ITENS.slice(0, i).filter((anterior) => anterior.comodo === item.comodo).length,
);

function iniciaCena({ secao, palco, casa, trilha, aoVivo }: Pecas): () => void {
  let vivo = true;
  let trigger: ScrollTrigger | undefined;
  let quadro = 0;
  let alvo = 0;
  let atual = 0;
  let ultimoTempo = 0;
  let layout: LayoutId = window.matchMedia(LARGO_QUERY).matches ? "largo" : "retrato";

  const realceAlvo: Realce = {};
  const realce: Realce = {};
  const fixados = new Set<ComodoId>();

  const escritas = new Map<string, string>();
  let atoEscrito = "";
  let totalEscrito = -1;

  const chips = [...secao.querySelectorAll<HTMLElement>("[data-chip]")];
  const rotulos = chips.map((chip) => chip.querySelector<HTMLElement>("[data-rotulo]"));
  const lugarFolha = secao.querySelector<HTMLElement>(".cena-lugar-folha");
  const total = secao.querySelector<HTMLElement>("[data-total]");

  // Medidas de layout, refeitas só no resize.
  let medidas = {
    palco: [0, 0] as [number, number],
    casa: [0, 0, 0, 0] as [number, number, number, number],
    chips: [] as [number, number][],
  };
  const mede = () => {
    medidas = {
      palco: [palco.clientWidth, palco.clientHeight],
      casa: [...posicaoEm(casa, palco), casa.offsetWidth, casa.offsetHeight],
      chips: chips.map((chip, i) => {
        const [x, y] = lugarFolha ? posicaoEm(chip, palco) : [0, 0];
        const rotulo = rotulos[i];
        return [x + (rotulo?.offsetWidth ?? 0) / 2, y + (rotulo?.offsetHeight ?? 0) / 2];
      }),
    };
  };

  const escreve = (nome: string, valor: string) => {
    if (escritas.get(nome) === valor) return;
    escritas.set(nome, valor);
    secao.style.setProperty(nome, valor);
  };

  /** Onde o chip `i` tem que estar, em px do palco, enquanto não voou. */
  const deslocamentoDoChip = (estado: EstadoDaCena, i: number): [number, number] => {
    const [pw, ph] = medidas.palco;
    const [cx, cy, cw, ch] = medidas.casa;
    const [dxCasa, dyCasa] = deslocamentoDaCasa(estado, layout);
    const [dxFolha, dyFolha] = deslocamentoDaFolha(estado, layout);
    const [lx, lz] = centroDoComodo(ITENS[i].comodo);
    const [fx, fy] = naCaixa([lx, 1.5, lz], estado.camera, CAIXA);
    const alvoX = cx + (dxCasa * pw) / 100 + fx * cw;
    const alvoY = cy + (dyCasa * ph) / 100 + fy * ch - 18 + ORDEM_NO_COMODO[i] * 40;
    const [rx, ry] = medidas.chips[i] ?? [0, 0];
    const repousoX = rx + (dxFolha * pw) / 100;
    const repousoY = ry + (dyFolha * ph) / 100;
    const falta = 1 - estado.chips[i].voo;
    return [(alvoX - repousoX) * falta, (alvoY - repousoY) * falta];
  };

  const desenha = () => {
    const estado = estadoDaCena(atual, realce);
    for (const [nome, valor] of Object.entries(paraVariaveis(estado, layout))) escreve(nome, valor);
    estado.chips.forEach((_, i) => {
      const [dx, dy] = deslocamentoDoChip(estado, i);
      escreve(`--chip-${i}-x`, `${dx.toFixed(1)}px`);
      escreve(`--chip-${i}-y`, `${dy.toFixed(1)}px`);
    });
    if (estado.ato !== atoEscrito) {
      atoEscrito = estado.ato;
      secao.dataset.ato = estado.ato;
    }
    // O total só é reescrito quando o valor muda de verdade, e em reais
    // inteiros: centavos piscando a cada quadro são ruído, não informação.
    const reais = Math.round(estado.proposta.totalCentavos / 100);
    if (total && reais !== totalEscrito) {
      totalEscrito = reais;
      total.textContent = formataReais(reais * 100);
    }
    aoVivo.estado = estado;
    aoVivo.versao++;
  };

  /** A mola: aproxima o progresso e o realce dos alvos, e para quando chega. */
  const passo = (agora: number) => {
    quadro = 0;
    const dt = ultimoTempo ? Math.min(0.05, (agora - ultimoTempo) / 1000) : 1 / 60;
    ultimoTempo = agora;
    const k = 1 - Math.exp(-dt * 9);
    let parado = true;

    atual += (alvo - atual) * k;
    if (Math.abs(alvo - atual) < 0.0004) atual = alvo;
    else parado = false;

    for (const comodo of COMODOS) {
      const de = realce[comodo.id] ?? 0;
      const para = realceAlvo[comodo.id] ?? 0;
      const novo = Math.abs(para - de) < 0.004 ? para : de + (para - de) * (1 - Math.exp(-dt * 7));
      realce[comodo.id] = novo;
      if (novo !== para) parado = false;
    }

    desenha();
    if (parado) ultimoTempo = 0;
    else quadro = requestAnimationFrame(passo);
  };
  const acorda = () => {
    if (!quadro && vivo) quadro = requestAnimationFrame(passo);
  };

  // O ponteiro acende o cômodo que está debaixo dele. Mede a caixa no próprio
  // evento, que é raro perto de um quadro, e converte para o piso pela mesma
  // projeção que desenhou a casa.
  const comodoSob = (evento: PointerEvent): ComodoId | null => {
    const caixa = casa.getBoundingClientRect();
    if (caixa.width === 0) return null;
    const fracao: [number, number] = [
      (evento.clientX - caixa.left) / caixa.width,
      (evento.clientY - caixa.top) / caixa.height,
    ];
    return comodoEm(daCaixaAoPiso(fracao, aoVivo.estado.camera, CAIXA), COMODOS);
  };
  const aoMover = (evento: PointerEvent) => {
    if (evento.pointerType !== "mouse") return;
    const comodo = comodoSob(evento);
    for (const c of COMODOS) realceAlvo[c.id] = c.id === comodo || fixados.has(c.id) ? 1 : 0;
    acorda();
  };
  const aoSair = () => {
    for (const c of COMODOS) realceAlvo[c.id] = fixados.has(c.id) ? 1 : 0;
    acorda();
  };
  // No toque não há "passar por cima": um toque acende, outro apaga.
  const aoTocar = (evento: PointerEvent) => {
    if (evento.pointerType === "mouse") return;
    const comodo = comodoSob(evento);
    if (!comodo) return;
    if (fixados.has(comodo)) fixados.delete(comodo);
    else fixados.add(comodo);
    realceAlvo[comodo] = fixados.has(comodo) ? 1 : 0;
    acorda();
  };

  const redimensiona = () => {
    mede();
    desenha();
  };
  const observadorDeTamanho = new ResizeObserver(redimensiona);

  const composicao = window.matchMedia(LARGO_QUERY);
  const trocaComposicao = () => {
    layout = composicao.matches ? "largo" : "retrato";
    redimensiona();
  };

  // Fora da tela, o único loop CSS da cena (a gota da dica) para.
  const observadorDeVista = new IntersectionObserver(([entrada]) => {
    secao.classList.toggle("anim-paused", !entrada.isIntersecting);
  });
  observadorDeVista.observe(secao);

  const comeca = () => {
    if (!vivo || trigger) return;
    removeGatilhos();
    gsap.registerPlugin(ScrollTrigger);
    mede();
    trigger = ScrollTrigger.create({
      trigger: trilha,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        alvo = self.progress;
        acorda();
      },
      onRefresh: (self) => {
        alvo = self.progress;
        mede();
        acorda();
      },
    });
    alvo = trigger.progress;
    atual = alvo;
    desenha();
    observadorDeTamanho.observe(palco);
    composicao.addEventListener("change", trocaComposicao);
    casa.addEventListener("pointermove", aoMover, { passive: true });
    casa.addEventListener("pointerleave", aoSair, { passive: true });
    casa.addEventListener("pointerup", aoTocar, { passive: true });
  };

  const gestos = ["wheel", "touchstart", "keydown", "pointermove"] as const;
  const removeGatilhos = () => {
    for (const gesto of gestos) window.removeEventListener(gesto, comeca);
  };
  for (const gesto of gestos) window.addEventListener(gesto, comeca, { passive: true, once: true });
  const temOcioso = typeof window.requestIdleCallback === "function";
  const ocioso = temOcioso
    ? window.requestIdleCallback(comeca, { timeout: 2500 })
    : window.setTimeout(comeca, 1200);

  return () => {
    vivo = false;
    removeGatilhos();
    if (temOcioso) window.cancelIdleCallback(ocioso);
    else window.clearTimeout(ocioso);
    if (quadro) cancelAnimationFrame(quadro);
    trigger?.kill();
    observadorDeTamanho.disconnect();
    observadorDeVista.disconnect();
    composicao.removeEventListener("change", trocaComposicao);
    casa.removeEventListener("pointermove", aoMover);
    casa.removeEventListener("pointerleave", aoSair);
    casa.removeEventListener("pointerup", aoTocar);
    secao.classList.remove("anim-paused");
    for (const nome of escritas.keys()) secao.style.removeProperty(nome);
  };
}
