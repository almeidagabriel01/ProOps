import { buildProposalCodePreview } from "@/lib/proposal-numbering";

/**
 * A casa da cena da landing do ERP, como DADO.
 *
 * A cena conta o caminho do produto numa casa só: a equipe especifica os
 * cômodos, os cômodos viram itens, os itens montam a proposta, o cliente
 * assina e o pagamento nasce no financeiro. Três coisas leem este arquivo, e é
 * por isso que ele é dado e não markup:
 *
 * - o renderizador SVG (`planta-svg.tsx`), que é o que o celular, a corrida do
 *   Lighthouse e quem pede menos movimento veem;
 * - o renderizador three.js (`planta-3d.tsx`), só desktop;
 * - o roteiro puro (`roteiro.ts`), que diz o que cada um deles mostra em cada
 *   ponto da rolagem.
 *
 * Com a mesma planta alimentando os dois renderizadores, o 3D pousa exatamente
 * em cima do SVG, e a troca de um pelo outro não se vê.
 *
 * Unidades: METROS, no plano do piso. `x` cresce para a direita da planta e `z`
 * para a frente dela; `y` é a altura. A parede `z = 0` e a parede `x = 0` são as
 * duas do fundo, as únicas que a projeção isométrica mostra por dentro, e por
 * isso as únicas de pé direito inteiro: as da frente são mureta, e as divisórias
 * são cortadas na altura do corte, como numa maquete.
 */

export type ComodoId = "suite" | "quarto" | "sala" | "cozinha" | "varanda";

/** Retângulo no piso: `[x0, z0, x1, z1]`, com `x0 < x1` e `z0 < z1`. */
export type Retangulo = readonly [number, number, number, number];

/**
 * Uma janela numa das duas paredes do fundo.
 *
 * `de`/`ate` correm AO LONGO da parede (em `x` para a do fundo, em `z` para a
 * lateral); `peitoril` e `verga` são as alturas de baixo e de cima do vão.
 */
export interface Janela {
  parede: "fundo" | "lateral";
  de: number;
  ate: number;
  peitoril: number;
  verga: number;
}

export interface Comodo {
  id: ComodoId;
  nome: string;
  retangulo: Retangulo;
  janela?: Janela;
  /** Onde fica o pendente, no piso. A luz cai ali. */
  luz: readonly [number, number];
}

/**
 * Um trecho de parede.
 *
 * `eixo: "x"` corre ao longo de `x` na cota `z = fixo`; `eixo: "z"` corre ao
 * longo de `z` na cota `x = fixo`. As paredes são declaradas à mão e não
 * derivadas das bordas dos cômodos: duas bordas vizinhas raramente têm o mesmo
 * comprimento (a sala e a varanda dividem só parte da divisa), e o algoritmo que
 * as reconcilia é mais código do que a lista inteira. O teste
 * `cena-planta.test.ts` confere que toda borda de cômodo tem parede em cima.
 */
export interface Parede {
  eixo: "x" | "z";
  fixo: number;
  de: number;
  ate: number;
  altura: number;
  tipo: "fundo" | "divisoria" | "mureta";
}

/**
 * Um móvel, como caixa baixa. `altura` perto de zero é tapete: só o tampo.
 *
 * Não é enfeite. Uma planta sem móvel é um diagrama de áreas, e o que faz uma
 * casa ser lida como casa, de relance, é a cama no quarto e o sofá na sala.
 */
export interface Movel {
  comodo: ComodoId;
  retangulo: Retangulo;
  altura: number;
}

export const MOVEIS: readonly Movel[] = [
  { comodo: "suite", retangulo: [0.12, 1.3, 2.2, 3.1], altura: 0.5 },
  { comodo: "suite", retangulo: [0.12, 3.25, 0.62, 3.75], altura: 0.55 },
  { comodo: "quarto", retangulo: [4.25, 1.2, 5.25, 3.2], altura: 0.45 },
  { comodo: "quarto", retangulo: [6.5, 3.55, 7.35, 4.35], altura: 0.75 },
  { comodo: "sala", retangulo: [8.6, 1.1, 11.6, 2.9], altura: 0.02 },
  { comodo: "sala", retangulo: [8.4, 3.05, 11.8, 3.95], altura: 0.8 },
  { comodo: "cozinha", retangulo: [0.12, 4.7, 0.75, 7.85], altura: 0.9 },
  { comodo: "cozinha", retangulo: [2.1, 5.6, 3.7, 6.6], altura: 0.9 },
  { comodo: "varanda", retangulo: [8.2, 5.4, 10, 6.9], altura: 0.75 },
  { comodo: "varanda", retangulo: [11.3, 5.1, 12.5, 7.4], altura: 0.35 },
];

export interface Item {
  id: string;
  comodo: ComodoId;
  /** Inteiro, em centavos. Dinheiro nunca é número de ponto flutuante aqui. */
  centavos: number;
  /** O item é uma cortina ou persiana, e a janela do cômodo ganha uma. */
  cortina: boolean;
}

/** Pé direito das paredes do fundo. */
export const PE_DIREITO = 2.7;
/** Altura do corte das divisórias: a maquete é cortada aqui. */
export const CORTE = 1.1;
/** As paredes da frente ficam só como mureta, para não taparem a casa. */
export const MURETA = 0.32;
/** Espessura desenhada das paredes. */
export const ESPESSURA = 0.14;

export const LARGURA_DA_CASA = 13;
export const PROFUNDIDADE_DA_CASA = 8;

export const COMODOS: readonly Comodo[] = [
  {
    id: "suite",
    nome: "Suíte",
    retangulo: [0, 0, 4, 4.5],
    janela: { parede: "fundo", de: 0.7, ate: 3.3, peitoril: 0.55, verga: 2.35 },
    luz: [2, 2.25],
  },
  {
    id: "quarto",
    nome: "Quarto",
    retangulo: [4, 0, 7.5, 4.5],
    janela: { parede: "fundo", de: 4.7, ate: 6.8, peitoril: 0.6, verga: 2.3 },
    luz: [5.75, 2.25],
  },
  {
    id: "sala",
    nome: "Sala",
    retangulo: [7.5, 0, 13, 4.5],
    janela: { parede: "fundo", de: 8.3, ate: 12.2, peitoril: 0.08, verga: 2.45 },
    luz: [10.25, 2.25],
  },
  {
    id: "cozinha",
    nome: "Cozinha",
    retangulo: [0, 4.5, 5, 8],
    janela: { parede: "lateral", de: 5.4, ate: 7.1, peitoril: 1.05, verga: 2.2 },
    luz: [2.5, 6.25],
  },
  {
    id: "varanda",
    nome: "Varanda",
    retangulo: [5, 4.5, 13, 8],
    luz: [9, 6.25],
  },
];

export const PAREDES: readonly Parede[] = [
  // As duas do fundo, de pé direito inteiro. É nelas que ficam as janelas.
  { eixo: "x", fixo: 0, de: 0, ate: LARGURA_DA_CASA, altura: PE_DIREITO, tipo: "fundo" },
  { eixo: "z", fixo: 0, de: 0, ate: PROFUNDIDADE_DA_CASA, altura: PE_DIREITO, tipo: "fundo" },
  // Divisórias, cortadas.
  { eixo: "x", fixo: 4.5, de: 0, ate: LARGURA_DA_CASA, altura: CORTE, tipo: "divisoria" },
  { eixo: "z", fixo: 4, de: 0, ate: 4.5, altura: CORTE, tipo: "divisoria" },
  { eixo: "z", fixo: 7.5, de: 0, ate: 4.5, altura: CORTE, tipo: "divisoria" },
  { eixo: "z", fixo: 5, de: 4.5, ate: PROFUNDIDADE_DA_CASA, altura: CORTE, tipo: "divisoria" },
  // A frente, como mureta.
  { eixo: "x", fixo: PROFUNDIDADE_DA_CASA, de: 0, ate: LARGURA_DA_CASA, altura: MURETA, tipo: "mureta" },
  { eixo: "z", fixo: LARGURA_DA_CASA, de: 0, ate: PROFUNDIDADE_DA_CASA, altura: MURETA, tipo: "mureta" },
];

/**
 * Os itens, NA ORDEM em que a cena os especifica.
 *
 * A soma é R$ 31.000,00, e isso é escolha e não acaso: com entrada de 40% e três
 * parcelas, a entrada dá R$ 12.400,00 e cada parcela R$ 6.200,00, números
 * redondos que se leem de relance numa cena que passa rolando.
 */
export const ITENS: readonly Item[] = [
  { id: "cortina-suite", comodo: "suite", centavos: 685_000, cortina: true },
  { id: "persiana-quarto", comodo: "quarto", centavos: 342_000, cortina: true },
  { id: "cena-sala", comodo: "sala", centavos: 798_000, cortina: false },
  { id: "cortina-sala", comodo: "sala", centavos: 589_000, cortina: true },
  { id: "embutida-cozinha", comodo: "cozinha", centavos: 276_000, cortina: false },
  { id: "som-varanda", comodo: "varanda", centavos: 410_000, cortina: false },
];

/**
 * O MESMO projeto, escrito no vocabulário de três negócios diferentes.
 *
 * É a tese da página em forma de cena: o que muda de um nicho para o outro é o
 * catálogo e as palavras, e não a base. Por isso o nicho troca só os RÓTULOS:
 * os cômodos, os preços e as cortinas que descem são os mesmos, e a cena não
 * precisa ser remontada quando alguém troca de aba.
 *
 * `marcenaria` está aqui de propósito, e é o ponto todo: ela não é um dos dois
 * nichos configurados hoje (`lib/niches/config.ts`), é o exemplo de um nicho
 * NOVO, adaptado para a operação de quem chega. Quem vende projeto e não vende
 * automação nem cortina precisa se ver na página antes de acreditar na frase.
 */
export type NichoDaCena = "automacao" | "cortinas" | "marcenaria";

export interface Nicho {
  id: NichoDaCena;
  /** O que a aba mostra. */
  rotulo: string;
  /** Uma linha, debaixo da cena. */
  nota: string;
  /** Um rótulo por item de `ITENS`, na mesma ordem. */
  rotulos: readonly string[];
}

export const NICHOS: readonly Nicho[] = [
  {
    id: "automacao",
    rotulo: "Automação residencial",
    nota: "Catálogo, ambientes e proposta técnica: o pacote que já vem pronto.",
    rotulos: [
      "Cortina blackout motorizada",
      "Persiana rolô automatizada",
      "Cena de iluminação",
      "Cortina de linho motorizada",
      "Iluminação embutida",
      "Som ambiente",
    ],
  },
  {
    id: "cortinas",
    rotulo: "Cortinas e decoração",
    nota: "Cálculo por medida, catálogo de tecidos: o outro pacote pronto.",
    rotulos: [
      "Cortina blackout, trilho motorizado",
      "Persiana rolô dupla visão",
      "Papel de parede",
      "Cortina de linho, trilho suíço",
      "Persiana romana",
      "Tapete e almofadas sob medida",
    ],
  },
  {
    id: "marcenaria",
    rotulo: "Marcenaria",
    nota: "Um nicho novo: a ProOps configura catálogo, campos e etapas para ele.",
    rotulos: [
      "Armário planejado",
      "Cabeceira ripada",
      "Painel de TV",
      "Estante sob medida",
      "Bancada e torre quente",
      "Deck e banco",
    ],
  },
];

export const NICHO_PADRAO: NichoDaCena = "automacao";

export function nichoPorId(id: NichoDaCena): Nicho {
  const nicho = NICHOS.find((n) => n.id === id);
  if (!nicho) throw new Error(`Nicho desconhecido na cena: ${id}`);
  return nicho;
}
/**
 * A proposta de exemplo. O código sai da MESMA função que a tela de
 * configuração da numeração usa (`lib/proposal-numbering.ts`), então o herói
 * mostra um código que o produto de fato imprimiria.
 *
 * É um exemplo, e o resumo para leitor de tela diz isso: um cliente e um valor
 * numa página institucional se leem como caso real se nada disser o contrário.
 */
export const PROPOSTA = {
  codigo: buildProposalCodePreview({ number: 189, year: 2026, praca: "SP" }),
  cliente: "Casa Moreira",
  entradaPercentual: 40,
  parcelas: 3,
} as const;

const REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * O único formatador de dinheiro da cena. As linhas da proposta, o total e a
 * divisão em parcelas passam todos por aqui, e é isso que impede que um deles
 * diga um valor que o outro não diz.
 */
export function formataReais(centavos: number): string {
  return REAIS.format(centavos / 100);
}

export const TOTAL_CENTAVOS = ITENS.reduce((soma, item) => soma + item.centavos, 0);

/**
 * Entrada e parcelas, em centavos inteiros. A sobra de arredondamento, se
 * houver, vai para a ÚLTIMA parcela, que é como um financeiro de verdade fecha a
 * conta: a soma das partes é sempre o total, ao centavo.
 */
export function divisaoDoPagamento(
  total = TOTAL_CENTAVOS,
  percentual: number = PROPOSTA.entradaPercentual,
  parcelas: number = PROPOSTA.parcelas,
): { entrada: number; parcelas: number[] } {
  const entrada = Math.round((total * percentual) / 100);
  const restante = total - entrada;
  const base = Math.floor(restante / parcelas);
  const lista = Array.from({ length: parcelas }, () => base);
  lista[parcelas - 1] += restante - base * parcelas;
  return { entrada, parcelas: lista };
}

export const PAGAMENTO = divisaoDoPagamento();

export function comodoPorId(id: ComodoId): Comodo {
  const comodo = COMODOS.find((c) => c.id === id);
  if (!comodo) throw new Error(`Cômodo desconhecido: ${id}`);
  return comodo;
}

/** O centro do cômodo, no piso. É para onde a câmera olha quando o visita. */
export function centroDoComodo(id: ComodoId): readonly [number, number] {
  const [x0, z0, x1, z1] = comodoPorId(id).retangulo;
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

/**
 * A partir de que largura a cena usa a composição lado a lado.
 *
 * Abaixo disso o texto fica em cima e a casa ocupa a tela; é a mesma chave que
 * os `lg:` do markup usam, e o diretor lê a mesma string para escolher o
 * `LAYOUT` que escreve.
 */
export const LARGO_QUERY = "(min-width: 1024px)";

export type LayoutId = "largo" | "retrato";

/**
 * Quanto cada peça ANDA, por composição. Só deslocamento: onde cada uma
 * repousa é o markup (classes do Tailwind), e o diretor mede isso em vez de
 * repetir aqui.
 *
 * `cqw`/`cqh` do palco, que é o container. Percentagem não serviria: num
 * `translate` ela é relativa à caixa do PRÓPRIO elemento, e a folha e a casa
 * têm tamanhos diferentes.
 */
export interface Layout {
  /** A casa se afasta para dar lugar à proposta. */
  casa: readonly [number, number];
  /** De onde a folha da proposta entra, relativo a onde ela repousa. */
  folha: readonly [number, number];
}

export const LAYOUTS: Record<LayoutId, Layout> = {
  largo: { casa: [-26, 0], folha: [48, 0] },
  retrato: { casa: [0, -20], folha: [0, 80] },
};
