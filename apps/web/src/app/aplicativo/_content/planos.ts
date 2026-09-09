/**
 * Os planos do aplicativo, como o próprio app os define em `src/lib/billing.ts`.
 *
 * Fora do componente porque a seção de preços NÃO é o único consumidor: o
 * JSON-LD da página publica os mesmos valores como `offers`, e preço divergindo
 * entre a tela e o rich snippet do Google é o tipo de erro que o cliente
 * descobre antes da gente.
 *
 * O plano gratuito permanente NÃO é anunciado. Ele existe no app hoje, e a
 * decisão de substituí-lo pelo teste de sete dias já está registrada nas notas
 * de handoff do próprio aplicativo. Colocá-lo numa página que vai ao ar perto
 * do lançamento seria prometer algo já marcado para sair, que é a única
 * promessa que uma seção de preços não pode fazer.
 */
export interface Plano {
  nome: string;
  mensal: string;
  anual: string;
  para: string;
  inclui: string[];
  destaque?: boolean;
}

/**
 * Prices as the app itself defines them, in `src/lib/billing.ts`.
 *
 * The permanent free tier is NOT advertised. It exists in the app today, and
 * the product decision to replace it with the seven-day trial is already
 * recorded in the app's own handoff notes. Putting it on a page that goes live
 * around launch would be promising something scheduled for removal, which is
 * the one promise a pricing section must never make.
 */
export const PLANOS: Plano[] = [
  {
    nome: "Pro",
    mensal: "R$ 24,90",
    anual: "R$ 249,00 por ano",
    para: "Para você, e mais duas pessoas",
    inclui: [
      "3 pessoas no mesmo financeiro",
      "1.000 mensagens de IA por mês",
      "Importação de extrato OFX e CSV",
    ],
    destaque: true,
  },
  {
    nome: "Família",
    mensal: "R$ 39,90",
    anual: "R$ 399,00 por ano",
    para: "Para a casa inteira",
    inclui: [
      "5 pessoas no mesmo financeiro",
      "2.000 mensagens de IA por mês",
      "Autoria por lançamento",
    ],
  },
];
