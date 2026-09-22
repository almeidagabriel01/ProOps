"use client";

import React, { useEffect, useRef } from "react";

import { loopVisivel } from "@/components/marketing/_shared/webgl/create-gl";

import type { CenaAoVivo } from "./cena-ao-vivo";
import { criaCena3d } from "./three/cena-3d";

export interface Planta3dProps {
  aoVivo: CenaAoVivo;
}

/**
 * O canvas da casa em 3D, montado dentro da caixa da casa (`[data-casa]`) e do
 * tamanho exato dela.
 *
 * O ciclo de vida é o mesmo da marca 3D que ficava aqui antes: o renderer só
 * nasce depois de o canvas ter tamanho, o loop roda só com o canvas visível e a
 * aba à mostra (`loopVisivel`), e o fim devolve cada geometria, material e
 * contexto à GPU.
 *
 * **Render sob demanda.** O quadro só é refeito quando o diretor publicou um
 * estado novo (`versao`) ou quando há cortina à vista, que ondula sozinha. Uma
 * casa parada custa zero por quadro.
 *
 * Quando o primeiro quadro sai, a caixa ganha `data-webgl="pronto"` e o CSS
 * apaga o desenho SVG por baixo. Se o contexto cair, o atributo sai e o
 * desenho volta: a cena nunca fica sem casa.
 */
export default function Planta3d({ aoVivo }: Planta3dProps) {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = tela.current;
    const caixa = canvas?.closest<HTMLElement>("[data-casa]");
    if (!canvas || !caixa) return;

    const cena = criaCena3d(canvas);
    if (!cena) return;

    let versaoDesenhada = -1;
    let pronto = false;
    let largura = 0;
    let altura = 0;

    const redimensiona = () => {
      largura = caixa.clientWidth;
      altura = caixa.clientHeight;
      if (largura > 0 && altura > 0) {
        cena.redimensiona(largura, altura);
        versaoDesenhada = -1;
      }
    };
    redimensiona();
    const observador = new ResizeObserver(redimensiona);
    observador.observe(caixa);

    const loop = loopVisivel(canvas, (segundos) => {
      if (largura === 0) return;
      const { estado, versao } = aoVivo;
      if (versao === versaoDesenhada && !cena.temMovimento(estado)) return;
      versaoDesenhada = versao;
      cena.desenha(estado, segundos);
      if (!pronto) {
        pronto = true;
        caixa.dataset.webgl = "pronto";
      }
    });

    const perdeu = (evento: Event) => {
      evento.preventDefault();
      delete caixa.dataset.webgl;
      loop.stop();
    };
    canvas.addEventListener("webglcontextlost", perdeu);

    return () => {
      loop.stop();
      observador.disconnect();
      canvas.removeEventListener("webglcontextlost", perdeu);
      delete caixa.dataset.webgl;
      cena.descarta();
    };
  }, [aoVivo]);

  return (
    <canvas
      ref={tela}
      aria-hidden="true"
      width={0}
      height={0}
      className="cena-canvas pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
