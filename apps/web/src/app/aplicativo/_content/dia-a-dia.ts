import type { DadosFinanceiro } from "../_components/telas/tela-financeiro";
import type { DadosHoje } from "../_components/telas/tela-hoje";

/**
 * Os seis momentos de um dia com o aplicativo.
 *
 * Todos são coisas que o produto de fato faz, tiradas do repositório dele:
 * alertas opt-in por canal, áudio transcrito virando lembrete recorrente, um
 * gasto escrito em português corrente, a simulação de uma compra ANTES de ela
 * acontecer, o portão de confirmação para o que é difícil de desfazer, e uma
 * tela inicial ancorada no que sobra em vez de no saldo. Nada aqui é aspiração.
 *
 * ── O que mudou, e por que ──────────────────────────────────────────────────
 *
 * Cada momento agora carrega a TELA do aplicativo que aquela mensagem produziu.
 * A pesquisa dos cinco concorrentes diretos encontrou uma coisa que nenhum deles
 * faz: mostrar a conversa e o aplicativo no MESMO quadro, ao mesmo tempo. Todos
 * põem o chat numa seção e as telas em outra, e com isso nenhum chega a
 * demonstrar a promessa que todos fazem. É a única coisa que prova, em vez de
 * afirmar, que o que você jogou no WhatsApp aparece organizado do outro lado.
 *
 * Entrou também um momento de OPERAÇÃO, e não de captura: a simulação de compra
 * às 15h40. Anotar o gasto é o que a categoria inteira faz; responder "dá para
 * comprar?" com a projeção do mês é o que ela não faz.
 *
 * `tela` descreve só o que MUDA em relação ao padrão daquela aba. O resto vem de
 * `HOJE_PADRAO` e `FINANCEIRO_PADRAO`, então os números da página inteira
 * continuam contando uma história só: a mesma sobra, as mesmas duas contas, o
 * mesmo cartão.
 */

export interface Bolha {
  de: "voce" | "ia";
  texto: string;
  hora: string;
  /** Renders as a voice note instead of text. */
  audio?: boolean;
  /** Renders the parsed result as a card under the bubble. */
  cartao?: { titulo: string; meta: string; valor: string };
  /** Renders as a system alert card rather than a chat bubble. */
  alerta?: boolean;
}

/** Qual aba do aplicativo o momento mostra, e o que nela mudou. */
export type TelaDoMomento =
  | { aba: "hoje"; dados?: Partial<DadosHoje> }
  | { aba: "financeiro"; dados?: Partial<DadosFinanceiro> };

export interface Momento {
  /** Shown on the rail. Short, because the rail is narrow. */
  horaCurta: string;
  /** Shown above the headline. */
  hora: string;
  titulo: string;
  /** The half of the headline that carries the accent. */
  destaque: string;
  texto: string;
  bolhas: Bolha[];
  /** O aplicativo, no instante seguinte à mensagem. */
  tela: TelaDoMomento;
  /**
   * The light of that hour, as a CSS gradient behind the conversation.
   *
   * There are no photographs for this section and there will not be, so the
   * passing of the day is carried by colour instead: cold and low at dawn,
   * open at midday, warm at dusk, deep at night. It is the one thing a stock
   * photo would have done that a chat panel cannot do on its own.
   */
  luz: string;
}

export const MOMENTOS: Momento[] = [
  {
    horaCurta: "07:40",
    luz: "radial-gradient(120% 90% at 15% 100%, rgba(255,176,102,0.20) 0%, rgba(255,140,80,0.07) 34%, transparent 70%)",
    hora: "07h40",
    titulo: "O que vence hoje chega",
    destaque: "antes do café.",
    texto:
      "Os alertas são por canal e vêm desligados. Você decide se quer no push, no WhatsApp, nos dois ou em nenhum, e muda de ideia quando quiser.",
    bolhas: [
      {
        de: "ia",
        alerta: true,
        texto:
          "Bom dia. Hoje vencem 2 contas: fatura do cartão, R$ 1.350,00, e aluguel, R$ 1.900,00.",
        hora: "07:40",
      },
    ],
    tela: { aba: "hoje" },
  },
  {
    horaCurta: "09:15",
    luz: "radial-gradient(120% 90% at 80% 0%, rgba(140,196,255,0.18) 0%, rgba(110,170,255,0.06) 38%, transparent 72%)",
    hora: "09h15",
    titulo: "Um áudio no trânsito",
    destaque: "vira lembrete.",
    texto:
      "O áudio é transcrito e entendido como recorrência, não como uma nota solta. Sem abrir o aplicativo, sem preencher formulário.",
    bolhas: [
      {
        de: "voce",
        audio: true,
        texto: "me lembra de pagar o aluguel todo dia 5",
        hora: "09:15",
      },
      {
        de: "ia",
        texto: "Combinado. Lembrete criado, todo dia 5, às 9h.",
        hora: "09:15",
      },
    ],
    tela: {
      aba: "hoje",
      dados: {
        hora: "09:16",
        atalhos: [
          { rotulo: "Vencendo", contagem: 2 },
          { rotulo: "Lembretes", contagem: 4 },
          { rotulo: "Orçamento", contagem: 1 },
        ],
      },
    },
  },
  {
    horaCurta: "12:30",
    luz: "radial-gradient(130% 100% at 50% -10%, rgba(232,240,246,0.16) 0%, rgba(200,220,235,0.05) 40%, transparent 74%)",
    hora: "12h30",
    titulo: "O almoço entra",
    destaque: "sozinho.",
    texto:
      "Você escreve como falaria. O lançamento aparece categorizado e no cartão certo, guardando a mensagem que deu origem a ele.",
    bolhas: [
      { de: "voce", texto: "gastei 45 no mercado", hora: "12:30" },
      {
        de: "ia",
        texto: "Registrei.",
        hora: "12:30",
        cartao: {
          titulo: "Mercado",
          meta: "Alimentação · Cartão",
          valor: "R$ 45,00",
        },
      },
    ],
    tela: { aba: "financeiro" },
  },
  {
    horaCurta: "15:40",
    luz: "radial-gradient(125% 95% at 88% 12%, rgba(138,226,178,0.18) 0%, rgba(96,190,148,0.06) 40%, transparent 74%)",
    hora: "15h40",
    titulo: "A compra é simulada",
    destaque: "antes de existir.",
    texto:
      "Aqui é onde a categoria para. Ele não responde quanto você já gastou: responde quanto sobraria se você gastasse, contando o que ainda entra e o que ainda sai do mês.",
    bolhas: [
      {
        de: "voce",
        texto: "posso comprar um celular de 3 mil?",
        hora: "15:40",
      },
      {
        de: "ia",
        texto:
          "Dá, mas aperta. Sobrariam R$ 284,90 até o dia 30, contra R$ 1.284,90 sem a compra. Parcelado em 10x, sobram R$ 1.044,90 e a fatura de outubro vai a R$ 1.890,00.",
        hora: "15:40",
      },
    ],
    tela: {
      aba: "hoje",
      dados: {
        hora: "15:41",
        saudacao: "Boa tarde, Gabriel",
        linhaSecundaria: "15 dias até virar o mês · Projeção positiva",
      },
    },
  },
  {
    horaCurta: "18:20",
    luz: "radial-gradient(120% 95% at 12% 15%, rgba(255,138,116,0.20) 0%, rgba(168,104,196,0.10) 42%, transparent 76%)",
    hora: "18h20",
    titulo: "Gasto grande pede",
    destaque: "um sim.",
    texto:
      "O parcelamento vira dez lançamentos futuros, no cartão certo, com a primeira na fatura que ainda está aberta. E nada disso acontece sozinho: o que é difícil de desfazer espera a sua confirmação.",
    bolhas: [
      {
        de: "voce",
        texto: "parcela a geladeira em 10x, 2.400 no total",
        hora: "18:20",
      },
      {
        de: "ia",
        texto:
          "R$ 2.400,00 em Casa, 10x de R$ 240,00 no Cartão da casa, a primeira nesta fatura. Confirma que lanço? Responda sim ou não.",
        hora: "18:20",
      },
      { de: "voce", texto: "sim", hora: "18:21" },
    ],
    tela: {
      aba: "financeiro",
      dados: {
        hora: "18:21",
        sobra: "R$ 1.044,90",
        linhaSecundaria:
          "entrou R$ 6.400,00 · saiu R$ 3.455,10 · ainda sai R$ 1.900,00",
        cartao: {
          nome: "Cartão da casa",
          fatura: "R$ 1.590,00",
          fechaEm: "20/09",
          venceEm: "27/09",
          disponivel: "R$ 4.337,00",
          usoDoLimite: 0.27,
        },
        lancamentos: [
          {
            titulo: "Geladeira",
            meta: "Casa · 1/10 · Cartão da casa",
            valor: "R$ 240,00",
            novo: true,
          },
          {
            titulo: "Mercado",
            meta: "Alimentação · Cartão da casa",
            valor: "R$ 45,00",
          },
          {
            titulo: "Marcenaria",
            meta: "Casa · lançado no app",
            valor: "R$ 320,00",
          },
        ],
      },
    },
  },
  {
    horaCurta: "22:00",
    luz: "radial-gradient(120% 100% at 70% 105%, rgba(84,104,196,0.20) 0%, rgba(52,62,132,0.08) 40%, transparent 75%)",
    hora: "22h00",
    titulo: "Antes de dormir,",
    destaque: "quanto sobra.",
    texto:
      "A tela inicial não pergunta quanto você tem. Ela responde se dá para gastar até virar o mês, contando o que ainda entra e o que ainda sai.",
    bolhas: [
      { de: "voce", texto: "quanto sobra esse mês?", hora: "22:00" },
      {
        de: "ia",
        texto:
          "R$ 1.044,90 até o dia 30, já contando as fixas e a parcela da geladeira. Projeção positiva.",
        hora: "22:00",
      },
    ],
    tela: {
      aba: "hoje",
      dados: {
        hora: "22:01",
        saudacao: "Boa noite, Gabriel",
        sobra: "R$ 1.044,90",
        linhaSecundaria: "8 dias até virar o mês · Projeção positiva",
      },
    },
  },
];
