import type { Metadata } from "next";

import { AssinaturaCanais } from "@/components/institucional/assinaturas-hero";
import { PaginaHero, LinhaHero } from "@/components/institucional/pagina-hero";
import { Realce, Secao, TituloSecao } from "@/components/institucional/secao";
import { SplitReveal } from "@/components/marketing/_shared/split-reveal";
import { canonicalFor } from "@/lib/site/host-seo";

import { FormularioDaConversa } from "./_components/formulario-da-conversa";

import { CANAIS } from "@/app/(empresa)/institucional/_content/institucional-copy";

export const metadata: Metadata = {
  title: "Falar com a ProOps",
  description:
    "Comercial, suporte e parcerias: diga o assunto e escreva na mesma tela, para quem responde de verdade.",
  alternates: { canonical: canonicalFor("institucional", "/fale-conosco") },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ProOps",
    title: "Falar com a ProOps",
    description: "O canal certo para cada assunto, e um formulário só.",
    url: canonicalFor("institucional", "/fale-conosco"),
    images: [
      { url: "/opengraph-image.png", width: 1200, height: 630, alt: "ProOps" },
    ],
  },
};

/**
 * Contact, as a conversation rather than as a directory.
 *
 * Esta página era um roteador: três ou quatro motivos, e cada um entregava um
 * link para outro lugar. A justificativa era boa no papel, "o formulário
 * comercial já existe na landing do ERP e um segundo formulário duplicaria a
 * canalização", e o resultado prático era ruim: quem chegava aqui dizendo o que
 * queria era mandado para uma segunda página, para dizer de novo.
 *
 * Agora o motivo escolhido configura um formulário que está na mesma tela, e
 * a canalização continua sendo UMA, porque o envio usa o mesmo endpoint público
 * que a landing do ERP usa. O que muda é o `segment`, que é o que diz qual fila
 * responde. Ver `_components/formulario-da-conversa.tsx`.
 *
 * Os atalhos diretos continuam à vista para quem prefere não escrever num
 * formulário: WhatsApp para suporte, agendamento para comercial, e-mail para
 * parcerias.
 */
export default function FaleConoscoPage() {
  return (
    <main>
      <PaginaHero
        assinatura={<AssinaturaCanais />}
        sobrancelha="Contato"
        titulo={
          <>
            <LinhaHero>Falar com</LinhaHero>
            <LinhaHero atraso={0.09}>
              a <Realce className="font-extrabold">ProOps</Realce>.
            </LinhaHero>
          </>
        }
        descricao="Diga o que traz você aqui e escreva na mesma tela. São três assuntos, e todos terminam em uma pessoa."
        dados={[
          { valor: "03", rotulo: "Assuntos" },
          { valor: "2d", rotulo: "Prazo de resposta" },
        ]}
      />

      <Secao aria-label="Escreva para a ProOps">
        <div className="mx-auto max-w-6xl">
          <TituloSecao
            sobrancelha="Por onde"
            titulo={
              <>
                O que traz você <Realce>aqui</Realce>?
              </>
            }
            className="mb-14"
          />
          <FormularioDaConversa canais={CANAIS} />
        </div>
      </Secao>

      <Secao tom="claro" aria-label="Onde a ProOps fica">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2">
          <TituloSecao
            tom="claro"
            sobrancelha="A empresa"
            titulo={
              <>
                Dados da <Realce>ProOps</Realce>.
              </>
            }
          />
          <dl className="space-y-8 self-center">
            <div>
              <dt className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-black/40">
                E-mail
              </dt>
              <dd className="mt-2">
                <a
                  href="mailto:gestao@proops.com.br"
                  className="text-lg text-black transition-opacity hover:opacity-70"
                >
                  gestao@proops.com.br
                </a>
              </dd>
            </div>
            <div>
              <dt className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-black/40">
                Tempo de resposta
              </dt>
              <dd className="mt-2 text-lg text-black">
                Até dois dias úteis, em qualquer canal.
              </dd>
            </div>
            <div>
              <dt className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-black/40">
                Privacidade
              </dt>
              <dd className="mt-2 max-w-md text-base leading-relaxed text-black/60">
                O que você escrever é tratado conforme a{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-4 transition-opacity hover:opacity-70"
                >
                  Política de Privacidade
                </a>
                , e você pode pedir a exclusão a qualquer momento.
              </dd>
            </div>
          </dl>
        </div>
      </Secao>

      {/*
        O fecho, revelado linha a linha como o das outras páginas do site. Uma
        página de contato termina explicando quem está do outro lado, que é a
        única coisa que ela pode dizer e que um endereço de e-mail não diz.
      */}
      <Secao aria-label="Quem responde">
        <div className="mx-auto max-w-3xl">
          <TituloSecao
            sobrancelha="Quem responde"
            titulo={
              <>
                Não existe <Realce>fila</Realce> entre você e quem constrói.
              </>
            }
            className="mb-10"
          />
          <div className="space-y-6 text-base leading-relaxed text-white/60 md:text-lg">
            <SplitReveal unit="lines" stagger={0.06}>
              A ProOps é feita por três pessoas, e duas delas escrevem o código.
              O que você contar aqui não passa por um atendimento de primeiro
              nível antes de chegar em quem tem a mão no produto.
            </SplitReveal>
            <SplitReveal
              unit="lines"
              stagger={0.06}
              className="[font-family:var(--font-bricolage)] text-xl font-semibold text-white md:text-2xl"
            >
              É por isso que o prazo aqui é de dois dias e não de duas semanas.
            </SplitReveal>
          </div>
        </div>
      </Secao>
    </main>
  );
}
