import React from "react";

import { CommandFaq } from "@/components/landing/_shared/command-faq";
import { FechoCta } from "@/components/landing/_shared/fecho-cta";
import { Accent } from "@/components/landing/_shared/section-heading";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbarComSessao } from "@/components/landing/landing-navbar-com-sessao";
import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import { NICHE_REGISTRY } from "@/lib/niches/registry";
import type { TenantNiche } from "@/types";

import { NicheCena } from "./niche-cena";
import { NicheDores } from "./niche-dores";
import { NicheEtapas } from "./niche-etapas";
import { NicheHero } from "./niche-hero";
import { NicheModos } from "./niche-modos";
import { NichePlataforma } from "./niche-plataforma";

interface NicheLandingPageProps {
  slug: TenantNiche;
}

/**
 * A landing de um nicho. Componente de SERVIDOR: todo o conteúdo chega pronto
 * no HTML, e as ilhas de cliente são só a navbar (sessão), os botões do herói
 * e a cena do nicho, que hidrata perto da tela. Era o contrário, um cliente só
 * com a página inteira dentro, que também buscava os planos do Stripe sem
 * mostrar preço nenhum.
 *
 * O que muda de um nicho para outro é DADO (`NICHE_LANDING_CONFIG`, as etapas
 * do registro e o vocabulário da config de tela), nunca um `if` de nicho aqui.
 * A cor do nicho entra pela raiz (`data-acento`), e o CSS a entrega a tudo
 * abaixo, inclusive às telas codadas.
 */
export function NicheLandingPage({ slug }: NicheLandingPageProps) {
  const config = NICHE_LANDING_CONFIG[slug];
  const registro = NICHE_REGISTRY[slug];
  const vocabulario = NICHE_CONFIGS[slug].vocabulary;
  const modulosDaCena = config.modules.map(({ title, modo }) => ({ title, modo }));

  return (
    <div
      data-acento=""
      data-nicho-landing={slug}
      style={{ "--acento-claro": config.acento.claro, "--acento-escuro": config.acento.escuro } as React.CSSProperties}
      className="min-h-screen overflow-x-clip bg-white text-black dark:bg-neutral-950 dark:text-neutral-100"
    >
      <SmoothScroll />
      <LandingNavbarComSessao />

      <main>
        <NicheHero hero={config.hero} proposta={config.propostaExemplo} vocabulario={vocabulario} />
        <NicheDores dores={config.dores} />
        <NicheCena titulo={config.cena.titulo} frase={config.cena.frase} dados={config.cena.dados} modulos={modulosDaCena} />
        <NicheEtapas etapas={registro.stageTemplate} visita={registro.defaultVisitType.label} />
        <NicheModos secao={config.modulesSection} modulos={config.modules} />
        <NichePlataforma />
        <CommandFaq
          items={config.faq}
          eyebrow={null}
          title={
            <>
              Perguntas de quem é do <Accent>ramo</Accent>
            </>
          }
          description={`Sobre a ProOps para ${registro.label.toLowerCase()}.`}
        />
        <FechoCta
          titulo={config.cta.title}
          frase={config.cta.subtitle}
          primario={{ rotulo: "Criar conta", href: config.hero.primaryCta.href }}
          secundario={{ rotulo: config.cta.crossLink.label, href: config.cta.crossLink.href }}
          estacoes={[...new Set([registro.defaultVisitType.label, ...registro.stageTemplate.map((e) => e.name), ...config.hero.provas])]}
        />
      </main>

      <LandingFooter />
    </div>
  );
}
