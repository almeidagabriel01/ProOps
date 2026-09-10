"use client";

import React, { useEffect, useRef } from "react";
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

/** The mark itself, so the object on screen is the logo and not a logo-ish shape. */
const SVG_DA_MARCA = "/logo/logo2-cropped.svg";

interface Marca3dProps {
  className?: string;
  /** Multiplies the pointer's influence on the rotation. */
  reacao?: number;
}

/**
 * The ProOps mark, extruded, turning with the reader's pointer.
 *
 * The object is the actual brand asset rather than an abstract shape: `SVGLoader`
 * reads `/logo/logo2-cropped.svg` at runtime and `ExtrudeGeometry` gives it
 * depth, so redrawing the logo redraws this and nothing here needs editing. It
 * also means the silhouette is exactly right, including the counter of the "P"
 * and the dot, which is the part a hand-modelled approximation always gets wrong.
 *
 * Two rings orbit it on tilted axes. The mark is itself a ring, so they read as
 * the same idea seen from other angles, and they are what gives the scene depth:
 * a single object rotating in place reads as flat no matter how it is lit,
 * because there is nothing for it to rotate in FRONT of.
 *
 * The pointer sets a target and the rotation eases toward it every frame, so a
 * flick across the screen turns the object rather than teleporting it. There is
 * always a slow idle drift underneath, so the scene is alive before the reader
 * has moved the mouse at all, and on the frame the pointer stops.
 *
 * Desktop-only by construction: it is mounted through `DesktopOnlyWebGl`, so the
 * three.js chunk is never even requested on a phone, and never on the Lighthouse
 * run, which emulates a 412px viewport. That gate is the reason a library of this
 * size is affordable here at all.
 */
export default function Marca3d({ className, reacao = 1 }: Marca3dProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    let cancelado = false;
    let frame = 0;
    let renderer: WebGLRenderer | null = null;
    let io: IntersectionObserver | null = null;
    let ro: ResizeObserver | null = null;
    const descartaveis: Array<{ dispose: () => void }> = [];

    const cena = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7.4);

    // Key from the front-left, rim from behind-right. On near-black the rim is
    // what draws the extruded edge; without it the object is a silhouette.
    const chave = new DirectionalLight(0xffffff, 2.6);
    chave.position.set(-3, 3.5, 5);
    const contorno = new DirectionalLight(0xffffff, 3.2);
    contorno.position.set(4, -2, -4);
    cena.add(chave, contorno, new AmbientLight(0xffffff, 0.55));

    const grupo = new Group();
    cena.add(grupo);

    const anel = (raio: number, espessura: number, opacidade: number) => {
      const geo = new TorusGeometry(raio, espessura, 8, 128);
      const mat = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: opacidade,
      });
      descartaveis.push(geo, mat);
      return new Mesh(geo, mat);
    };

    const anelExterno = anel(2.35, 0.012, 0.5);
    anelExterno.rotation.set(1.15, 0.4, 0);
    const anelInterno = anel(1.85, 0.01, 0.32);
    anelInterno.rotation.set(-0.8, 0.9, 0.3);
    grupo.add(anelExterno, anelInterno);

    let marca: Group | null = null;

    const alvo = { x: 0, y: 0 };
    const atual = { x: 0, y: 0 };

    const estilo = getComputedStyle(host);
    const leVar = (nome: string) => {
      const bruto = parseFloat(estilo.getPropertyValue(nome));
      return Number.isFinite(bruto) ? bruto : 0;
    };

    const redimensiona = () => {
      if (!renderer) return;
      const { clientWidth: w, clientHeight: h } = host;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const desenha = (tempo: number) => {
      frame = requestAnimationFrame(desenha);
      if (!renderer) return;

      const t = tempo / 1000;
      alvo.x = leVar("--py") * 0.45 * reacao;
      alvo.y = leVar("--px") * 0.7 * reacao;

      // Ease toward the pointer, and keep a slow drift under it so the scene is
      // never frozen: the drift is added AFTER the easing, so it does not fight
      // the pointer for the same value.
      atual.x += (alvo.x - atual.x) * 0.055;
      atual.y += (alvo.y - atual.y) * 0.055;

      grupo.rotation.x = atual.x + Math.sin(t * 0.35) * 0.06;
      grupo.rotation.y = atual.y + t * 0.12;
      grupo.position.y = Math.sin(t * 0.5) * 0.09;

      anelExterno.rotation.z = t * 0.14;
      anelInterno.rotation.z = -t * 0.2;

      renderer.render(cena, camera);
    };

    const avalia = (visivel: boolean) => {
      const deveRodar = visivel && document.visibilityState === "visible";
      if (deveRodar && !frame) {
        frame = requestAnimationFrame(desenha);
      } else if (!deveRodar && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    let noViewport = false;
    const onVisibilidade = () => avalia(noViewport);

    /**
     * The renderer is built INSIDE the async load, not before it.
     *
     * A WebGL context created and then abandoned because the SVG failed, or
     * because the component unmounted mid-fetch, is a leaked GPU surface, and a
     * browser only allows a handful. Building it last means every early return
     * above costs nothing.
     */
    const montar = async () => {
      let dados: Awaited<ReturnType<SVGLoader["loadAsync"]>>;
      try {
        dados = await new SVGLoader().loadAsync(SVG_DA_MARCA);
      } catch {
        // The mark is decoration on top of a hero that is already complete. A
        // failed fetch leaves the CSS field showing, like every other layer here.
        return;
      }
      if (cancelado) return;

      const formas = dados.paths.flatMap((caminho) =>
        SVGLoader.createShapes(caminho),
      );
      if (formas.length === 0) return;

      const geometria = new ExtrudeGeometry(formas, {
        depth: 44,
        bevelEnabled: true,
        bevelThickness: 7,
        bevelSize: 5,
        bevelSegments: 4,
        curveSegments: 24,
      });
      // The SVG's own coordinate system is arbitrary (this one is potrace output
      // at 10x with a flipped Y). Centring on the bounding box and scaling to a
      // fixed height makes the component independent of it: redraw the logo at
      // any size and the object on screen stays put.
      geometria.center();
      const caixa = new Box3().setFromBufferAttribute(
        geometria.attributes.position as never,
      );
      const tamanho = caixa.getSize(new Vector3());
      const escala = 2.7 / Math.max(tamanho.x, tamanho.y);

      const material = new MeshStandardMaterial({
        color: 0xf4f4f5,
        roughness: 0.28,
        metalness: 0.16,
      });
      descartaveis.push(geometria, material);

      const malha = new Mesh(geometria, material);
      malha.scale.setScalar(escala);
      /*
       * The SVG Y axis points down and three's points up, so the mark arrives
       * upside down. The correction is a half turn about X, not about Z: Z flips
       * BOTH axes, which un-inverts the mark and mirrors it at the same time, and
       * a mirrored logo is a wrong logo. A negative Y scale would flip only Y but
       * also reverse the triangle winding, so the lighting would read inside out.
       *
       * The mesh is turned rather than the geometry, so `center()` above keeps
       * operating on an untouched buffer.
       */
      malha.rotation.x = Math.PI;

      marca = new Group();
      marca.add(malha);
      grupo.add(marca);

      renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      redimensiona();

      ro = new ResizeObserver(redimensiona);
      ro.observe(host);

      io = new IntersectionObserver(
        (entradas) => {
          noViewport = entradas[0].isIntersecting;
          avalia(noViewport);
        },
        { rootMargin: "10% 0px" },
      );
      io.observe(host);
      document.addEventListener("visibilitychange", onVisibilidade);
    };

    void montar();

    return () => {
      cancelado = true;
      if (frame) cancelAnimationFrame(frame);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilidade);
      descartaveis.forEach((d) => d.dispose());
      marca = null;
      if (renderer) {
        // `forceContextLoss` frees the backing surface now instead of at the
        // next GC. Without it, navigating between company pages a few times
        // exhausts the browser's context budget and the canvas silently stops.
        renderer.forceContextLoss();
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
    };
  }, [reacao]);

  return <div ref={ref} aria-hidden="true" className={className} />;
}
