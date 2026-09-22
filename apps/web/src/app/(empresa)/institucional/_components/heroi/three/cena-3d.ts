import {
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  HalfFloatType,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type Material,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import {
  COMODOS,
  ITENS,
  MOVEIS,
  PAREDES,
  PE_DIREITO,
  type ComodoId,
  type Janela,
  type Retangulo,
} from "../../../_content/cena-planta";
import { caixaDaParede } from "../desenho";
import { frustoOrtografico } from "../projecao";
import { CAIXA, type EstadoDaCena } from "../roteiro";

/**
 * A casa em three.js: a MESMA planta do SVG, com luz de verdade.
 *
 * O SVG já conta a história inteira; isto existe para o que só uma cena 3D
 * faz: luz pontual caindo nas paredes e nos móveis do cômodo aceso, o brilho da
 * lâmpada vazando pelo bloom e o tecido da cortina ondulando. A geometria, a
 * câmera e o roteiro são os mesmos, então o canvas pousa em cima do desenho
 * pixel a pixel (`projecao.test.ts` confere a câmera contra o three).
 *
 * Três decisões que parecem detalhe e não são:
 *
 * - **O número de luzes é fixo.** Hemisférica, direcional e uma `PointLight`
 *   por cômodo, sempre, com intensidade zero quando apagada. Mudar a contagem de
 *   luzes faz o three recompilar os programas, e isso aparece como um tranco
 *   no meio da rolagem, exatamente quando um cômodo acende.
 * - **Só a lâmpada floresce.** Ela é o único material com cor acima de 1
 *   (HDR, num alvo `HalfFloat`), e o limiar do bloom fica acima de tudo o
 *   mais. Um bloom que pega parede vira névoa sobre a cena inteira.
 * - **O canvas é opaco e soma por `screen`.** Um canvas transparente com bloom
 *   não fecha a conta: o passe de bloom não preserva alfa, e o fundo saía como
 *   um retângulo preto. Opaco sobre preto, com `mix-blend-mode: screen` no
 *   elemento (`planta-3d.tsx`), o preto some e o resto se soma à luz da
 *   página, que é exatamente o que uma cena noturna quer.
 */

const TUNGSTENIO = new Color("#ffb066");

/**
 * O que a cena alocou na GPU, para devolver no fim. Por instância, e não de
 * módulo: uma remontagem (a volta à raiz por dentro do site) cria outra cena, e
 * uma lista compartilhada faria o `descarta` da velha levar a nova junto.
 */
type Guarda = <T extends Material | BufferGeometry>(recurso: T) => T;

function criaGuarda(): { guarda: Guarda; libera: () => void } {
  const recursos: (Material | BufferGeometry)[] = [];
  return {
    guarda: (recurso) => {
      recursos.push(recurso);
      return recurso;
    },
    libera: () => {
      for (const recurso of recursos.splice(0)) recurso.dispose();
    },
  };
}

/** Uma caixa com as arestas desenhadas, como no SVG. */
function caixa(
  guarda: Guarda,
  aresta: LineBasicMaterial,
  [x0, z0, x1, z1]: Retangulo,
  altura: number,
  material: Material,
): Group {
  const grupo = new Group();
  const alto = Math.max(altura, 0.02);
  const geometria = guarda(new BoxGeometry(x1 - x0, alto, z1 - z0));
  const malha = new Mesh(geometria, material);
  malha.position.set((x0 + x1) / 2, alto / 2, (z0 + z1) / 2);
  const arestas = new LineSegments(guarda(new EdgesGeometry(geometria)), aresta);
  arestas.position.copy(malha.position);
  grupo.add(malha, arestas);
  return grupo;
}

/**
 * A dobra da cortina, no vértice. O tecido ondula em x com o tempo, mais solto
 * embaixo, e a normal é derivada da mesma onda para a luz do cômodo marcar as
 * pregas. `customProgramCacheKey` fixo: as cortinas compartilham um programa.
 */
function materialDaCortina(guarda: Guarda, tempo: { value: number }): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: "#d8dee8",
    roughness: 0.95,
    metalness: 0,
    side: DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTempo = tempo;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTempo;\nfloat onda(float x){ return sin(x * 26.0 + uTempo * 0.9) * 0.035 + sin(x * 61.0 - uTempo * 0.5) * 0.008; }",
      )
      .replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\nfloat inclinacao = cos(position.x * 26.0 + uTempo * 0.9) * 26.0 * 0.035;\nobjectNormal = normalize(vec3(-inclinacao, 0.0, 1.0));",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ntransformed.z += onda(position.x) * (0.6 + 0.4 * (1.0 - uv.y));",
      );
  };
  material.customProgramCacheKey = () => "cortina-da-planta";
  return guarda(material);
}

interface Cortina {
  comodo: ComodoId;
  pivo: Group;
}

interface Lampada {
  comodo: ComodoId;
  luz: PointLight;
  material: MeshBasicMaterial;
}

export interface Cena3d {
  desenha(estado: EstadoDaCena, tempo: number): void;
  redimensiona(largura: number, altura: number): void;
  /** Se algo na tela ainda está se mexendo sozinho (a cortina, hoje). */
  temMovimento(estado: EstadoDaCena): boolean;
  descarta(): void;
}

function janelaNaParede(
  guarda: Guarda,
  janela: Janela,
  cortina: boolean,
  tempo: { value: number },
  grupo: Group,
  cortinas: Cortina[],
  comodo: ComodoId,
) {
  const largura = janela.ate - janela.de;
  const altura = janela.verga - janela.peitoril;
  const meio = (janela.de + janela.ate) / 2;
  const noFundo = janela.parede === "fundo";
  const aplica = (objeto: Mesh | Group, afastamento: number, y: number) => {
    if (noFundo) objeto.position.set(meio, y, afastamento);
    else {
      objeto.position.set(afastamento, y, meio);
      objeto.rotation.y = Math.PI / 2;
    }
  };

  const vidro = new Mesh(
    guarda(new PlaneGeometry(largura, altura)),
    guarda(new MeshStandardMaterial({ color: "#0b1422", roughness: 0.2, metalness: 0.4 })),
  );
  aplica(vidro, 0.004, janela.peitoril + altura / 2);
  grupo.add(vidro);

  if (!cortina) return;
  // O pivô fica na VERGA: a cortina desce a partir dali, com `scale.y`.
  const pivo = new Group();
  aplica(pivo, 0.06, janela.verga);
  const tecido = new Mesh(guarda(new PlaneGeometry(largura + 0.12, altura, 48, 6)), materialDaCortina(guarda, tempo));
  tecido.position.y = -altura / 2;
  pivo.add(tecido);
  grupo.add(pivo);
  cortinas.push({ comodo, pivo });
}

export function criaCena3d(canvas: HTMLCanvasElement): Cena3d | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const cena = new Scene();
  const tempo = { value: 0 };
  const { guarda, libera } = criaGuarda();
  const materialDaFace = (cor: string) =>
    guarda(new MeshStandardMaterial({ color: cor, roughness: 0.86, metalness: 0 }));
  const aresta = guarda(
    new LineBasicMaterial({ color: "#94a3b8", transparent: true, opacity: 0.5 }),
  );

  // A luz da noite: o bastante para a casa apagada se ler como o desenho do
  // SVG, e pouco o bastante para o tungstênio de um cômodo aceso ganhar dela.
  cena.add(new HemisphereLight("#9fb3d4", "#0a0e14", 1.5));
  const lua = new DirectionalLight("#b4c6e6", 1.1);
  lua.position.set(-6, 14, 4);
  cena.add(lua);

  const casa = new Group();
  cena.add(casa);

  // Pisos, um por cômodo, e o deck da varanda um tom mais quente.
  for (const comodo of COMODOS) {
    const [x0, z0, x1, z1] = comodo.retangulo;
    const piso = new Mesh(
      guarda(new BoxGeometry(x1 - x0, 0.02, z1 - z0)),
      materialDaFace(comodo.id === "varanda" ? "#141a22" : "#10161f"),
    );
    piso.position.set((x0 + x1) / 2, -0.01, (z0 + z1) / 2);
    casa.add(piso);
  }

  const parede = materialDaFace("#1a2231");
  const mureta = materialDaFace("#1d2636");
  const movel = materialDaFace("#243044");
  const comCortina = new Set(ITENS.filter((i) => i.cortina).map((i) => i.comodo));
  const cortinas: Cortina[] = [];

  for (const p of PAREDES) {
    casa.add(caixa(guarda, aresta, caixaDaParede(p), p.altura, p.tipo === "mureta" ? mureta : parede));
  }
  for (const comodo of COMODOS) {
    if (comodo.janela) {
      janelaNaParede(guarda, comodo.janela, comCortina.has(comodo.id), tempo, casa, cortinas, comodo.id);
    }
  }
  for (const m of MOVEIS) casa.add(caixa(guarda, aresta, m.retangulo, m.altura, movel));

  // Um pendente por cômodo: o fio, a lâmpada (HDR, é o que floresce) e a luz.
  const lampadas: Lampada[] = [];
  const esfera = guarda(new SphereGeometry(0.075, 16, 12));
  const fio = guarda(
    new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute([0, PE_DIREITO - 0.25, 0, 0, 2.02, 0], 3),
    ),
  );
  for (const comodo of COMODOS) {
    const [x, z] = comodo.luz;
    const material = guarda(new MeshBasicMaterial({ color: "#3a3024" }));
    const lampada = new Mesh(esfera, material);
    lampada.position.set(x, 1.93, z);
    const cabo = new LineSegments(fio, aresta);
    cabo.position.set(x, 0, z);
    const luz = new PointLight(TUNGSTENIO, 0, 8, 1.2);
    luz.position.set(x, 1.8, z);
    casa.add(lampada, cabo, luz);
    lampadas.push({ comodo: comodo.id, luz, material });
  }

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

  const alvo = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, alvo);
  composer.addPass(new RenderPass(cena, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.85, 0.55, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const lampadaAcesa = new Color();
  const lampadaApagada = new Color("#3a3024");

  return {
    desenha(estado, segundos) {
      tempo.value = segundos;

      const f = frustoOrtografico(estado.camera, CAIXA);
      camera.left = f.left;
      camera.right = f.right;
      camera.top = f.top;
      camera.bottom = f.bottom;
      const [ax, az] = estado.camera.alvo;
      camera.position.set(ax + 40, 40, az + 40);
      camera.lookAt(ax, 0, az);
      camera.updateProjectionMatrix();

      for (const { comodo, luz, material } of lampadas) {
        const acesa = estado.luzes[comodo];
        luz.intensity = acesa * 16;
        // Acima de 1 de propósito: é isso que passa do limiar do bloom.
        lampadaAcesa.copy(TUNGSTENIO).multiplyScalar(1 + acesa * 5);
        material.color.lerpColors(lampadaApagada, lampadaAcesa, acesa);
      }
      for (const { comodo, pivo } of cortinas) {
        const descida = estado.cortinas[comodo];
        pivo.visible = descida > 0.001;
        pivo.scale.y = Math.max(descida, 0.001);
      }

      composer.render();
    },
    redimensiona(largura, altura) {
      renderer.setSize(largura, altura, false);
      composer.setSize(largura, altura);
      bloom.resolution.set(largura / 2, altura / 2);
    },
    temMovimento(estado) {
      return cortinas.some(({ comodo }) => estado.cortinas[comodo] > 0.001);
    },
    descarta() {
      libera();
      alvo.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
