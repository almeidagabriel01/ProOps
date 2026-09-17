import { describe, expect, it } from "vitest";

import {
  OPERACOES,
  PEDIDOS,
  ROTULO_DA_ENTIDADE,
  textoDoPedido,
  type Entidade,
} from "../_content/comandos";
import { CENAS } from "../_components/comandos/cenas";
import { ritmo } from "../_components/comandos/leitura-do-pedido";
import {
  ANGULO_POR_LINHA,
  LINHAS_VISIVEIS,
  deslocamento,
  estiloDaLinha,
  indiceNaPosicao,
  posicaoDeParada,
  posicaoMaisProxima,
  raioParaAltura,
} from "../_components/comandos/roda-math";
import {
  estadoInicial,
  revezamento,
} from "../_components/comandos/use-revezamento";

const entidadesDaFrase = (partes: (typeof PEDIDOS)[number]["partes"]) =>
  partes.flatMap((parte) =>
    typeof parte === "string" ? [] : [parte.entidade],
  );

describe("os pedidos da leitura ao vivo", () => {
  it("têm id e frase únicos", () => {
    const ids = PEDIDOS.map((p) => p.id);
    const frases = PEDIDOS.map(textoDoPedido);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(frases).size).toBe(frases.length);
  });

  /**
   * A falha que isto pega não quebra nada: um campo que aponta uma entidade
   * ausente da frase fica invisível para sempre, esperando um token que nunca
   * voa até ele.
   */
  it("todo campo com entidade acha essa entidade na frase", () => {
    for (const pedido of PEDIDOS) {
      const naFrase = entidadesDaFrase(pedido.partes);
      for (const campo of pedido.campos) {
        if (!campo.entidade) continue;
        expect(naFrase, `${pedido.id}: ${campo.rotulo}`).toContain(
          campo.entidade,
        );
      }
    }
  });

  /**
   * O seletor da leitura é `[data-token="<entidade>"]`: a mesma entidade duas
   * vezes numa frase faria os dois campos voarem do primeiro token.
   */
  it("não repete entidade dentro de uma frase, nem entre campos", () => {
    for (const pedido of PEDIDOS) {
      const naFrase = entidadesDaFrase(pedido.partes);
      expect(new Set(naFrase).size, pedido.id).toBe(naFrase.length);
      const nosCampos = pedido.campos.flatMap((c) =>
        c.entidade ? [c.entidade] : [],
      );
      expect(new Set(nosCampos).size, pedido.id).toBe(nosCampos.length);
    }
  });

  it("toda entidade marcada vira algum campo da ficha", () => {
    for (const pedido of PEDIDOS) {
      const nosCampos = new Set<Entidade>(
        pedido.campos.flatMap((c) => (c.entidade ? [c.entidade] : [])),
      );
      for (const entidade of entidadesDaFrase(pedido.partes)) {
        expect(nosCampos.has(entidade), `${pedido.id}: ${entidade}`).toBe(true);
      }
    }
  });

  it("toda entidade tem rótulo, e o trecho marcado não é vazio", () => {
    for (const pedido of PEDIDOS) {
      for (const parte of pedido.partes) {
        if (typeof parte === "string") continue;
        expect(parte.texto.trim()).not.toBe("");
        expect(ROTULO_DA_ENTIDADE[parte.entidade]).toBeTruthy();
      }
    }
  });

  it("pergunta e simulação respondem; os outros pedidos não", () => {
    for (const pedido of PEDIDOS) {
      const responde =
        pedido.intencao === "Pergunta" || pedido.intencao === "Simulação";
      expect(Boolean(pedido.resposta), pedido.id).toBe(responde);
    }
  });

  /** Frases com cara de WhatsApp: a página inteira depende disso. */
  it("são escritas em minúsculas", () => {
    for (const pedido of PEDIDOS) {
      const texto = textoDoPedido(pedido);
      expect(texto, pedido.id).toBe(texto.toLowerCase());
    }
  });
});

describe("as operações da mesa", () => {
  it("têm cena registrada, sem repetir cena", () => {
    const cenas = OPERACOES.map((o) => o.cena);
    expect(new Set(cenas).size).toBe(cenas.length);
    for (const cena of cenas) expect(CENAS[cena], cena).toBeTypeOf("function");
  });

  it("todo pedido da mesa também está na roda", () => {
    const frases = new Set(PEDIDOS.map(textoDoPedido));
    for (const operacao of OPERACOES) {
      expect(frases.has(operacao.pedido), operacao.pedido).toBe(true);
    }
  });
});

describe("a geometria da roda", () => {
  const total = 16;

  it("mede a distância pelo lado mais curto do cilindro", () => {
    expect(deslocamento(0, 0, total)).toBe(0);
    expect(deslocamento(1, 0, total)).toBe(1);
    // A última frase fica ACIMA da primeira, e não 15 linhas abaixo.
    expect(deslocamento(15, 0, total)).toBe(-1);
    expect(deslocamento(0, 15, total)).toBe(1);
    expect(deslocamento(3, 2.5, total)).toBeCloseTo(0.5);
  });

  it("acha a frase do centro para qualquer posição, inclusive negativa", () => {
    expect(indiceNaPosicao(0, total)).toBe(0);
    expect(indiceNaPosicao(2.4, total)).toBe(2);
    expect(indiceNaPosicao(2.6, total)).toBe(3);
    expect(indiceNaPosicao(-1, total)).toBe(15);
    expect(indiceNaPosicao(33, total)).toBe(1);
  });

  it("vai da última para a primeira em um passo para a frente", () => {
    expect(posicaoMaisProxima(15, 0, total)).toBe(16);
    expect(posicaoMaisProxima(16, 15, total)).toBe(15);
    expect(posicaoMaisProxima(40, 9, total)).toBe(41);
  });

  it("projeta o arremesso e para numa linha inteira, com teto", () => {
    expect(posicaoDeParada(3.2, 0)).toBe(3);
    expect(posicaoDeParada(3.2, 10)).toBe(5);
    expect(posicaoDeParada(0, 1000)).toBe(6);
    expect(posicaoDeParada(0, -1000)).toBe(-6);
  });

  it("apaga a linha além do alcance e deixa a do centro inteira", () => {
    const centro = estiloDaLinha(0, 100);
    expect(centro.opacity).toBe(1);
    expect(centro.visivel).toBe(true);
    expect(centro.transform).toContain("rotateX(0.000deg)");

    const borda = estiloDaLinha(LINHAS_VISIVEIS, 100);
    expect(borda.visivel).toBe(true);
    expect(borda.opacity).toBeGreaterThan(0);

    const fora = estiloDaLinha(LINHAS_VISIVEIS + 1, 100);
    expect(fora.visivel).toBe(false);
    expect(fora.opacity).toBe(0);
  });

  it("escolhe um raio que põe linhas vizinhas a uma altura de distância", () => {
    const altura = 44;
    const raio = raioParaAltura(altura);
    const corda = 2 * raio * Math.sin((ANGULO_POR_LINHA * Math.PI) / 360);
    expect(corda).toBeCloseTo(altura, 6);
  });
});

describe("o revezamento", () => {
  it("avança em círculo enquanto ninguém mexe", () => {
    let estado = estadoInicial();
    for (let i = 0; i < 3; i += 1) {
      estado = revezamento(estado, { tipo: "avancar", total: 3 });
    }
    expect(estado.indice).toBe(0);
    expect(estado.volta).toBe(3);
  });

  it("a escolha da pessoa desliga o automático, e o avanço para", () => {
    let estado = revezamento(estadoInicial(), { tipo: "escolher", indice: 4 });
    expect(estado).toMatchObject({ indice: 4, automatico: false });
    estado = revezamento(estado, { tipo: "avancar", total: 16 });
    expect(estado.indice).toBe(4);
  });

  it("pausar segura o índice, e o mesmo botão retoma", () => {
    let estado = revezamento(estadoInicial(), { tipo: "alternar" });
    expect(estado.pausado).toBe(true);
    expect(revezamento(estado, { tipo: "avancar", total: 5 }).indice).toBe(0);
    estado = revezamento(estado, { tipo: "alternar" });
    expect(estado).toMatchObject({ pausado: false, automatico: true });
  });

  it("o botão devolve o automático depois que a pessoa assumiu", () => {
    let estado = revezamento(estadoInicial(), { tipo: "escolher", indice: 2 });
    estado = revezamento(estado, { tipo: "alternar" });
    expect(estado).toMatchObject({ automatico: true, pausado: false });
    expect(revezamento(estado, { tipo: "avancar", total: 5 }).indice).toBe(3);
  });

  it("cada troca recomeça a barra de tempo", () => {
    const antes = estadoInicial();
    const depois = revezamento(antes, {
      tipo: "escolher",
      indice: antes.indice,
    });
    expect(depois.volta).toBe(antes.volta + 1);
  });
});

describe("o ritmo da digitação", () => {
  it("é determinístico, e pausa mais em espaço e pontuação", () => {
    expect(ritmo("a", 7)).toBe(ritmo("a", 7));
    expect(ritmo(" ", 7)).toBeGreaterThan(ritmo("a", 7));
    expect(ritmo("?", 7)).toBeGreaterThan(ritmo(" ", 7));
    for (let i = 0; i < 60; i += 1) {
      expect(ritmo("a", i)).toBeGreaterThanOrEqual(0.032);
      expect(ritmo("a", i)).toBeLessThanOrEqual(0.062);
    }
  });
});
