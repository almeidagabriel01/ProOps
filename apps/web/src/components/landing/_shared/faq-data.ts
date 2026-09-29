import { DEFAULT_PLANS } from "@/lib/plans/default-plans";

export type FAQ = { question: string; answer: string };

/**
 * "o Starter tem 1 usuário, o Profissional tem 2 e o Enterprise não tem limite",
 * lido dos planos: um número de plano digitado aqui sairia do lugar em silêncio
 * na próxima mudança de catálogo.
 */
function usuariosPorPlano(): string {
  const partes = [...DEFAULT_PLANS]
    .sort((a, b) => a.order - b.order)
    .map(({ name, features: { maxUsers } }) => {
      if (maxUsers === -1) return `o ${name} não tem limite`;
      return `o ${name} tem ${maxUsers} ${maxUsers === 1 ? "usuário" : "usuários"}`;
    });
  return partes.length > 1
    ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`
    : partes.join("");
}

/**
 * Fonte única das perguntas da FAQ — consumida pelo componente client
 * `landing-faq.tsx` (UI) e pelo Server Component `page.tsx`, que renderiza o
 * `FAQPageJsonLd` para que as perguntas sejam indexáveis sem depender de JS.
 */
export const FAQS: FAQ[] = [
  {
    question: "A ProOps serve para o meu segmento?",
    answer:
      "Se a sua empresa vende projeto, serve. Já vêm configurados, com catálogo e cálculos prontos: automação residencial; persianas e toldos; segurança eletrônica; vidraçaria e esquadrias; marcenaria e móveis planejados; climatização e ar-condicionado. Qualquer outro segmento é configurado na mesma base: catálogo, campos da proposta, etapas do funil e unidade de medida. O que muda é a configuração, não o sistema.",
  },
  {
    question: "Preciso de cartão de crédito para começar?",
    answer:
      "A assinatura da ProOps é cobrada apenas no cartão de crédito (em até 12x). Você escolhe o plano e conclui a assinatura direto no checkout seguro.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "A assinatura é paga por cartão de crédito (em até 12x). Já para receber dos seus clientes dentro da plataforma, o pagamento online pelo Asaas aceita Pix e boleto, direto no link da parcela. Ele vem no plano Enterprise e pode ser contratado como add-on nos demais.",
  },
  {
    question: "O sistema é compatível com a minha contabilidade?",
    answer:
      "Sim. Com o financeiro no plano, você gera o link do contador: ele abre o DRE, os lançamentos e as notas em PDF e XML, escolhe o período e exporta para Excel ou CSV. Não precisa de login e não ocupa um usuário.",
  },
  {
    question: "Qual o limite de usuários?",
    answer:
      `Depende do plano: ${usuariosPorPlano()}. Para aumentar a equipe, basta mudar de plano.`,
  },
  {
    question: "Meus dados estão seguros? E quanto à LGPD?",
    answer:
      "Usamos criptografia em trânsito e em repouso, isolamento por empresa (multi-tenant) e tratamos dados pessoais conforme a LGPD, com exclusão sob demanda.",
  },
  {
    question: "Consigo migrar meus dados e cancelar quando quiser?",
    answer:
      "Sem lock-in. Você exporta seus dados quando precisar e pode cancelar a qualquer momento, sem fidelidade ou multa.",
  },
];
