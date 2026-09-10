"use client";

import React, { useEffect, useRef } from "react";

import { criaQuad, loopVisivel } from "./create-gl";

/**
 * Monochrome flow field: layered curl noise, contoured into bands.
 *
 * The bands are the whole point. Smooth noise reads as fog, which is what every
 * generative background looks like; running it through `fract` and thresholding
 * turns it into topographic lines that drift, which reads as a surface with
 * structure. One accent colour is available but unused by default: this site is
 * black and white, and depth comes from contrast and movement.
 *
 * `uPointer` is the same -1..1 pair the DOM layer reads as `--px`/`--py`, so the
 * canvas and the CSS fallback respond to the reader identically.
 */
const FRAGMENTO = `
precision mediump float;

varying vec2 vUv;
uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;
uniform float uIntensity;

// Classic value-noise hash. Cheap and good enough: the output is immediately
// folded into bands, which hides the lattice a gradient noise would avoid.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float soma = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    soma += amp * noise(p);
    p = p * 2.02 + vec2(7.3, 1.7);
    amp *= 0.5;
  }
  return soma;
}

void main() {
  // Aspect-correct so the bands keep their shape on a wide monitor.
  vec2 uv = vUv;
  uv.x *= uResolution.x / max(uResolution.y, 1.0);

  // The pointer warps the field instead of moving it: a translation reads as a
  // parallax layer, a warp reads as the surface reacting to being looked at.
  vec2 alvo = uv + uPointer * 0.14;

  float t = uTime * 0.035;
  float campo = fbm(alvo * 2.1 + vec2(t, -t * 0.6));
  campo += 0.5 * fbm(alvo * 4.3 - vec2(t * 1.4, t));

  // Contour lines: fold the field, then keep a thin ribbon near each fold.
  float bandas = fract(campo * 4.0);
  float linha = smoothstep(0.0, 0.06, bandas) * smoothstep(0.5, 0.12, bandas);

  // Vignette on the ORIGINAL uv, so it stays centred on the element and does
  // not slide with the aspect correction above.
  vec2 c = vUv - 0.5;
  float vinheta = smoothstep(0.75, 0.12, length(c));

  float alpha = linha * vinheta * uIntensity;
  gl_FragColor = vec4(vec3(1.0), alpha);
}
`;

interface FlowFieldProps {
  /** 0 to 1. The field is a background; above ~0.35 it competes with the text. */
  intensidade?: number;
  className?: string;
}

/**
 * The canvas half of the hero's field. Never rendered on its own.
 *
 * Call sites render the CSS field (`MonoField` or a gradient) underneath and
 * mount this on top, so a browser without WebGL, a phone, and the Lighthouse
 * run all keep the version that costs nothing. `criaQuad` returning `null` is
 * not an error path: it is that fallback staying visible.
 *
 * The pointer is read from the inherited `--px`/`--py` custom properties rather
 * than from its own listener. `usePointerField` already coalesces the events
 * into one write per frame, and duplicating the listener here would mean two
 * sources of truth drifting by a frame.
 */
export default function FlowField({
  intensidade = 0.3,
  className,
}: FlowFieldProps) {
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
      // the whole field in one frame.
      px += (leValor("--px") - px) * 0.06;
      py += (leValor("--py") - py) * 0.06;
      gl.uniform1f(uniform("uTime"), tempo);
      gl.uniform2f(uniform("uPointer"), px, py);
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
