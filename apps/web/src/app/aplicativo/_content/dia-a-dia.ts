/**
 * The five moments of a day with the app.
 *
 * Every one of them is something the product actually does, taken from its own
 * repository: alerts that are opt-in per channel, audio transcribed into a
 * recurring reminder, an expense written in plain Portuguese, a confirmation
 * gate before anything hard to undo, and a home screen anchored on what is
 * left rather than on the balance. Nothing here is aspirational.
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
  /**
   * The light of that hour, as a CSS gradient behind the conversation.
   *
   * There are no photographs for this section and there will not be, so the
   * passing of the day is carried by colour instead: cold and low at dawn,
   * open at midday, warm at dusk, deep at night. It is the one thing a stock
   * photo would have done that a chat panel cannot do on its own.
   */
  luz: string;
  /**
   * Optional photograph, under public/. When present it replaces the
   * conversation mock, and the frame is already the right shape so dropping
   * one in moves nothing else on the page.
   */
  imagem?: string;
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
  },
  {
    horaCurta: "18:20",
    luz: "radial-gradient(120% 95% at 12% 15%, rgba(255,138,116,0.20) 0%, rgba(168,104,196,0.10) 42%, transparent 76%)",
    hora: "18h20",
    titulo: "Gasto grande pede",
    destaque: "um sim.",
    texto:
      "O que é difícil de desfazer nunca é executado sozinho. Vira uma pendência que espera sua confirmação, e some se você não responder.",
    bolhas: [
      { de: "voce", texto: "paguei 2.400 na geladeira nova", hora: "18:20" },
      {
        de: "ia",
        texto:
          "R$ 2.400,00 em Casa, no cartão. Confirma que lanço? Responda sim ou não.",
        hora: "18:20",
      },
    ],
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
          "R$ 1.284,90 até o dia 30, já contando as fixas. Projeção positiva.",
        hora: "22:00",
      },
    ],
  },
];
