import type { Metadata } from "next";
import Link from "next/link";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "ERP para Automação Residencial — propostas, projetos e gestão",
  description:
    "ProOps é o sistema ERP especializado para empresas de automação residencial. Gerencie propostas comerciais com PDF profissional, CRM, financeiro, agenda e WhatsApp em uma plataforma integrada.",
  keywords: [
    "ERP automação residencial",
    "sistema gestão automação residencial",
    "software proposta automação residencial",
    "CRM integradores",
    "ERP integradores AV",
    "gestão projetos automação",
    "proposta comercial automação residencial",
  ],
  alternates: { canonical: "/automacao-residencial" },
  openGraph: {
    title: "ERP para Automação Residencial — ProOps",
    description:
      "Sistema completo para integradores: propostas em PDF, CRM, financeiro, agenda e WhatsApp integrados.",
    url: "/automacao-residencial",
  },
};

export default function AutomacaoResidencialPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="automacao_residencial" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: "Automação Residencial", url: "/automacao-residencial" },
        ]}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-background py-20 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              ERP para Automação Residencial — propostas, projetos e gestão
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              O ProOps foi criado para integradores e empresas de automação
              residencial que precisam profissionalizar suas propostas
              comerciais, organizar o CRM e controlar o financeiro em um só
              lugar.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-8 py-3 font-semibold hover:opacity-90 transition-opacity"
              >
                Começar grátis
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-border px-8 py-3 font-semibold hover:bg-muted transition-colors"
              >
                Fazer login
              </Link>
            </div>
          </div>
        </section>

        {/* Módulos */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Tudo o que sua empresa de automação residencial precisa
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Propostas com PDF profissional
                </h3>
                <p className="text-muted-foreground">
                  Monte propostas detalhadas com lista de produtos, preços,
                  prazo de entrega e condições de pagamento. Gere PDF com sua
                  marca e envie direto ao cliente.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  CRM Kanban para projetos
                </h3>
                <p className="text-muted-foreground">
                  Acompanhe cada oportunidade de venda em um quadro Kanban
                  visual. Saiba exatamente em qual etapa cada projeto está e
                  nunca perca um follow-up.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Financeiro integrado
                </h3>
                <p className="text-muted-foreground">
                  Ao aprovar uma proposta, as parcelas e entradas são criadas
                  automaticamente no financeiro. Controle o fluxo de caixa sem
                  planilhas.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Catálogo de produtos
                </h3>
                <p className="text-muted-foreground">
                  Cadastre painéis, centrais, sensores, câmeras e equipamentos
                  com fotos, descrições técnicas e preços. Adicione a propostas
                  em segundos.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  WhatsApp integrado
                </h3>
                <p className="text-muted-foreground">
                  Notifique clientes pelo WhatsApp quando a proposta é enviada
                  ou aprovada. Comunicação profissional sem sair da plataforma.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Agenda e calendário
                </h3>
                <p className="text-muted-foreground">
                  Organize visitas técnicas, instalações e reuniões. Integração
                  com Google Calendar para sua equipe.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Perguntas frequentes
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  O ProOps é específico para automação residencial?
                </h3>
                <p className="text-muted-foreground">
                  Sim. O ProOps tem suporte nativo ao nicho de automação
                  residencial com catálogo de produtos, templates de proposta e
                  campos específicos para projetos de integração AV.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Posso personalizar os templates de proposta com minha marca?
                </h3>
                <p className="text-muted-foreground">
                  Sim. Você adiciona logotipo, cores e informações da sua
                  empresa. O PDF gerado sai com a identidade visual do seu
                  negócio.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Tem app mobile?
                </h3>
                <p className="text-muted-foreground">
                  O ProOps é um sistema web responsivo que funciona bem em
                  smartphones e tablets. Um app nativo está no roadmap.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Qual o custo para começar?
                </h3>
                <p className="text-muted-foreground">
                  Há um plano gratuito para você testar. Os planos pagos
                  começam com preço acessível para pequenas empresas e
                  integradores independentes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 px-4 bg-primary text-primary-foreground text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Profissionalize sua empresa de automação residencial
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Junte-se a integradores que já usam o ProOps para fechar mais
              projetos com propostas profissionais.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-background text-foreground px-8 py-3 font-semibold hover:opacity-90 transition-opacity"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/cortinas"
                className="inline-flex items-center justify-center rounded-md border border-primary-foreground/40 px-8 py-3 font-semibold hover:bg-primary-foreground/10 transition-colors"
              >
                Ver também: ERP para Cortinas
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
