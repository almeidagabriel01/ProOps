# CLAUDE.md — src/lib/niches/

Tudo que varia por nicho de negócio. O nicho é escolhido no cadastro, gravado
em `tenants/{id}.niche` e **nunca muda** depois, nem pelo superadmin (rules,
`PUT /v1/tenants` e o painel recusam). Por isso o formato de uma empresa
(catálogo, proposta, obra, demonstração) é fixo desde o primeiro dia.

## Onde cada coisa mora

| O quê | Onde | Quem lê |
|---|---|---|
| Registro de domínio (fonte) | `apps/functions/src/shared/niches.ts` (`NICHE_REGISTRY`, puro) | backend: demo, imagens, agendamento, etapas da obra, rótulo da IA |
| Espelho no front | `registry.ts` (puro, sem import) | proxy (rotas públicas), sitemap, ids, rótulo, caminho da landing, etapas da obra (as landings mostram as reais) |
| Configuração de tela | `definitions/<id>/app.ts` (`NicheConfig`) | toda tela, via `useCurrentNicheConfig()` / `getNicheConfig()` |
| Landing | `definitions/<id>/landing.ts` (`NicheLandingConfig`) | landing (cor, cena, proposta de exemplo, textos), galeria da home, metadados |
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
2. **Espelho do front**: a mesma chave em `registry.ts`, com `label`,
   `landingPath` e a cópia de `stageTemplate` (a landing mostra as etapas
   REAIS da obra do nicho). **Rules**: o id em `isKnownTenantNiche` e o `demoTenantId` em
   `isDemoRead`. Cobra: `__tests__/niche-registry-parity.test.ts`.
3. **Pasta `definitions/<id>/`**: `app.ts` (config de tela, com o vocabulário)
   e `landing.ts`. A landing é um template só
   (`components/landing/niche/niche-landing-page.tsx`, de servidor), e o que a
   torna do nicho é este arquivo: `acento` (a cor sobre a base preto e branco),
   `hero.provas`, `dores` (antes e depois), `cena`
   (uma das cenas de `components/landing/niche/cenas/`, ou uma nova no mapa de
   `niche-cena.tsx`), e o `modo` de cada módulo quando ele vende um modo de
   preço. Cobra: os `Record` de `NICHE_CONFIGS` e `NICHE_LANDING_CONFIG`,
   o tipo (campo obrigatório não compila) e
   `__tests__/niche-landing-content.test.ts` (contraste do acento nos dois
   temas, cor distinta dos outros nichos, modos vendidos = modos do nicho,
   cena serializável, produtos da cena só em modos que o nicho tem). As telas
   do ERP da landing são prints de verdade da demonstração do nicho: nicho novo
   entra em `CAPTURAS_DOS_NICHOS` (`lib/landing/capturas.ts`, um `Record`) e
   no roteiro de `tests/capturas-do-erp`. Os textos de menu,
   passo da proposta e subtotal do PDF saem do vocabulário
   (`copy-builders.ts`); declare override só para texto autoral.
4. **Demonstração**: `apps/functions/src/scripts/demo/datasets/<id>.ts`,
   registrado em `DEMO_DATASETS`, com os equipamentos e as três OS de exemplo
   (`fieldService`: uma concluída e assinada, uma agendada, uma aberta). Cobra:
   o `Record`, o tipo, `__tests__/niche-contract.test.ts` (o exemplo do card de
   atenção precisa apontar para propostas do dataset) e
   `seed-demo-field-service.test.ts`. No `app.ts` do nicho, `fieldService` diz
   o que é um equipamento ali e o checklist da preventiva (campo obrigatório). Depois do deploy, rode o POST
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
   Cobra: `components/marketing/cena-planta/__tests__/cena-planta.test.ts`. E
   uma prancha no herói do site da empresa: o segmento em `SEGMENTOS`
   (`app/(empresa)/institucional/_content/institucional-copy.ts`, com o campo
   `nicho`) e o desenho dele em `_components/heroi/pranchas.ts`, que é um
   `Record` e não compila sem ele. Cobra: `__tests__/niche-contract.test.ts`.

Nicho que cobra por medida (m², metro linear, faixa de altura) usa os modos que
já existem (`pricing.dimensionModes`) e troca o nome deles em
`pricing.modeLabels`. O nome das medidas nos campos ("largura", "altura") troca
em `pricing.measureLabels`, como `Term` com gênero, porque os textos de ajuda
concordam ("o comprimento será preenchido"); as telas leem `measureTerms` e o
guard `src/__tests__/no-hardcoded-measure-labels.test.ts` reprova rótulo à mão.
O estoque por medida conta em metro linear (`meterInventoryDefinition`) ou em
m² (`areaInventoryDefinition`, vidro e chapa). Os ids `curtain_*` são históricos
e não mudam.

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
