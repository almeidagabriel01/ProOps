import { describe, expect, it } from "vitest";

import { COMODOS, ITENS, TOTAL_CENTAVOS } from "../../../_content/cena-planta";
import {
  ATOS,
  CAMERA_DE_REPOUSO,
  ESTADO_FINAL,
  atoEm,
  estadoDaCena,
  paraVariaveis,
  type EstadoDaCena,
} from "../roteiro";

const AMOSTRAS = Array.from({ length: 1001 }, (_, i) => i / 1000);

/** Todo número que é uma revelação, com um nome legível para a mensagem de erro. */
function revelacoes(e: EstadoDaCena): [string, number][] {
  const lista: [string, number][] = [
    ["saidaDoTexto", e.saidaDoTexto],
    ["recuoDaCasa", e.recuoDaCasa],
    ["proposta.entrada", e.proposta.entrada],
    ["proposta.codigo", e.proposta.codigo],
    ["assinatura", e.pagamento.assinatura],
    ["selo", e.pagamento.selo],
    ["divisao", e.pagamento.divisao],
    ["mensagem", e.mensagem],
  ];
  for (const c of COMODOS) {
    lista.push([`luz.${c.id}`, e.luzes[c.id]], [`cortina.${c.id}`, e.cortinas[c.id]]);
  }
  e.chips.forEach((chip, i) => {
    lista.push([`chip${i}.surge`, chip.surge], [`chip${i}.voo`, chip.voo], [`chip${i}.linha`, chip.linha]);
  });
  e.pagamento.partes.forEach((parte, i) => lista.push([`parte${i}`, parte]));
  return lista;
}

describe("roteiro da cena", () => {
  it("toda revelação fica entre 0 e 1", () => {
    for (const p of AMOSTRAS) {
      for (const [nome, valor] of revelacoes(estadoDaCena(p))) {
        expect(valor, `${nome} em ${p}`).toBeGreaterThanOrEqual(0);
        expect(valor, `${nome} em ${p}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("toda revelação só cresce com a rolagem (a cena desce e sobe sem saltos para trás)", () => {
    let anterior = revelacoes(estadoDaCena(0));
    for (const p of AMOSTRAS.slice(1)) {
      const atual = revelacoes(estadoDaCena(p));
      atual.forEach(([nome, valor], i) => {
        expect(valor, `${nome} em ${p}`).toBeGreaterThanOrEqual(anterior[i][1] - 1e-12);
      });
      anterior = atual;
    }
  });

  it("no começo nada está revelado, e no fim tudo está", () => {
    for (const [nome, valor] of revelacoes(estadoDaCena(0))) expect(valor, nome).toBe(0);
    for (const [nome, valor] of revelacoes(ESTADO_FINAL)) {
      // As cortinas sem item continuam abertas: o cômodo não tem cortina.
      if (nome.startsWith("cortina.")) continue;
      expect(valor, nome).toBe(1);
    }
    for (const comodo of COMODOS) {
      const temCortina = ITENS.some((i) => i.comodo === comodo.id && i.cortina);
      expect(ESTADO_FINAL.cortinas[comodo.id], comodo.id).toBe(temCortina ? 1 : 0);
    }
  });

  it("ESTADO_FINAL é o estado em p = 1, e p fora de [0, 1] é limitado", () => {
    expect(estadoDaCena(1)).toEqual(ESTADO_FINAL);
    expect(estadoDaCena(1.7)).toEqual(ESTADO_FINAL);
    expect(estadoDaCena(-0.4)).toEqual(estadoDaCena(0));
  });

  it("os atos são contíguos, cobrem [0, 1] e atoEm concorda com eles", () => {
    expect(ATOS[0].de).toBe(0);
    expect(ATOS[ATOS.length - 1].ate).toBe(1);
    for (let i = 1; i < ATOS.length; i++) expect(ATOS[i].de).toBe(ATOS[i - 1].ate);
    for (const ato of ATOS) {
      expect(atoEm((ato.de + ato.ate) / 2)).toBe(ato.id);
      expect(atoEm(ato.de)).toBe(ato.id);
    }
    expect(atoEm(1)).toBe("dinheiro");
  });

  it("cada coisa acontece no ato que a nomeia", () => {
    const inicio = (f: (e: EstadoDaCena) => number) =>
      AMOSTRAS.find((p) => f(estadoDaCena(p)) > 0) ?? 1;
    const fim = (f: (e: EstadoDaCena) => number) =>
      AMOSTRAS.find((p) => f(estadoDaCena(p)) >= 1) ?? 1;
    const ato = (id: string) => ATOS.find((a) => a.id === id)!;

    // Todo item surge durante o projeto.
    ITENS.forEach((_, i) => {
      expect(inicio((e) => e.chips[i].surge)).toBeGreaterThanOrEqual(ato("projeto").de);
      expect(fim((e) => e.chips[i].surge)).toBeLessThanOrEqual(ato("projeto").ate);
    });
    // A proposta monta durante o ato dela, e todo chip pousa antes de a linha dele encher.
    ITENS.forEach((_, i) => {
      expect(fim((e) => e.chips[i].voo)).toBeLessThanOrEqual(ato("proposta").ate);
      expect(fim((e) => e.chips[i].voo)).toBeLessThanOrEqual(fim((e) => e.chips[i].linha));
    });
    // A assinatura começa depois de o total fechar, e termina antes da divisão.
    const totalFechado = AMOSTRAS.find((p) => estadoDaCena(p).proposta.totalCentavos === TOTAL_CENTAVOS)!;
    expect(inicio((e) => e.pagamento.assinatura)).toBeGreaterThan(totalFechado);
    expect(inicio((e) => e.pagamento.assinatura)).toBeGreaterThanOrEqual(ato("aprovada").de);
    expect(fim((e) => e.pagamento.assinatura)).toBeLessThanOrEqual(inicio((e) => e.pagamento.divisao));
    // A mensagem só depois da aprovação.
    expect(inicio((e) => e.mensagem)).toBeGreaterThanOrEqual(ato("dinheiro").de);
  });

  it("o total cresce linha a linha até R$ 31.000,00", () => {
    let anterior = 0;
    for (const p of AMOSTRAS) {
      const total = estadoDaCena(p).proposta.totalCentavos;
      expect(Number.isInteger(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(anterior);
      anterior = total;
    }
    expect(ESTADO_FINAL.proposta.totalCentavos).toBe(TOTAL_CENTAVOS);
  });

  it("nunca há duas legendas inteiras ao mesmo tempo", () => {
    for (const p of AMOSTRAS) {
      const inteiras = Object.values(estadoDaCena(p).legendas).filter((v) => v > 0.5);
      expect(inteiras.length, `em ${p}`).toBeLessThanOrEqual(1);
    }
  });

  it("o ponteiro só acende luz, nunca apaga, e só no cômodo apontado", () => {
    for (const p of [0, 0.2, 0.5, 1]) {
      const semPonteiro = estadoDaCena(p);
      const comPonteiro = estadoDaCena(p, { varanda: 0.8 });
      for (const c of COMODOS) {
        expect(comPonteiro.luzes[c.id]).toBeGreaterThanOrEqual(semPonteiro.luzes[c.id]);
        if (c.id !== "varanda") expect(comPonteiro.luzes[c.id]).toBe(semPonteiro.luzes[c.id]);
      }
      expect(comPonteiro.luzes.varanda).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("a câmera começa e termina enquadrando a casa inteira, sem saltos", () => {
    expect(estadoDaCena(0).camera).toEqual(CAMERA_DE_REPOUSO);
    expect(ESTADO_FINAL.camera.alvo[0]).toBeCloseTo(CAMERA_DE_REPOUSO.alvo[0], 9);
    expect(ESTADO_FINAL.camera.alvo[1]).toBeCloseTo(CAMERA_DE_REPOUSO.alvo[1], 9);
    let anterior = estadoDaCena(0).camera;
    for (const p of AMOSTRAS.slice(1)) {
      const atual = estadoDaCena(p).camera;
      expect(Math.abs(atual.zoom - anterior.zoom), `zoom em ${p}`).toBeLessThan(0.02);
      expect(Math.abs(atual.alvo[0] - anterior.alvo[0]), `alvo x em ${p}`).toBeLessThan(0.15);
      expect(Math.abs(atual.alvo[1] - anterior.alvo[1]), `alvo z em ${p}`).toBeLessThan(0.15);
      anterior = atual;
    }
  });

  it("as variáveis têm as mesmas chaves em qualquer ponto e nas duas composições", () => {
    const chaves = Object.keys(paraVariaveis(estadoDaCena(0), "largo")).sort();
    for (const p of [0.13, 0.5, 0.77, 1]) {
      for (const layout of ["largo", "retrato"] as const) {
        expect(Object.keys(paraVariaveis(estadoDaCena(p), layout)).sort()).toEqual(chaves);
      }
    }
    for (const [nome, valor] of Object.entries(paraVariaveis(ESTADO_FINAL, "retrato"))) {
      expect(nome.startsWith("--"), nome).toBe(true);
      expect(valor, nome).not.toMatch(/NaN|Infinity/);
    }
  });

  it("no fim, nada fica fora do lugar: folha e mensagem em repouso", () => {
    const v = paraVariaveis(ESTADO_FINAL, "largo");
    expect(v["--folha-x"]).toBe("0cqw");
    expect(v["--folha-y"]).toBe("0cqh");
    expect(v["--mensagem-x"]).toBe("0cqw");
    expect(v["--mensagem-y"]).toBe("0cqh");
  });
});
