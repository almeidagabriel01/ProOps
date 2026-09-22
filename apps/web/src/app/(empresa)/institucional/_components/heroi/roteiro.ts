import {
  COMODOS,
  ITENS,
  LARGURA_DA_CASA,
  LAYOUTS,
  PAGAMENTO,
  PE_DIREITO,
  PROFUNDIDADE_DA_CASA,
  centroDoComodo,
  type ComodoId,
  type LayoutId,
} from "../../_content/cena-planta";
import {
  alvoDoQuadro,
  arredonda,
  caixaDaCasa,
  transformaCamera,
  type Camera,
  type Ponto2,
} from "./projecao";

/**
 * O roteiro da cena de abertura: o que está na tela em cada ponto da rolagem.
 *
 * Função PURA de `p` (o progresso da seção, de 0 a 1) e do realce do ponteiro.
 * Nada aqui conhece DOM, React, three ou o tamanho da tela: quem lê é quem
 * traduz. É isso que deixa três consumidores concordarem sem conversar:
 *
 * - `estilo-da-cena.tsx`, no SERVIDOR, escreve `estadoDaCena(1)` como CSS base e
 *   `estadoDaCena(0)` dentro de `prefers-reduced-motion: no-preference`. Quem
 *   pede menos movimento recebe o quadro final composto sem JavaScript nenhum,
 *   e todo o resto recebe o começo da história no primeiro paint;
 * - `diretor.tsx`, no cliente, chama a mesma função a cada quadro de rolagem e
 *   escreve as mesmas variáveis por cima;
 * - `planta-3d.tsx` lê as luzes, as cortinas e a câmera.
 *
 * Todos os campos numéricos ficam entre 0 e 1, crescem com `p` e valem 1 no fim.
 * A exceção é a câmera, que não é uma revelação e sim um enquadramento. Os
 * testes em `__tests__/roteiro.test.ts` guardam essas três propriedades.
 */

export type Ato = "repouso" | "projeto" | "proposta" | "aprovada" | "dinheiro";

/**
 * Os cinco atos, contíguos. O primeiro é curto de propósito: é a primeira dobra
 * parada, e quem chega já está nela. A história começa no primeiro gesto de
 * rolagem, e não depois de meia tela de nada acontecendo.
 */
export const ATOS: readonly { id: Ato; de: number; ate: number }[] = [
  { id: "repouso", de: 0, ate: 0.08 },
  { id: "projeto", de: 0.08, ate: 0.42 },
  { id: "proposta", de: 0.42, ate: 0.64 },
  { id: "aprovada", de: 0.64, ate: 0.82 },
  { id: "dinheiro", de: 0.82, ate: 1 },
];

/** A folga do quadro em volta da casa, em metros isométricos. */
const FOLGA = 0.7;

/** O `viewBox` do SVG e o quadro do three. */
export const CAIXA = caixaDaCasa(
  LARGURA_DA_CASA,
  PROFUNDIDADE_DA_CASA,
  PE_DIREITO,
  FOLGA,
);

export const CAMERA_DE_REPOUSO: Camera = { zoom: 1, alvo: alvoDoQuadro(CAIXA) };

/** O realce do ponteiro por cômodo, de 0 a 1, já suavizado por quem chama. */
export type Realce = Partial<Record<ComodoId, number>>;

export interface EstadoDaCena {
  ato: Ato;
  /** O quanto o texto do herói já saiu da frente. */
  saidaDoTexto: number;
  /** Cada legenda, por ato. Só uma fica inteira de cada vez. */
  legendas: Record<Exclude<Ato, "repouso">, number>;
  luzes: Record<ComodoId, number>;
  cortinas: Record<ComodoId, number>;
  camera: Camera;
  /** O quanto a casa já abriu espaço para a proposta. */
  recuoDaCasa: number;
  /** Por item, na ordem de `ITENS`. */
  chips: { surge: number; voo: number; linha: number }[];
  proposta: { entrada: number; codigo: number; totalCentavos: number };
  pagamento: { assinatura: number; selo: number; divisao: number; partes: number[] };
  mensagem: number;
}

const limita = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Quanto de um trecho `[a, b]` do progresso já passou, de 0 a 1. */
export function trecho(p: number, a: number, b: number): number {
  return limita((p - a) / (b - a));
}

/** Hermite. Início e fim sem tranco, e ainda monótona. */
const suave = (t: number) => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp2 = (a: Ponto2, b: Ponto2, t: number): Ponto2 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
];

export function atoEm(p: number): Ato {
  const q = limita(p);
  for (const ato of ATOS) if (q < ato.ate) return ato.id;
  return "dinheiro";
}

/** Quando cada item é especificado, dentro do ato do projeto. */
const INICIO_DO_PROJETO = 0.1;
const PASSO_DO_PROJETO = 0.048;
const DURACAO_DO_ITEM = 0.07;
const inicioDoItem = (i: number) => INICIO_DO_PROJETO + i * PASSO_DO_PROJETO;

/** Quando cada item voa para a proposta. */
const INICIO_DO_VOO = 0.45;
const PASSO_DO_VOO = 0.022;
const DURACAO_DO_VOO = 0.06;
const fimDoVoo = (i: number) => INICIO_DO_VOO + i * PASSO_DO_VOO + DURACAO_DO_VOO;

/** O primeiro item de cada cômodo é o que acende a luz dele. */
const PRIMEIRO_ITEM: Record<ComodoId, number> = Object.fromEntries(
  COMODOS.map((c) => [c.id, ITENS.findIndex((i) => i.comodo === c.id)]),
) as Record<ComodoId, number>;

/**
 * A câmera durante o projeto: visita o cômodo do item que está sendo
 * especificado, deslizando de um para o outro. Fora dali, enquadra a casa.
 */
function camera(p: number): Camera {
  const aproxima = suave(trecho(p, 0.08, 0.16)) * (1 - suave(trecho(p, 0.37, 0.46)));
  const posicao = limita((p - INICIO_DO_PROJETO) / (PASSO_DO_PROJETO * ITENS.length));
  const escala = posicao * (ITENS.length - 1);
  const de = Math.floor(escala);
  const ate = Math.min(ITENS.length - 1, de + 1);
  const visita = lerp2(
    centroDoComodo(ITENS[de].comodo),
    centroDoComodo(ITENS[ate].comodo),
    suave(escala - de),
  );
  // A visita não centra o cômodo: puxa o quadro METADE do caminho até ele. Com
  // a casa inteira como contexto, o olho sabe onde está; centrando, cada cômodo
  // viraria uma tela solta.
  const alvo = lerp2(CAMERA_DE_REPOUSO.alvo, lerp2(CAMERA_DE_REPOUSO.alvo, visita, 0.5), aproxima);
  const recua = suave(trecho(p, 0.4, 0.5));
  return { zoom: 1 + 0.16 * aproxima - 0.06 * recua, alvo };
}

export function estadoDaCena(p: number, realce: Realce = {}): EstadoDaCena {
  const q = limita(p);

  const chips = ITENS.map((_, i) => {
    const fim = fimDoVoo(i);
    return {
      surge: suave(trecho(q, inicioDoItem(i), inicioDoItem(i) + 0.05)),
      voo: suave(trecho(q, fim - DURACAO_DO_VOO, fim)),
      linha: trecho(q, fim - 0.01, fim + 0.03),
    };
  });

  const luzes = {} as Record<ComodoId, number>;
  const cortinas = {} as Record<ComodoId, number>;
  for (const comodo of COMODOS) {
    const primeiro = PRIMEIRO_ITEM[comodo.id];
    const acesa = trecho(q, inicioDoItem(primeiro), inicioDoItem(primeiro) + 0.05);
    // O ponteiro só ACENDE. Apagar uma luz que a história já acendeu faria a
    // cena desmentir a si mesma debaixo do cursor.
    luzes[comodo.id] = Math.max(acesa, limita(realce[comodo.id] ?? 0));
    const cortina = ITENS.findIndex((i) => i.comodo === comodo.id && i.cortina);
    cortinas[comodo.id] =
      cortina < 0
        ? 0
        : suave(trecho(q, inicioDoItem(cortina) + 0.015, inicioDoItem(cortina) + DURACAO_DO_ITEM));
  }

  const totalCentavos = Math.round(
    ITENS.reduce((soma, item, i) => soma + item.centavos * chips[i].linha, 0),
  );

  const entra = (a: number, b: number) => trecho(q, a, b);
  const sai = (a: number, b: number) => 1 - trecho(q, a, b);

  return {
    ato: atoEm(q),
    saidaDoTexto: suave(trecho(q, 0.03, 0.12)),
    legendas: {
      projeto: Math.min(entra(0.1, 0.15), sai(0.39, 0.43)),
      proposta: Math.min(entra(0.45, 0.49), sai(0.62, 0.66)),
      aprovada: Math.min(entra(0.67, 0.71), sai(0.8, 0.84)),
      dinheiro: entra(0.85, 0.89),
    },
    luzes,
    cortinas,
    camera: camera(q),
    recuoDaCasa: suave(trecho(q, 0.4, 0.49)),
    chips,
    proposta: {
      entrada: suave(trecho(q, 0.41, 0.48)),
      codigo: trecho(q, 0.47, 0.52),
      totalCentavos,
    },
    pagamento: {
      assinatura: trecho(q, 0.66, 0.74),
      selo: suave(trecho(q, 0.73, 0.76)),
      divisao: suave(trecho(q, 0.74, 0.79)),
      partes: [PAGAMENTO.entrada, ...PAGAMENTO.parcelas].map((_, i) =>
        suave(trecho(q, 0.755 + i * 0.014, 0.79 + i * 0.014)),
      ),
    },
    mensagem: suave(trecho(q, 0.84, 0.91)),
  };
}

export const ESTADO_FINAL: EstadoDaCena = estadoDaCena(1);

const n = (valor: number) => String(arredonda(valor));

/**
 * O estado como variáveis CSS, para uma composição.
 *
 * O ÚNICO serializador: o servidor e o diretor passam por aqui, e é isso que
 * impede que o primeiro paint e o primeiro quadro de rolagem discordem.
 *
 * Os deslocamentos saem em `cqw`/`cqh` do palco. O chip que voa é a exceção e
 * não aparece aqui: a posição de partida dele depende de onde a linha da
 * proposta está na tela, que só a medição conhece, e o diretor escreve isso à
 * parte. No servidor ele não precisa de nada, porque nos dois estados que o
 * servidor escreve o chip ou está invisível (começo) ou pousado (fim).
 */
export function paraVariaveis(
  estado: EstadoDaCena,
  layout: LayoutId,
): Record<string, string> {
  const l = LAYOUTS[layout];
  const { tx, ty, escala } = transformaCamera(estado.camera, CAIXA);
  const v: Record<string, string> = {
    "--texto-saida": n(estado.saidaDoTexto),
    "--cam-tx": n(tx),
    "--cam-ty": n(ty),
    "--cam-z": n(escala),
    "--casa-x": `${n(l.casa[0] * estado.recuoDaCasa)}cqw`,
    "--casa-y": `${n(l.casa[1] * estado.recuoDaCasa)}cqh`,
    "--folha": n(estado.proposta.entrada),
    "--folha-x": `${n(l.folha[0] * (1 - estado.proposta.entrada))}cqw`,
    "--folha-y": `${n(l.folha[1] * (1 - estado.proposta.entrada))}cqh`,
    "--codigo": n(estado.proposta.codigo),
    "--assinatura": n(estado.pagamento.assinatura),
    "--selo": n(estado.pagamento.selo),
    "--divisao": n(estado.pagamento.divisao),
    "--mensagem": n(estado.mensagem),
    "--mensagem-x": `${n(l.mensagem[0] * (1 - estado.mensagem))}cqw`,
    "--mensagem-y": `${n(l.mensagem[1] * (1 - estado.mensagem))}cqh`,
  };
  for (const [ato, valor] of Object.entries(estado.legendas)) v[`--legenda-${ato}`] = n(valor);
  for (const comodo of COMODOS) {
    v[`--luz-${comodo.id}`] = n(estado.luzes[comodo.id]);
    v[`--cortina-${comodo.id}`] = n(estado.cortinas[comodo.id]);
  }
  estado.chips.forEach((chip, i) => {
    v[`--chip-${i}-surge`] = n(chip.surge);
    v[`--chip-${i}-voo`] = n(chip.voo);
    v[`--linha-${i}`] = n(chip.linha);
  });
  estado.pagamento.partes.forEach((parte, i) => {
    v[`--parte-${i}`] = n(parte);
  });
  return v;
}

/** `{ "--a": "1" }` como corpo de uma regra CSS. */
export function declaracoes(variaveis: Record<string, string>): string {
  return Object.entries(variaveis)
    .map(([nome, valor]) => `${nome}:${valor}`)
    .join(";");
}
