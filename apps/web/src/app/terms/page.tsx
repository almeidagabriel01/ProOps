import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Termos de Serviço | ProOps",
  description:
    "Termos de Serviço do ProOps para uso da plataforma, módulos, integrações e funcionalidades operacionais.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Serviço"
      description="Estes Termos de Serviço regulam o acesso e o uso do ProOps por empresas, administradores e membros autorizados."
      updatedAt="19 de março de 2026"
      sections={[
        {
          title: "1. Aceitação",
          content: (
            <>
              <p>
                Ao acessar ou utilizar o ProOps, a empresa usuária e seus
                usuários autorizados concordam com estes Termos de Serviço e com a
                Política de Privacidade disponível em `proops.com.br/privacy`.
              </p>
            </>
          ),
        },
        {
          title: "2. Objeto do serviço",
          content: (
            <>
              <p>
                O ProOps oferece uma plataforma de gestão com recursos de agenda,
                CRM, propostas, financeiro, equipe, catálogo, automações e outras
                rotinas operacionais disponibilizadas conforme o plano e os
                módulos ativos da conta.
              </p>
            </>
          ),
        },
        {
          title: "3. Cadastro e responsabilidade da conta",
          content: (
            <>
              <p>
                A empresa é responsável pelas informações fornecidas no cadastro e
                pela gestão dos acessos concedidos aos seus administradores e
                membros.
              </p>
              <p>
                Cada usuário deve manter suas credenciais em sigilo e utilizar a
                plataforma apenas para finalidades legítimas e relacionadas à
                operação da empresa.
              </p>
            </>
          ),
        },
        {
          title: "4. Uso aceitável",
          content: (
            <>
              <p>Não é permitido utilizar o ProOps para:</p>
              <p>
                violar leis, regulamentos ou direitos de terceiros; enviar
                conteúdo ilícito, ofensivo ou fraudulento; tentar acessar áreas
                não autorizadas; interferir na segurança, estabilidade ou
                disponibilidade da plataforma; ou usar integrações de forma
                incompatível com a finalidade do serviço.
              </p>
            </>
          ),
        },
        {
          title: "5. Integrações com terceiros",
          content: (
            <>
              <p>
                O ProOps pode disponibilizar integrações com serviços de terceiros,
                como Google Agenda, para sincronização de dados e automação de
                rotinas.
              </p>
              <p>
                Ao ativar uma integração, a empresa autoriza o ProOps a utilizar
                os acessos necessários para executar a funcionalidade escolhida,
                dentro dos limites concedidos pelo próprio usuário administrador.
              </p>
              <p>
                O uso dos serviços de terceiros também está sujeito aos termos e
                políticas desses provedores.
              </p>
            </>
          ),
        },
        {
          title: "6. Disponibilidade e alterações",
          content: (
            <>
              <p>
                O ProOps busca manter a plataforma disponível e funcional, mas não
                garante operação ininterrupta ou isenta de falhas. Melhorias,
                correções, mudanças de interface e evoluções de produto podem ser
                implementadas a qualquer momento.
              </p>
            </>
          ),
        },
        {
          title: "7. Propriedade intelectual",
          content: (
            <>
              <p>
                O software, a interface, a marca ProOps e os elementos da
                plataforma pertencem aos seus respectivos titulares e não podem
                ser copiados, revendidos, modificados ou explorados sem
                autorização.
              </p>
            </>
          ),
        },
        {
          title: "8. Suspensão e encerramento",
          content: (
            <>
              <p>
                O acesso poderá ser suspenso ou encerrado em caso de violação
                destes termos, uso indevido da plataforma, inadimplência quando
                aplicável, risco à segurança ou exigência legal.
              </p>
            </>
          ),
        },
        {
          title: "9. Limitação de responsabilidade",
          content: (
            <>
              <p>
                Na máxima extensão permitida pela lei, o ProOps não se
                responsabiliza por danos indiretos, perda de lucro, perda de
                oportunidade ou indisponibilidades causadas por falhas externas,
                integrações de terceiros, provedores de infraestrutura ou uso
                inadequado da plataforma pela empresa usuária.
              </p>
            </>
          ),
        },
        {
          title: "10. Contato",
          content: (
            <>
              <p>
                Dúvidas sobre estes Termos de Serviço podem ser encaminhadas para
                `gestao@proops.com.br`.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
