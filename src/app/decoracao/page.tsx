import type { Metadata } from "next";
import Link from "next/link";
import {
  Ruler,
  Layers,
  Palette,
  CreditCard,
  MessageCircle,
  CalendarDays,
} from "lucide-react";
import {
  SoftwareApplicationJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "ERP para Decoração — cortinas, persianas e papéis de parede",
  description:
    "ProOps é o ERP para lojas de decoração. Propostas com cálculo automático de metros, CRM, financeiro e WhatsApp integrados.",
  keywords: [
    "ERP decoração",
    "sistema gestão loja cortinas",
    "ERP persianas",
    "software proposta decoração",
    "sistema decoração interiores",
  ],
  alternates: { canonical: "/decoracao" },
  openGraph: {
    title: "ERP para Decoração — ProOps",
    description:
      "Sistema completo para lojas de decoração: propostas com medidas, CRM, financeiro e WhatsApp.",
    url: "/decoracao",
  },
};

const FEATURES = [
  {
    icon: Ruler,
    title: "Cálculo por metro quadrado",
    description:
      "Monte propostas com cálculo automático por m², por largura de painel ou por faixa de altura. O preço total é calculado em tempo real.",
  },
  {
    icon: Layers,
    title: "Catálogo de tecidos e materiais",
    description:
      "Cadastre cortinas, persianas, papéis de parede, trilhos e acessórios com fotos e preços. Adicione a propostas em segundos.",
  },
  {
    icon: Palette,
    title: "Múltiplos modos de precificação",
    description:
      "Configure preços por m², por largura com painéis, por faixa de altura ou preço fixo. Flexibilidade total para o seu modelo de negócio.",
  },
  {
    icon: CreditCard,
    title: "Financeiro integrado",
    description:
      "Ao aprovar um orçamento, entradas e parcelas são criadas automaticamente no financeiro. Controle entradas e saídas sem planilhas.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp integrado",
    description:
      "Envie propostas e notificações pelo WhatsApp diretamente da plataforma. Comunique-se de forma profissional com cada cliente.",
  },
  {
    icon: CalendarDays,
    title: "Agenda de instalações",
    description:
      "Organize visitas de medição e instalações com calendário integrado. Sua equipe fica alinhada e o cliente recebe confirmação automática.",
  },
];

const MODULES = [
  {
    label: "Precificação por m²",
    description:
      "Defina o preço por metro quadrado e o ProOps calcula o total automaticamente ao informar largura e altura de cada ambiente.",
  },
  {
    label: "Por faixa de altura",
    description:
      "Configure tabelas de preço por faixa de altura — ideal para persianas e cortinas com variação de custo por tamanho.",
  },
  {
    label: "Largura com painéis",
    description:
      "Para papéis de parede e revestimentos vendidos em painéis ou rolos, calcule automaticamente a quantidade e o custo total.",
  },
];

const FAQS = [
  {
    question: "O ProOps funciona para lojas de cortinas e persianas?",
    answer:
      "Sim. O ProOps tem suporte nativo ao nicho de decoração, com campos específicos para medidas, tipos de produto e ambiente do cliente.",
  },
  {
    question: "Posso incluir fotos dos produtos nas propostas?",
    answer:
      "Sim. Ao cadastrar um produto no catálogo, você adiciona a foto. Ela aparece automaticamente no PDF da proposta.",
  },
  {
    question: "O sistema calcula o preço total automaticamente?",
    answer:
      "Sim. Ao adicionar itens com quantidade e preço unitário — ou com medidas e preço por m² —, o ProOps calcula o total da proposta e atualiza o financeiro automaticamente.",
  },
  {
    question: "Qual o custo para começar?",
    answer:
      "Há um plano gratuito para testar. Os planos pagos têm preço acessível para lojas de todos os portes.",
  },
];

export default function DecoracaoPage() {
  return (
    <>
      <SoftwareApplicationJsonLd niche="cortinas" />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: "/" },
          { name: "Decoração", url: "/decoracao" },
        ]}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 py-24 px-4 text-center text-white">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block mb-4 text-xs font-semibold uppercase tracking-widest text-blue-300">
              Para lojas de decoração
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              ERP para{" "}
              <span
                className="animate-gradient-text bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400"
                style={{ backgroundSize: "200% auto" }}
              >
                Lojas de Decoração
              </span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Propostas com cálculo automático de metros, catálogo de tecidos,
              persianas e papéis de parede, CRM e financeiro integrados.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-white text-slate-900 px-8 py-3 font-semibold hover:bg-slate-100 transition-colors"
              >
                Começar grátis
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-white/30 text-white px-8 py-3 font-semibold hover:bg-white/10 transition-colors"
              >
                Fazer login
              </Link>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="bg-slate-900 py-8 px-4 text-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-400">500+</div>
                <div className="text-sm text-slate-400 mt-1">projetos gerados</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-400">R$2M+</div>
                <div className="text-sm text-slate-400 mt-1">em propostas</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-400">30min</div>
                <div className="text-sm text-slate-400 mt-1">para fechar 1 proposta</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              Tudo o que sua loja de decoração precisa
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Do catálogo de produtos ao PDF profissional, o ProOps cobre todo o
              fluxo comercial da sua loja.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group rounded-xl border border-border/50 bg-card p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Niche modules */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-4">
              Modos de precificação para decoração
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              O ProOps oferece três modelos de cálculo de preço específicos para
              lojas de decoração.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {MODULES.map(({ label, description }) => (
                <div
                  key={label}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-6"
                >
                  <h3 className="text-lg font-bold text-primary mb-3">{label}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Perguntas frequentes
            </h2>
            <div className="space-y-3">
              {FAQS.map(({ question, answer }) => (
                <details
                  key={question}
                  className="group rounded-xl border border-border bg-card overflow-hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between px-6 py-4 font-semibold list-none hover:bg-muted/50 transition-colors">
                    {question}
                    <span className="ml-4 flex-shrink-0 text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                      ▾
                    </span>
                  </summary>
                  <div className="px-6 pb-4 text-muted-foreground text-sm leading-relaxed">
                    {answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Sua loja de decoração merece um sistema profissional
            </h2>
            <p className="text-lg text-slate-300 mb-8">
              Junte-se a lojas de cortinas, persianas e papéis de parede que já
              usam o ProOps para fechar mais vendas com propostas profissionais.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-md bg-white text-slate-900 px-8 py-3 font-semibold hover:bg-slate-100 transition-colors"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/automacao-residencial"
                className="inline-flex items-center justify-center rounded-md border border-white/30 text-white px-8 py-3 font-semibold hover:bg-white/10 transition-colors"
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
