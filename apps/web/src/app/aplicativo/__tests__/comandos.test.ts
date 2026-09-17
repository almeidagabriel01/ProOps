import { describe, expect, it } from "vitest";

import {
  OPERACOES,
  PEDIDOS,
  ROTULO_DA_ENTIDADE,
  textoDoPedido,
  type Entidade,
} from "../_content/comandos";
import { CENAS } from "../_components/comandos/cenas";
import { RITMO, ritmo } from "../_components/comandos/leitura-do-pedido";
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
  ANIMA_ATE,
  GIRO,
  indiceDaFatia,
  posicaoDaRoda,
  progressoComEntrada,
  progressoDaParada,
  progressoDaPosicao,
  progressoNaFatia,
} from "../_components/comandos/fatias";

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

describe("as fatias da rolagem", () => {
  const total = 16;

  it("divide o progresso em fatias iguais, e o fim pertence à última", () => {
    expect(indiceDaFatia(0, total)).toBe(0);
    expect(indiceDaFatia(1 / total - 0.0001, total)).toBe(0);
    expect(indiceDaFatia(1 / total, total)).toBe(1);
    expect(indiceDaFatia(1, total)).toBe(total - 1);
    expect(indiceDaFatia(-0.2, total)).toBe(0);
  });

  it("anima só a primeira parte da fatia, e segura o resto", () => {
    const inicio = 3 / total;
    expect(progressoNaFatia(inicio, 3, total)).toBe(0);
    expect(
      progressoNaFatia(inicio + ANIMA_ATE / 2 / total, 3, total),
    ).toBeCloseTo(0.5);
    expect(progressoNaFatia(inicio + ANIMA_ATE / total, 3, total)).toBeCloseTo(
      1,
      10,
    );
    expect(progressoNaFatia(inicio + 0.95 / total, 3, total)).toBe(1);
    // Fatias vizinhas não vazam: a anterior está completa, a seguinte zerada.
    expect(progressoNaFatia(inicio, 2, total)).toBe(1);
    expect(progressoNaFatia(inicio, 4, total)).toBe(0);
  });

  /**
   * A primeira fatia se monta na aproximação, antes de o palco grudar: sem
   * isso a seção chegava com um cartão vazio. As outras seguem a rolagem.
   */
  it("a primeira fatia segue a entrada do palco, as outras o trilho", () => {
    expect(progressoComEntrada(0, 0, 0, total)).toBe(0);
    expect(progressoComEntrada(0, 0.5, 0, total)).toBe(0.5);
    expect(progressoComEntrada(0, 1, 0, total)).toBe(1);
    // Já no trilho, a primeira fatia fica pronta, parada.
    expect(progressoComEntrada(0.9 / total, 1, 0, total)).toBe(1);
    expect(progressoComEntrada(0, 1, 1, total)).toBe(0);
    expect(
      progressoComEntrada((1 + ANIMA_ATE / 2) / total, 1, 1, total),
    ).toBeCloseTo(0.5);
  });

  /**
   * O clique leva a página a um ponto em que a fatia escolhida já está
   * montada. Uma parada antes do fim da animação deixaria a ficha pela metade
   * justamente para quem pediu aquela frase.
   */
  it("a parada de um clique cai na fatia certa, com a animação completa", () => {
    for (let i = 0; i < total; i += 1) {
      const alvo = progressoDaParada(i, total);
      expect(indiceDaFatia(alvo, total)).toBe(i);
      expect(progressoNaFatia(alvo, i, total)).toBe(1);
    }
  });

  it("a roda cruza a lente no instante em que a fatia troca", () => {
    // Na fronteira entre as fatias 4 e 5, a roda está a meia linha das duas.
    expect(posicaoDaRoda(5 / total, total)).toBeCloseTo(4.5);
    expect(posicaoDaRoda(5 / total - 1e-9, total)).toBeCloseTo(4.5);
  });

  it("começa e termina com uma frase na lente, sem meia linha vazia", () => {
    expect(posicaoDaRoda(0, total)).toBe(0);
    expect(posicaoDaRoda(1, total)).toBe(total - 1);
  });

  it("a roda fica parada e centrada enquanto a frase é lida", () => {
    for (const local of [GIRO, 0.3, ANIMA_ATE, 0.85]) {
      expect(posicaoDaRoda((7 + local) / total, total)).toBe(7);
    }
  });

  it("a roda nunca anda para trás enquanto a página desce", () => {
    let anterior = -Infinity;
    for (let i = 0; i <= 2000; i += 1) {
      const atual = posicaoDaRoda(i / 2000, total);
      expect(atual).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = atual;
    }
  });

  it("arrastar a roda até uma frase ou fronteira leva a página a ela", () => {
    for (const x of [3, 3.5, 9, 14.5]) {
      expect(posicaoDaRoda(progressoDaPosicao(x, total), total)).toBeCloseTo(x);
    }
    expect(progressoDaPosicao(-5, total)).toBe(0);
    expect(progressoDaPosicao(99, total)).toBe(1);
  });
});

describe("o ritmo da digitação", () => {
  it("é determinístico, e pausa mais em espaço e pontuação", () => {
    expect(ritmo("a", 7)).toBe(ritmo("a", 7));
    expect(ritmo(" ", 7)).toBeGreaterThan(ritmo("a", 7));
    expect(ritmo("?", 7)).toBeGreaterThan(ritmo(" ", 7));
    for (let i = 0; i < 60; i += 1) {
      expect(ritmo("a", i)).toBeGreaterThanOrEqual(RITMO.base);
      expect(ritmo("a", i)).toBeLessThanOrEqual(RITMO.base + RITMO.variacao);
    }
  });
});
