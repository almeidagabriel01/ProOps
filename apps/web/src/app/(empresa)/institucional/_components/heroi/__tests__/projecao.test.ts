import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";

import {
  COMODOS,
  LARGURA_DA_CASA,
  PE_DIREITO,
  PROFUNDIDADE_DA_CASA,
} from "../../../_content/cena-planta";
import {
  alvoDoQuadro,
  caixaDaCasa,
  comodoEm,
  daCaixaAoPiso,
  desprojetaNoPiso,
  frustoOrtografico,
  matrizDaParede,
  matrizDoPiso,
  naCaixa,
  projeta,
  type Camera,
  type Matriz,
  type Ponto3,
} from "../projecao";

const CAIXA = caixaDaCasa(LARGURA_DA_CASA, PROFUNDIDADE_DA_CASA, PE_DIREITO, 0.6);

const CAMERAS: Camera[] = [
  { zoom: 1, alvo: alvoDoQuadro(CAIXA) },
  { zoom: 1.4, alvo: [2, 2.25] },
  { zoom: 0.8, alvo: [10.25, 6] },
];

const PONTOS: Ponto3[] = [
  [0, 0, 0],
  [LARGURA_DA_CASA, 0, 0],
  [0, PE_DIREITO, 0],
  [LARGURA_DA_CASA, 0, PROFUNDIDADE_DA_CASA],
  [4.2, 1.1, 3.3],
  [9, 2.1, 6.25],
];

/**
 * A câmera do three montada do jeito que `planta-3d.tsx` a monta: na diagonal
 * (1, 1, 1) a partir do alvo, olhando para ele, com o frustum de
 * `frustoOrtografico`. Se isto e `naCaixa` concordam, o canvas pousa em cima do
 * SVG.
 */
function cameraDoThree(camera: Camera): OrthographicCamera {
  const f = frustoOrtografico(camera, CAIXA);
  const cam = new OrthographicCamera(f.left, f.right, f.top, f.bottom, 0.1, 200);
  const [ax, az] = camera.alvo;
  cam.position.set(ax + 40, 40, az + 40);
  cam.up.set(0, 1, 0);
  cam.lookAt(ax, 0, az);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

describe("projecao", () => {
  it("é a isometria do three, escalada: os dois renderizadores dão o mesmo quadro", () => {
    for (const camera of CAMERAS) {
      const cam = cameraDoThree(camera);
      for (const ponto of PONTOS) {
        const ndc = new Vector3(ponto[0], ponto[1], ponto[2]).project(cam);
        const [fx, fy] = naCaixa(ponto, camera, CAIXA);
        expect(fx).toBeCloseTo((ndc.x + 1) / 2, 6);
        expect(fy).toBeCloseTo((1 - ndc.y) / 2, 6);
      }
    }
  });

  it("desprojetar o piso desfaz a projeção", () => {
    for (const [x, , z] of PONTOS) {
      const [u, v] = projeta([x, 0, z]);
      const [x2, z2] = desprojetaNoPiso([u, v]);
      expect(x2).toBeCloseTo(x, 9);
      expect(z2).toBeCloseTo(z, 9);
    }
  });

  it("da fração do quadro de volta ao piso, sob qualquer câmera", () => {
    for (const camera of CAMERAS) {
      for (const [x, , z] of PONTOS) {
        const fracao = naCaixa([x, 0, z], camera, CAIXA);
        const [x2, z2] = daCaixaAoPiso(fracao, camera, CAIXA);
        expect(x2).toBeCloseTo(x, 9);
        expect(z2).toBeCloseTo(z, 9);
      }
    }
  });

  it("o alvo da câmera cai no centro do quadro", () => {
    for (const camera of CAMERAS) {
      const [fx, fy] = naCaixa([camera.alvo[0], 0, camera.alvo[1]], camera, CAIXA);
      expect(fx).toBeCloseTo(0.5, 9);
      expect(fy).toBeCloseTo(0.5, 9);
    }
  });

  it("a casa inteira cabe no quadro com a câmera de repouso", () => {
    const camera = CAMERAS[0];
    for (const x of [0, LARGURA_DA_CASA])
      for (const z of [0, PROFUNDIDADE_DA_CASA])
        for (const y of [0, PE_DIREITO]) {
          const [fx, fy] = naCaixa([x, y, z], camera, CAIXA);
          expect(fx).toBeGreaterThan(0);
          expect(fx).toBeLessThan(1);
          expect(fy).toBeGreaterThan(0);
          expect(fy).toBeLessThan(1);
        }
  });

  it("o centro de cada cômodo cai nele mesmo, e fora da casa não há cômodo", () => {
    for (const comodo of COMODOS) {
      const [x0, z0, x1, z1] = comodo.retangulo;
      expect(comodoEm([(x0 + x1) / 2, (z0 + z1) / 2], COMODOS)).toBe(comodo.id);
      expect(comodoEm(comodo.luz, COMODOS)).toBe(comodo.id);
    }
    expect(comodoEm([-1, 2], COMODOS)).toBeNull();
    expect(comodoEm([LARGURA_DA_CASA + 0.5, 2], COMODOS)).toBeNull();
  });

  it("as matrizes do SVG levam o plano local ao mesmo ponto que projeta()", () => {
    const aplica = (m: Matriz, a: number, b: number) => [
      m[0] * a + m[2] * b + m[4],
      m[1] * a + m[3] * b + m[5],
    ];
    // Piso na altura 1,1 (o tampo de uma divisória).
    const [pu, pv] = aplica(matrizDoPiso(1.1), 3, 2);
    expect(pu).toBeCloseTo(projeta([3, 1.1, 2])[0], 9);
    expect(pv).toBeCloseTo(projeta([3, 1.1, 2])[1], 9);
    // Parede ao longo de x, na cota z = 4,5.
    const [xu, xv] = aplica(matrizDaParede("x", 4.5), 6, 1);
    expect(xu).toBeCloseTo(projeta([6, 1, 4.5])[0], 9);
    expect(xv).toBeCloseTo(projeta([6, 1, 4.5])[1], 9);
    // Parede ao longo de z, na cota x = 0.
    const [zu, zv] = aplica(matrizDaParede("z", 0), 2.2, 2);
    expect(zu).toBeCloseTo(projeta([0, 2, 2.2])[0], 9);
    expect(zv).toBeCloseTo(projeta([0, 2, 2.2])[1], 9);
  });
});
