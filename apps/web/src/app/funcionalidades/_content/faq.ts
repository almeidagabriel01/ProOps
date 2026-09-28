import { FAQS, type FAQ } from "@/components/landing/_shared/faq-data";

/**
 * As dúvidas de quem está olhando recurso por recurso. Nenhuma resposta cita
 * plano pelo nome: o plano de cada recurso já está na lista, derivado do
 * catálogo, e uma resposta escrita à mão aqui envelheceria na primeira mudança.
 */
const SEGMENTO = FAQS.find((f) => f.question.startsWith("A ProOps serve"));

export const FAQ_FUNCIONALIDADES: readonly FAQ[] = [
  {
    question: "Como sei o que vem no meu plano?",
    answer:
      "Cada recurso da lista mostra o plano que o libera e onde ele entra como add-on. Use o filtro por plano, acima da lista, para ver só o que o seu plano traz.",
  },
  {
    question: "O meu cliente paga com cartão pelo link?",
    answer:
      "Não. Pelo link, o seu cliente paga com Pix ou boleto, pelo Asaas, com o pagamento online ativo. O cartão de crédito é só a forma de pagar a assinatura da ProOps.",
  },
  {
    question: "O cliente precisa criar conta para abrir os links?",
    answer:
      "Não. Proposta, parcela, obra, agendamento, portal e o acesso do contador abrem direto pelo link, sem senha. Você pode revogar o link do portal e trocar o do contador quando quiser.",
  },
  {
    question: "Posso ver um exemplo antes de assinar?",
    answer:
      "Pode. O portal do cliente e o acesso do contador têm páginas de exemplo abertas nesta lista, e a conta gratuita navega o ERP inteiro com dados de demonstração do seu segmento, só para leitura.",
  },
  ...(SEGMENTO ? [SEGMENTO] : []),
  {
    question: "Dá para começar com menos e crescer depois?",
    answer:
      "Dá. Os add-ons somam por cima do plano quando você precisar deles, e a mudança de plano leva tudo o que já está cadastrado junto.",
  },
];
