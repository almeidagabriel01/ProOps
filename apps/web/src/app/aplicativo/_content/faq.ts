import { APP_NAME } from "@/lib/site/app-brand";

/**
 * As perguntas, em UM lugar só.
 *
 * A seção da página e o `FAQPage` do JSON-LD leem daqui, pelo mesmo motivo que
 * os planos: resposta divergindo entre a tela e o rich snippet do Google é o
 * tipo de erro que o cliente encontra antes da gente.
 *
 * A ordem não é arbitrária. As três primeiras são as que dominam o FAQ dos cinco
 * concorrentes diretos, medidas neles: "preciso baixar aplicativo?", "é seguro?"
 * e "posso cancelar?". Elas vêm antes porque são as que o visitante já chegou
 * pensando; as nossas vêm depois.
 *
 * **Nada aqui pode prometer data.** O aplicativo não está em nenhuma das duas
 * lojas e não há conta de desenvolvedor aberta, então a resposta sobre
 * lançamento diz o que é verdade e para de falar.
 */
export interface Pergunta {
  pergunta: string;
  resposta: string;
}

export const PERGUNTAS: Pergunta[] = [
  {
    pergunta: "Preciso baixar o aplicativo?",
    resposta: `Não para começar. Pelo WhatsApp você já lança, consulta e cria lembretes, e isso funciona sozinho. O aplicativo é onde tudo aparece organizado, e é nele que está o financeiro completo: cartões, faturas, orçamentos, metas e a projeção do mês.`,
  },
  {
    pergunta: "É seguro?",
    resposta: `O WhatsApp entra pela API oficial da Meta, nunca por um cliente não-oficial. Toda mensagem tem a assinatura conferida antes de ser lida. O banco de dados nega tudo por padrão e cada linha é liberada só para o dono dela. E o que é difícil de desfazer, como pagar uma fatura ou apagar um lançamento, sempre espera a sua confirmação.`,
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta: `Pode. A assinatura é cobrada pela App Store ou pelo Google Play, e o cancelamento acontece na própria loja, a qualquer momento. Cancelando, você continua com acesso até o fim do período já pago.`,
  },
  {
    pergunta: "Conecta com o meu banco?",
    resposta: `Não, e isso é uma escolha. A ${APP_NAME} não pede a senha do seu banco porque não entra nele: o que ela sabe é o que você contou. Quando quiser trazer o mês inteiro de uma vez, importe o extrato em OFX ou CSV, que é um arquivo seu e entregue por você.`,
  },
  {
    pergunta: "Funciona sem WhatsApp?",
    resposta: `Funciona. O mesmo agente mora dentro do aplicativo, e a conta entra por e-mail e senha. O número de WhatsApp só é pedido se você quiser usar esse canal também.`,
  },
  {
    pergunta: "Dá para usar por áudio?",
    resposta: `Dá. O áudio é transcrito e entendido como qualquer mensagem escrita, inclusive quando ele descreve uma recorrência, do tipo "me lembra de pagar o aluguel todo dia 5".`,
  },
  {
    pergunta: "Quantas mensagens eu posso mandar por mês?",
    resposta: `Mil por mês no plano Pro e duas mil no Família. As conversas do WhatsApp e do aplicativo são separadas, mas a cota é a mesma para as duas.`,
  },
  {
    pergunta: "Quem mais consegue ver o meu financeiro?",
    resposta: `Só quem você convidar. O plano Pro divide o mesmo financeiro com até três pessoas e o Família com até cinco. No Família, cada lançamento mostra quem foi que registrou.`,
  },
  {
    pergunta: "Quando chega nas lojas?",
    resposta: `Ainda não chegou, e por isso esta página não vende nada: ela existe para você saber o que vem. Quem assinar no lançamento tem sete dias de teste antes da primeira cobrança.`,
  },
];
