"use client";

import React, { useEffect, useRef } from "react";

import { criaQuad, loopVisivel } from "./create-gl";

/**
 * A lattice of dots that answers the cursor.
 *
 * Replaces the topographic contour field, which was the right idea badly aimed:
 * organic lines over a near-black hero read as camouflage, and they competed
 * with the type instead of sitting under it. A regular grid does the opposite.
 * It is architectural, it never fights a headline for attention, and because it
 * is regular, ANY disturbance in it is legible immediately, which is what makes
 * the pointer response read as a response rather than as noise moving.
 *
 * Three things happen around the pointer, and all three are needed for it to
 * read as one light rather than three effects: the dots grow, they brighten, and
 * they are pushed very slightly outward. The push is the part that sells it,
 * because a grid whose spacing bends is unmistakably being disturbed.
 *
 * Aspect is corrected against the SHORT side, so the cells stay square on a wide
 * monitor. A lattice with rectangular cells stops reading as a lattice.
 */
const FRAGMENTO = `
precision mediump float;

varying vec2 vUv;
uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;
uniform float uIntensity;

void main() {
  // Work in a space where one unit is one cell, square on both axes.
  float lado = min(uResolution.x, uResolution.y);
  vec2 px = (vUv - 0.5) * uResolution / lado;

  // The pointer in the same space, so distances below are in cell units.
  vec2 alvo = uPointer * 0.5 * uResolution / lado;

  float espacamento = 0.028;
  float dist = distance(px, alvo);

  // A soft bell around the cursor. 0 far away, 1 under it.
  float perto = 1.0 - smoothstep(0.0, 0.34, dist);

  // Push the lattice outward near the cursor. Small, and applied BEFORE the
  // cell is computed, so the spacing itself bends instead of the dots sliding
  // inside cells that stayed put.
  vec2 fora = dist > 0.0001 ? normalize(px - alvo) : vec2(0.0);
  vec2 deslocado = px + fora * perto * 0.012;

  vec2 celula = fract(deslocado / espacamento) - 0.5;
  float raio = mix(0.085, 0.30, perto);
  float ponto = 1.0 - smoothstep(raio, raio + 0.09, length(celula));

  // A slow breath so the field is alive before the pointer has moved, and on
  // a machine with no pointer at all.
  float respiro = 0.86 + 0.14 * sin(uTime * 0.5 + deslocado.x * 3.0);

  // Vignette on the ORIGINAL uv, so it stays centred on the element and does
  // not slide with the aspect correction. Ascending edges inverted by
  // subtraction: GLSL leaves smoothstep undefined when edge0 is greater than
  // edge1, and a driver that returns zero paints nothing, with no error at all.
  float vinheta = 1.0 - smoothstep(0.16, 0.66, length(vUv - 0.5));

  float brilho = mix(0.24, 1.0, perto) * respiro;
  gl_FragColor = vec4(vec3(1.0), ponto * brilho * vinheta * uIntensity);
}
`;

interface CampoDePontosProps {
  /** 0 to 1. The lattice is a background; above ~0.4 it competes with the type. */
  intensidade?: number;
  className?: string;
}

/**
 * The canvas half of the hero's field. Never rendered on its own.
 *
 * Call sites render `.grade-pontos` underneath and mount this on top, which is
 * a happy accident of the redesign: the CSS fallback is ALSO a dot grid, so a
 * phone, a browser without WebGL and the Lighthouse run all get a still version
 * of the same idea rather than a different one. `criaQuad` returning `null` is
 * not an error path; it is that fallback staying visible.
 *
 * The pointer is read from the inherited `--px`/`--py` custom properties rather
 * than from its own listener: `usePointerField` already coalesces the events
 * into one write per frame, and a second listener would be a second source of
 * truth drifting by a frame.
 */
export default function CampoDePontos({
  intensidade = 0.36,
  className,
}: CampoDePontosProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const quad = criaQuad(canvas, FRAGMENTO);
    if (!quad) return;

    const { gl, uniform } = quad;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(uniform("uIntensity"), intensidade);

    const estilo = getComputedStyle(canvas);
    const leValor = (nome: string) => {
      const bruto = parseFloat(estilo.getPropertyValue(nome));
      return Number.isFinite(bruto) ? bruto : 0;
    };

    let px = 0;
    let py = 0;

    const onResize = () => {
      const { width, height } = quad.resize();
      gl.uniform2f(uniform("uResolution"), width, height);
    };
    onResize();

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const loop = loopVisivel(canvas, (tempo) => {
      // Eased toward the target so a fast flick across the screen does not snap
      // the whole lattice in one frame.
      px += (leValor("--px") - px) * 0.08;
      py += (leValor("--py") - py) * 0.08;
      gl.uniform1f(uniform("uTime"), tempo);
      // The Y axis of the pointer points down and the shader's points up.
      gl.uniform2f(uniform("uPointer"), px, -py);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });

    return () => {
      loop.stop();
      ro.disconnect();
      quad.destroy();
    };
  }, [intensidade]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      // The canvas has no intrinsic size and the CSS box drives the buffer, so
      // an explicit 0x0 keeps it from claiming the 300x150 default for the one
      // frame before the ResizeObserver fires. That frame is a layout shift,
      // and CLS is a hard CI failure on this page.
      width={0}
      height={0}
    />
  );
}
