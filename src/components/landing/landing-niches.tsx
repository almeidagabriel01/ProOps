import Link from "next/link";
import { Cpu, Layers } from "lucide-react";

export function LandingNiches() {
  return (
    <section className="py-20 px-4 bg-white dark:bg-neutral-950">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-3">
            Feito para o seu nicho
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            O ProOps é especializado em dois segmentos. Escolha o que melhor descreve o seu negócio.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Automação */}
          <Link
            href="/automacao-residencial"
            className="group relative rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/40 hover:shadow-xl transition-all duration-300 flex flex-col gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Para integradores</span>
              <h3 className="text-xl font-bold mt-1">Automação Residencial</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Gerencie projetos de automação com catálogo de produtos, sistemas por ambiente e propostas técnicas em PDF profissional.
              </p>
            </div>
            <span className="text-sm font-medium text-primary group-hover:underline">
              Saiba mais →
            </span>
          </Link>
          {/* Decoração */}
          <Link
            href="/decoracao"
            className="group relative rounded-2xl border border-border/60 bg-card p-8 hover:border-primary/40 hover:shadow-xl transition-all duration-300 flex flex-col gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Para lojas de decoração</span>
              <h3 className="text-xl font-bold mt-1">Decoração de Interiores</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Crie propostas com cálculo automático por m², largura ou altura. Catálogo de tecidos, persianas e papéis de parede integrado.
              </p>
            </div>
            <span className="text-sm font-medium text-primary group-hover:underline">
              Saiba mais →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
