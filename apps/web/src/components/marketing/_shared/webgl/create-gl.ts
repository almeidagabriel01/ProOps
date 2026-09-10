/**
 * The small amount of WebGL plumbing the company site needs, by hand.
 *
 * No three.js and no R3F, and that is a measured decision rather than a taste:
 * `globals.css` already records rejecting a WebGL hero because ~150KB plus the
 * main-thread cost would breach the CI's TBT ceiling on a throttled phone. The
 * two effects here are a fullscreen fragment shader and one textured quad, which
 * is about a hundred lines of plumbing; a scene graph, a camera, a material
 * system and a loader would all be dead weight around them.
 *
 * Everything in this folder is loaded through `next/dynamic({ ssr: false })`
 * behind a desktop + fine-pointer media query, so it never reaches a phone and
 * never reaches the Lighthouse run, which emulates one.
 */

export interface GlQuad {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  /** Uniform locations, by name, resolved once. */
  uniform: (name: string) => WebGLUniformLocation | null;
  /** Resizes the drawing buffer to the canvas box, DPR-capped. Returns px size. */
  resize: () => { width: number; height: number };
  destroy: () => void;
}

const VERTEX_PADRAO = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function compila(
  gl: WebGLRenderingContext,
  tipo: number,
  fonte: string,
): WebGLShader | null {
  const shader = gl.createShader(tipo);
  if (!shader) return null;
  gl.shaderSource(shader, fonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // A shader that fails to compile is a developer error, not a runtime
    // condition: log it and let the caller fall back to the DOM layer.
    console.warn("[webgl] shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * A fullscreen quad running `fragmento`, or `null` when WebGL is unavailable.
 *
 * Returning `null` instead of throwing is deliberate: every caller renders a
 * DOM/CSS version underneath and simply leaves it showing. A browser with WebGL
 * disabled, a blocked context, or a driver that refuses the context then
 * degrades to the same thing a phone already sees.
 */
export function criaQuad(
  canvas: HTMLCanvasElement,
  fragmento: string,
): GlQuad | null {
  const gl =
    canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // The field is decorative and redrawn every frame; keeping the buffer
      // costs memory bandwidth for a pixel nobody reads back.
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    }) ?? null;
  if (!gl) return null;

  const vs = compila(gl, gl.VERTEX_SHADER, VERTEX_PADRAO);
  const fs = compila(gl, gl.FRAGMENT_SHADER, fragmento);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("[webgl] link:", gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);
  // The shaders are linked into the program; the objects themselves are no
  // longer referenced by anything else.
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPosition = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const cache = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
    return cache.get(name) ?? null;
  };

  const resize = () => {
    // Capped at 1.5: the field is low-frequency noise, so a retina buffer
    // quadruples the fragment work for a difference nobody can point at.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    return { width, height };
  };
  resize();

  return {
    canvas,
    gl,
    program,
    uniform,
    resize,
    destroy: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      // Frees the backing surface immediately instead of waiting for GC. A
      // browser only allows a handful of live contexts, and the company site
      // creates one per scene.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

export interface LoopControls {
  stop: () => void;
}

/**
 * A render loop that only runs when it can be seen.
 *
 * Paused while the canvas is outside the viewport and while the tab is hidden.
 * Both matter on a long scrolling page: an always-on loop keeps a GPU awake for
 * a surface several screens away, which on a laptop is audible as the fan.
 */
export function loopVisivel(
  canvas: HTMLCanvasElement,
  desenha: (tempoSegundos: number) => void,
): LoopControls {
  let frame = 0;
  let visivel = false;
  let inicio = 0;
  let pausadoEm = 0;

  const tick = (agora: number) => {
    if (!inicio) inicio = agora;
    desenha((agora - inicio) / 1000);
    frame = requestAnimationFrame(tick);
  };

  const avalia = () => {
    const deveRodar = visivel && document.visibilityState === "visible";
    if (deveRodar && !frame) {
      // Shift the clock by the paused span so the animation resumes where it
      // stopped instead of jumping forward by however long it was away.
      if (pausadoEm) {
        inicio += performance.now() - pausadoEm;
        pausadoEm = 0;
      }
      frame = requestAnimationFrame(tick);
    } else if (!deveRodar && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      pausadoEm = performance.now();
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      visivel = entries[0].isIntersecting;
      avalia();
    },
    { rootMargin: "10% 0px" },
  );
  io.observe(canvas);
  document.addEventListener("visibilitychange", avalia);

  return {
    stop: () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", avalia);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
