import type { Metadata } from "next";
import Link from "next/link";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Sistema ERP para Lojas de Cortinas e Persianas",
  description:
    "ProOps é o ERP especializado para lojas de cortinas e persianas. Crie propostas com medidas e tecidos, gerencie clientes, financeiro e WhatsApp em uma plataforma completa para o seu negócio.",
  keywords: [
    "ERP cortinas",
    "sistema gestão loja cortinas",
    "software proposta cortinas",
    "ERP persianas",
    "gestão loja persianas",
    "proposta comercial cortinas",
    "sistema para cortinas e persianas",
    "software para decoração de janelas",
  ],
  alternates: { canonical: "/cortinas" },
  openGraph: {
    title: "ERP para Lojas de Cortinas e Persianas — ProOps",
    description:
      "Sistema completo para lojas de cortinas: propostas com medidas, CRM, financeiro e WhatsApp integrados.",
    url: "/cortinas",
  },
};

export default function CortinasPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="cortinas" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: "Cortinas e Persianas", url: "/cortinas" },
        ]}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-background py-20 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Sistema ERP para Lojas de Cortinas e Persianas
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              O ProOps foi desenvolvido para lojas de cortinas e persianas que
              querem profissionalizar as propostas, organizar o atendimento ao
              cliente e controlar o financeiro sem complicação.
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
              Tudo o que sua loja de cortinas precisa
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Propostas com medidas e tecidos
                </h3>
                <p className="text-muted-foreground">
                  Monte propostas detalhadas com ambientes, medidas, tipos de
                  tecido, trilhos e acessórios. Gere PDF profissional com foto
                  dos produtos e preço total.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Catálogo de produtos
                </h3>
                <p className="text-muted-foreground">
                  Cadastre cortinas, persianas, tecidos, trilhos e acessórios
                  com fotos, preços e descrições. Adicione a propostas em
                  segundos.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  CRM de clientes
                </h3>
                <p className="text-muted-foreground">
                  Acompanhe cada cliente e oportunidade de venda. Histórico
                  completo de propostas, aprovações e comunicações em um só
                  lugar.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Financeiro integrado
                </h3>
                <p className="text-muted-foreground">
                  Ao aprovar um orçamento, entradas e parcelas são criadas
                  automaticamente no financeiro. Controle entradas e saídas sem
                  planilhas.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  WhatsApp integrado
                </h3>
                <p className="text-muted-foreground">
                  Envie propostas e notificações pelo WhatsApp diretamente da
                  plataforma. Comunique-se de forma profissional com cada
                  cliente.
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <h3 className="text-xl font-semibold mb-3">
                  Agenda de instalações
                </h3>
                <p className="text-muted-foreground">
                  Organize visitas de medição e instalações com calendário
                  integrado. Sua equipe fica alinhada e o cliente recebe
                  confirmação automática.
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
                  O ProOps funciona para lojas de cortinas e persianas?
                </h3>
                <p className="text-muted-foreground">
                  Sim. O ProOps tem suporte nativo ao nicho de cortinas e
                  persianas, com campos específicos para medidas, tipos de
                  produto e ambiente do cliente.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Posso incluir fotos dos produtos nas propostas?
                </h3>
                <p className="text-muted-foreground">
                  Sim. Ao cadastrar um produto no catálogo, você adiciona a
                  foto. Ela aparece automaticamente no PDF da proposta.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  O sistema calcula o preço total automaticamente?
                </h3>
                <p className="text-muted-foreground">
                  Sim. Ao adicionar itens com quantidade e preço unitário, o
                  ProOps calcula o total da proposta e, se houver desconto ou
                  valor fechado, atualiza o financeiro automaticamente.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Qual o custo para começar?
                </h3>
                <p className="text-muted-foreground">
                  Há um plano gratuito para testar. Os planos pagos têm preço
                  acessível para lojas de todos os portes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 px-4 bg-primary text-primary-foreground text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Sua loja de cortinas merece um sistema profissional
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Junte-se a lojas de cortinas e persianas que já usam o ProOps
              para fechar mais vendas com propostas profissionais.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-background text-foreground px-8 py-3 font-semibold hover:opacity-90 transition-opacity"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/automacao-residencial"
                className="inline-flex items-center justify-center rounded-md border border-primary-foreground/40 px-8 py-3 font-semibold hover:bg-primary-foreground/10 transition-colors"
              >
                Ver também: ERP para Automação Residencial
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
