import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Exclusão de Dados | ProOps",
  description:
    "Saiba como solicitar a exclusão dos seus dados pessoais na ProOps e o que acontece após a solicitação.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Exclusão de Dados"
      description="Esta página explica como solicitar a exclusão dos seus dados pessoais armazenados pelo ProOps e descreve o processo adotado para atender essas solicitações."
      updatedAt="5 de maio de 2026"
      sections={[
        {
          title: "1. Seu direito à exclusão",
          content: (
            <>
              <p>
                Nos termos da Lei Geral de Proteção de Dados (LGPD) e de outras
                legislações aplicáveis, você tem o direito de solicitar a
                exclusão dos seus dados pessoais tratados pelo ProOps, quando
                não houver base legal que justifique sua manutenção.
              </p>
              <p>
                Este direito se aplica a dados de usuários da plataforma,
                incluindo aqueles que interagiram com o ProOps por meio de
                integrações como WhatsApp, Google Agenda ou outras ferramentas
                conectadas.
              </p>
            </>
          ),
        },
        {
          title: "2. Como solicitar a exclusão",
          content: (
            <>
              <p>
                Para solicitar a exclusão dos seus dados, envie um e-mail para{" "}
                <a
                  href="mailto:gestao@proops.com.br"
                  className="text-primary hover:underline"
                >
                  gestao@proops.com.br
                </a>{" "}
                com o assunto <strong>Solicitação de Exclusão de Dados</strong>.
              </p>
              <p>
                A mensagem deve conter: seu nome completo, o e-mail ou número de
                telefone associado à sua conta ou interação com a plataforma, e
                uma breve descrição dos dados que deseja excluir, quando
                aplicável.
              </p>
              <p>
                Podemos solicitar informações adicionais para confirmar sua
                identidade antes de processar a solicitação, a fim de proteger
                seus dados contra exclusões indevidas.
              </p>
            </>
          ),
        },
        {
          title: "3. O que será excluído",
          content: (
            <>
              <p>
                Após confirmada a solicitação, procederemos com a exclusão ou
                anonimização dos seus dados pessoais, incluindo:
              </p>
              <p>
                dados cadastrais de acesso, como nome, e-mail e informações de
                autenticação vinculadas à sua conta;
              </p>
              <p>
                registros de interação com o bot de WhatsApp, incluindo sessões,
                logs de ações e histórico de uso associados ao seu número de
                telefone;
              </p>
              <p>
                demais informações pessoais identificáveis armazenadas em nossa
                plataforma a seu respeito.
              </p>
            </>
          ),
        },
        {
          title: "4. Exceções à exclusão",
          content: (
            <>
              <p>
                Alguns dados podem ser mantidos mesmo após a solicitação de
                exclusão, nos casos em que a retenção for exigida por obrigação
                legal, regulatória ou para defesa em processos judiciais ou
                administrativos.
              </p>
              <p>
                Dados operacionais inseridos por uma empresa contratante do
                ProOps (como propostas, transações e registros de clientes)
                pertencem à empresa e estão sujeitos às políticas internas dela.
                Para exclusão desses dados, o contato deve ser feito diretamente
                com a empresa responsável pela sua conta.
              </p>
            </>
          ),
        },
        {
          title: "5. Prazo de atendimento",
          content: (
            <>
              <p>
                As solicitações de exclusão serão atendidas em até 15 dias
                corridos a partir da confirmação da identidade do solicitante.
              </p>
              <p>
                Você receberá uma confirmação por e-mail assim que a exclusão
                for concluída ou quando houver alguma exceção que impeça o
                atendimento integral da solicitação.
              </p>
            </>
          ),
        },
        {
          title: "6. Contato",
          content: (
            <>
              <p>
                Para dúvidas sobre exclusão de dados ou sobre o tratamento de
                suas informações pessoais, entre em contato pelo e-mail{" "}
                <a
                  href="mailto:gestao@proops.com.br"
                  className="text-primary hover:underline"
                >
                  gestao@proops.com.br
                </a>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
