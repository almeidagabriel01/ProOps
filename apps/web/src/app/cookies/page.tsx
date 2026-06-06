import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de Cookies | ProOps",
  description:
    "Saiba quais cookies o ProOps utiliza, para quais finalidades e como você pode gerenciá-los.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Política de Cookies"
      description="Esta página explica o que são cookies, quais tipos o ProOps utiliza, com quais finalidades e como você pode gerenciá-los no seu navegador."
      updatedAt="5 de junho de 2026"
      sections={[
        {
          title: "1. O que são cookies",
          content: (
            <>
              <p>
                Cookies são pequenos arquivos de texto armazenados no seu
                dispositivo quando você acessa um site. Eles permitem que a
                plataforma reconheça seu navegador, mantenha você autenticado e
                entenda como o serviço é utilizado.
              </p>
              <p>
                Além de cookies, utilizamos tecnologias semelhantes de
                armazenamento local (como <code>localStorage</code>) para guardar
                preferências de uso. Nesta política, tratamos todas essas
                tecnologias de forma conjunta.
              </p>
            </>
          ),
        },
        {
          title: "2. Cookies estritamente necessários",
          content: (
            <>
              <p>
                São essenciais para o funcionamento da plataforma e não podem ser
                desativados em nossos sistemas. Em geral, são definidos apenas em
                resposta a ações feitas por você, como autenticação e segurança da
                sessão.
              </p>
              <p>
                <strong>__session</strong> — cookie de autenticação do Firebase.
                Mantém sua sessão ativa de forma segura (httpOnly), com validade de
                até 5 dias.
              </p>
              <p>
                <strong>firebase-auth-token</strong> — cookie de compatibilidade
                utilizado apenas em ambientes de desenvolvimento como fallback de
                autenticação.
              </p>
            </>
          ),
        },
        {
          title: "3. Cookies de análise e desempenho",
          content: (
            <>
              <p>
                Ajudam-nos a entender como os visitantes interagem com a
                plataforma, permitindo medir e melhorar o desempenho. As
                informações são coletadas de forma agregada.
              </p>
              <p>
                <strong>Google Analytics</strong> (cookies <code>_ga</code>,{" "}
                <code>_gid</code>, <code>_ga_*</code>) — estatísticas de uso,
                páginas visitadas e origem do tráfego.
              </p>
              <p>
                <strong>Vercel Analytics</strong> e{" "}
                <strong>Vercel Speed Insights</strong> — métricas de desempenho e
                de experiência de carregamento (Core Web Vitals).
              </p>
            </>
          ),
        },
        {
          title: "4. Armazenamento local de preferências",
          content: (
            <>
              <p>
                Utilizamos o armazenamento local do navegador para guardar
                preferências que tornam o uso mais conveniente, como filtros de
                visualização, tema (claro/escuro) e o registro de que você já
                visualizou este aviso de cookies. Esses dados permanecem apenas no
                seu dispositivo.
              </p>
            </>
          ),
        },
        {
          title: "5. Como gerenciar cookies",
          content: (
            <>
              <p>
                Você pode controlar e excluir cookies a qualquer momento pelas
                configurações do seu navegador. A maioria dos navegadores permite
                bloquear cookies ou ser avisado antes de armazená-los.
              </p>
              <p>
                Observe que, ao desativar os cookies estritamente necessários,
                algumas funcionalidades da plataforma — como manter-se conectado —
                podem deixar de funcionar corretamente.
              </p>
              <p>
                Consulte as instruções do seu navegador (Chrome, Firefox, Safari,
                Edge, entre outros) para saber como gerenciar as preferências de
                cookies.
              </p>
            </>
          ),
        },
        {
          title: "6. Atualizações desta política",
          content: (
            <>
              <p>
                Esta Política de Cookies pode ser atualizada periodicamente para
                refletir mudanças nas tecnologias utilizadas ou em requisitos
                legais. Recomendamos revisá-la de tempos em tempos. A data da
                última atualização está indicada no topo desta página.
              </p>
            </>
          ),
        },
        {
          title: "7. Contato",
          content: (
            <>
              <p>
                Para dúvidas sobre esta Política de Cookies ou sobre o tratamento
                dos seus dados pessoais, entre em contato pelo e-mail{" "}
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
