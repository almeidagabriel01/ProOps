# CLAUDE.md — src/lib/niches/

Tudo que varia por nicho de negócio. O nicho é escolhido no cadastro, gravado
em `tenants/{id}.niche` e **nunca muda** depois, nem pelo superadmin (rules,
`PUT /v1/tenants` e o painel recusam). Por isso o formato de uma empresa
(catálogo, proposta, obra, demonstração) é fixo desde o primeiro dia.

## Onde cada coisa mora

| O quê | Onde | Quem lê |
|---|---|---|
| Registro de domínio (fonte) | `apps/functions/src/shared/niches.ts` (`NICHE_REGISTRY`, puro) | backend: demo, imagens, agendamento, etapas da obra, rótulo da IA |
| Espelho no front | `registry.ts` (puro, sem import) | proxy (rotas públicas), sitemap, ids, rótulo, caminho da landing |
| Configuração de tela | `definitions/<id>/app.ts` (`NicheConfig`) | toda tela, via `useCurrentNicheConfig()` / `getNicheConfig()` |
| Texto da landing | `definitions/<id>/landing.ts` (`NicheLandingConfig`) | landing, galeria da home, metadados |
| Vocabulário (local, grupo) | `definitions/<id>/app.ts` → `vocabulary` | textos de tela, via `useNicheVocabulary()` ou `getNicheConfig(n).vocabulary` |
| Demonstração | `apps/functions/src/scripts/demo/datasets/<id>.ts` (só dados) | motor `scripts/demo/engine.ts` |
| Rules | `firebase/firestore.rules` (`isKnownTenantNiche`, `isDemoRead`) | cadastro e leitura da demonstração |

`TenantNiche` é o tipo das chaves do registro. Toda tabela que varia por nicho
é um `Record<TenantNiche, ...>`: esquecer um nicho não compila.

## Adicionar um nicho (roteiro)

Cada passo diz o que o cobra. Nenhum passo depende de lembrar.

1. **Registro do backend**: uma entrada em `NICHE_REGISTRY` (demo, limite de
   imagens, tipo de visita, etapas da obra, rótulo da IA). O compilador cobra
   toda tabela derivada.
2. **Espelho do front**: a mesma chave em `registry.ts`, com `label` e
   `landingPath`. **Rules**: o id em `isKnownTenantNiche` e o `demoTenantId` em
   `isDemoRead`. Cobra: `__tests__/niche-registry-parity.test.ts`.
3. **Pasta `definitions/<id>/`**: `app.ts` (config de tela, com o vocabulário)
   e `landing.ts` (texto da landing, SEO e cartão da galeria). Cobra: os
   `Record` de `NICHE_CONFIGS` e `NICHE_LANDING_CONFIG`. Os textos de menu,
   passo da proposta e subtotal do PDF saem do vocabulário
   (`copy-builders.ts`); declare override só para texto autoral.
4. **Demonstração**: `apps/functions/src/scripts/demo/datasets/<id>.ts`,
   registrado em `DEMO_DATASETS`. Cobra: o `Record`, e
   `__tests__/niche-contract.test.ts` (o exemplo do card de atenção precisa
   apontar para propostas do dataset). Depois do deploy, rode o POST
   `/internal/admin/seed-demo-tenant` em cada ambiente.
5. **Página fina** `app/<landingPath>/page.tsx`: `buildNicheLandingMetadata`
   e `<NicheLandingRoute>`, como as outras. Cobra:
   `__tests__/niche-landing.test.ts`. Rota pública, sitemap, galeria e
   `NICHOS_PRONTOS` derivam do registro sozinhos.
6. **Marketing em prosa**: citar o nicho no `app/manifest.ts`, nas keywords de
   `app/layout.tsx` e no FAQ de `components/landing/_shared/faq-data.ts`.
   Cobra: `__tests__/niche-marketing-mentions.test.ts`. E uma aba na cena da
   planta da landing (`components/marketing/cena-planta/dados.ts`, com os seis
   rótulos no vocabulário do nicho, mais a linha do nicho no `globals.css`).
   Cobra: `components/marketing/cena-planta/__tests__/cena-planta.test.ts`.

Nicho que cobra por medida (m², metro linear, faixa de altura) usa os modos que
já existem (`pricing.dimensionModes`) e troca o nome deles em
`pricing.modeLabels`. Os ids `curtain_*` são históricos e não mudam.

## Regras

- **Nunca** `if (niche === "...")` no componente: comportamento vira campo de
  `NicheConfig`. Guard: `src/__tests__/no-niche-literals.test.ts`.
- **Nunca** "ambiente" ou "solução" escritos à mão num texto de tela: use o
  vocabulário e os helpers de concordância de `vocabulary.ts`. Guard:
  `src/__tests__/no-hardcoded-vocabulary.test.ts`.
- No PDF e no `/share` (sem TenantProvider), leia `getNicheConfig(tenantNiche)`
  com o nicho que vem por prop, nunca hook: o hook devolveria automação em
  silêncio.
- Uma frase, um termo variável: frase com dois termos de gênero independente
  vira duas.
