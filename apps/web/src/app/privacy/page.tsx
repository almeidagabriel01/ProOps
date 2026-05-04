import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade | ProOps",
  description:
    "Política de Privacidade do ProOps, incluindo o tratamento de dados pessoais e o uso da integração com Google Agenda.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      description="Esta Política de Privacidade explica como o ProOps coleta, utiliza, armazena e protege dados pessoais de usuários, clientes e contatos cadastrados na plataforma."
      updatedAt="19 de março de 2026"
      sections={[
        {
          title: "1. Quem somos",
          content: (
            <>
              <p>
                O ProOps é uma plataforma de gestão empresarial voltada para
                operação comercial, propostas, financeiro, CRM, agenda e rotinas
                administrativas. Esta política se aplica ao uso do site e da
                aplicação disponibilizados em `proops.com.br`.
              </p>
              <p>
                Para dúvidas sobre privacidade ou tratamento de dados, entre em
                contato pelo e-mail `gestao@proops.com.br`.
              </p>
            </>
          ),
        },
        {
          title: "2. Dados que coletamos",
          content: (
            <>
              <p>Podemos tratar as seguintes categorias de dados:</p>
              <p>
                Dados cadastrais de usuários, como nome, e-mail, cargo, empresa,
                identificadores internos e informações de autenticação.
              </p>
              <p>
                Dados operacionais inseridos pelos próprios usuários, como
                clientes, contatos, propostas, compromissos, transações e
                observações registradas dentro da plataforma.
              </p>
            </>
          ),
        },
        {
          title: "3. Como utilizamos os dados",
          content: (
            <>
              <p>Os dados são utilizados para:</p>
              <p>
                disponibilizar a plataforma, autenticar usuários, organizar
                operações internas, gerar documentos, manter histórico das ações
                realizadas e permitir o uso dos módulos contratados;
              </p>
              <p>
                prestar suporte, corrigir falhas técnicas, prevenir fraude e
                cumprir obrigações legais;
              </p>
              <p>
                viabilizar integrações ativadas pelo próprio usuário ou pela
                empresa, inclusive a integração com Google Agenda.
              </p>
            </>
          ),
        },
        {
          title: "4. Integração com Google Agenda",
          content: (
            <>
              <p>
                Quando a empresa ativa a integração com Google Agenda, o ProOps
                solicita acesso para criar, editar, atualizar e excluir eventos
                da agenda conectada, exclusivamente para suportar a
                sincronização dos compromissos da empresa entre o ERP e o Google
                Calendar.
              </p>
              <p>
                As informações obtidas por meio das APIs do Google são usadas
                apenas para fornecer a funcionalidade de calendário solicitada
                pelo usuário. Esses dados não são vendidos nem utilizados para
                publicidade.
              </p>
              <p>
                O uso e a transferência de informações recebidas das APIs do
                Google para qualquer outro aplicativo observarão a{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Política de Dados de Usuário dos Serviços de API do Google
                </a>
                , incluindo os requisitos de Uso Limitado.
              </p>
              <p>
                Os dados obtidos por meio das APIs do Google não são usados para
                veicular anúncios, não são transferidos a terceiros para fins
                que não sejam os de fornecer ou melhorar a funcionalidade de
                sincronização de agenda solicitada pelo usuário, e não são
                utilizados para determinar a elegibilidade a crédito, fins de
                empréstimo ou qualquer outra finalidade não relacionada
                diretamente ao funcionamento do módulo de agenda do ProOps.
              </p>
            </>
          ),
        },
        {
          title: "5. Compartilhamento de dados",
          content: (
            <>
              <p>
                O ProOps não vende dados pessoais. O compartilhamento pode
                ocorrer apenas nas seguintes hipóteses: com prestadores de
                serviço essenciais para infraestrutura e operação da plataforma;
                com provedores de autenticação e integração, como Google e
                Firebase; e para cumprimento de obrigação legal, regulatória ou
                ordem judicial.
              </p>
            </>
          ),
        },
        {
          title: "6. Armazenamento, segurança e retenção",
          content: (
            <>
              <p>
                Adotamos medidas técnicas e organizacionais razoáveis para
                proteger dados contra acesso não autorizado, alteração, perda ou
                destruição indevida.
              </p>
              <p>
                Os dados são mantidos pelo tempo necessário para a prestação do
                serviço, execução das rotinas da empresa usuária, cumprimento de
                obrigações legais e defesa de direitos. Após esse período, podem
                ser excluídos ou anonimizados, quando aplicável.
              </p>
            </>
          ),
        },
        {
          title: "7. Direitos dos titulares",
          content: (
            <>
              <p>
                O titular dos dados pode solicitar, nos termos da legislação
                aplicável, confirmação do tratamento, acesso, correção,
                atualização, anonimização, eliminação ou esclarecimentos sobre o
                uso de seus dados pessoais.
              </p>
              <p>
                Solicitações relacionadas à privacidade podem ser enviadas para
                `gestao@proops.com.br`.
              </p>
            </>
          ),
        },
        {
          title: "8. Alterações nesta política",
          content: (
            <>
              <p>
                Esta Política de Privacidade poderá ser atualizada a qualquer
                momento para refletir mudanças legais, regulatórias, técnicas ou
                operacionais. A versão mais recente será sempre publicada nesta
                página.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
