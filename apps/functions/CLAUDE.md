# CLAUDE.md — apps/functions/ (Firebase Cloud Functions)

## Contexto
Backend em produção com clientes ativos. Express monolith registrado como uma única Cloud Function V2
rodando no Cloud Run em `southamerica-east1`. Mudanças aqui afetam TODOS os tenants imediatamente após deploy.

## Stack
- Node.js 22
- Firebase Functions V2
- Express (monolith)
- TypeScript → compila para CommonJS em `apps/functions/lib/`
- Firebase Admin SDK

## Estrutura
```
apps/functions/src/
├── index.ts              # Entry point — registra a Cloud Function + todos os crons
├── api/
│   ├── controllers/      # 36 controllers (CRUD + webhooks)
│   ├── routes/           # 24 grupos de rotas
│   ├── middleware/        # Auth verification, rate limiting
│   ├── helpers/           # Helpers de rotas
│   ├── services/          # Lógica de negócio server-side (PDF, transações, etc.)
│   └── security/          # CORS policy, URL/SSRF security
├── ai/                   # Módulo IA Lia (Gemini, Groq, rate limiters, tools)
├── billing/              # Fila de billing + reconciliação de price drift
├── stripe/               # Config do Stripe + stripeWebhook
├── services/             # Email (Resend), Zoom (create-meeting), WhatsApp billing
├── lib/                  # Helpers de negócio (auth, finance, storage, observability, MFA)
├── shared/               # Tipos compartilhados com controllers
├── scripts/              # Scripts de manutenção one-time
├── utils/                # Utilitários gerais
├── checkDueDates.ts, checkManualSubscriptions.ts, markOverdueTransactions.ts,
│   checkStripeSubscriptions.ts, reportWhatsappOverage.ts, applyScheduledPlanChanges.ts,
│   checkPriceChanges.ts, cleanupStorageAndSharedLinks.ts, reconcileAddons.ts,
│   processPayoutRetries.ts, cleanupSecurityAuditEvents.ts, checkInactiveSignups.ts,
│   onWalletCascadeJob.ts, onUserSignupNotify.ts   # Crons + triggers (exportados em index.ts)
└── deploymentConfig.ts   # Configuração de deploy (região, memória, timeout, SCHEDULE_OPTIONS)
```

## Projetos Firebase
- `erp-softcode` → dev (`.env.erp-softcode`)
- `erp-softcode-prod` → produção (`.env.erp-softcode-prod`)

## Comandos
```bash
# Build
cd apps/functions && npm run build        # Compila TypeScript → apps/functions/lib/
cd apps/functions && npm run build:watch  # Watch mode para dev

# Dev local
npm run dev:backend  # (na raiz) build:watch + emuladores Firebase

# Deploy
npm run deploy:dev   # (na raiz) → erp-softcode
npm run deploy:prod  # (na raiz) → erp-softcode-prod

# Lint
cd apps/functions && npm run lint

# Testes
npm run test:functions              # (na raiz) unitário — não precisa de infra
npm run test:functions:integration  # (na raiz) integração — sobe o emulador sozinho
```

> **Unitário vs integração.** `jest.config.js` ignora `*.integration.test.ts`
> (`testPathIgnorePatterns`); `jest.integration.config.js` roda só eles, em
> série, via `firebase emulators:exec`. Teste que toque o `db` real de
> `src/init.ts` precisa do sufixo `.integration.test.ts`, senão volta a
> quebrar a suíte unitária de quem não tem emulador ligado.
>
> O emulador usa a porta **8080** (`firebase.json`, e os testes de rules a
> fixam). Se ela estiver ocupada por outro projeto, o comando falha com
> "port taken" — libere a porta antes de rodar.

## Regras críticas

### Autenticação
- TODA rota protegida valida token Firebase no início via middleware
- Custom claims verificados: `tenantId`, `role`, `masterId`
- Stale claims fallback: middleware cai para user document se claims desatualizados

### Multi-tenancy
- TODA query Firestore filtra por `tenantId`
- IDs validados contra `tenantId` do token (não apenas do body)
- Nunca retornar dados de um tenant para outro

### Billing e Stripe
- Webhook valida assinatura com `stripe.webhooks.constructEvent`
- Deploy em produção de qualquer mudança de billing: revisão manual obrigatória
- Scheduled functions de billing: testar no emulador antes de prod

### Firestore
- Transações para operações multi-documento
- `limit()` em TODA query de listagem
- Novos índices: criar no console Firebase e exportar para `firestore.indexes.json`
- Mudanças de schema: plano de migração antes de qualquer deploy

### Error Observability (collections)
- `error_issues/{fingerprint}` — grouped, deduplicated error issues (Admin SDK writes only; MFA superadmin client reads via dashboard).
- `error_issues/{fingerprint}/occurrences/{id}` — capped sample of recent occurrences; `expiresAt` field for Firestore TTL.
- `error_issues/{fingerprint}/_agg/affected` — capped hashed-id sets backing `affectedUsers`/`affectedTenants`.
- `error_metrics/{YYYYMMDDhh}` — hourly severity/source counters.
- `ai_traces/{id}` — um doc por turno da Lia (`src/ai/trace.ts`): provider, modelo,
  status, tokens, latência e a lista de ferramentas (`{name, ok, ms}`). O
  `usage-tracker` só conta mensagem e token — isto é o que responde "o que a Lia
  fez e o que falhou". **Grava nome de ferramenta, nunca args**; da mensagem e da
  resposta só o tamanho. Args carregam nome de cliente, valor e CPF — o teste
  `src/ai/trace.test.ts` falha se algum desses campos entrar no doc.

**Estado das TTL policies (verificado 2026-08-27 via `gcloud firestore fields ttls list`):**

| Collection group | dev | prod |
|---|---|---|
| `ai_traces` | ✅ habilitada | ✅ habilitada |
| `occurrences` | ❌ não habilitada (e habilitar não resolveria) | ❌ idem |

**A nota de deploy antiga do pipeline de erros está incorreta: habilitar a TTL
em `occurrences` seria um no-op.** A TTL do Firestore só age em campo do tipo
`Timestamp`, e `writeOccurrence` grava `expiresAt` como **string ISO**
(`new Date(...).toISOString()`). Verificado no dado de produção em 2026-08-27:
o campo chega como `stringValue`. A policy ficaria ativa e nunca casaria com
documento nenhum.

Para a TTL funcionar ali, `writeOccurrence` teria que gravar
`Timestamp.fromMillis(...)` (é o que `ai/trace.ts` faz — por isso a TTL de
`ai_traces` funciona), e os docs antigos precisariam de backfill ou seriam
deixados para o cap. **Só que não vale a pena hoje:** `occurrences` tem 36
documentos em produção, e `writeOccurrence` já faz trim por
`OCCURRENCE_SAMPLE_CAP = 50` por fingerprint — o crescimento é limitado por
construção, não ilimitado.

Alternativa, se um dia importar: cron varrendo `expiresAt <= nowIso`, que
funciona com string — é exatamente o que `cleanupSecurityAuditEvents.ts` faz.

`--async` no comando de TTL importa: sem ele o gcloud bloqueia esperando a
operação e estoura timeout. Confirme com `ttls list` (passa por `CREATING`
antes de `ACTIVE`). Não é expressável em `firestore.indexes.json`.

### Trabalho assíncrono depois da resposta (Cloud Run)

**Nunca dispare-e-esqueça um write que precisa acontecer.** O Cloud Run só
aloca CPU enquanto a request está sendo processada — os serviços aqui não têm
`cpu-throttling=false`. Promise ainda pendente quando o handler retorna =
instância congelada e trabalho perdido **em silêncio**: nem o `.catch()` roda,
então não há log de erro para investigar.

```typescript
// ERRADO — perde o write, sem deixar rastro
minhaEscrita().catch((e) => logger.warn("falhou", e));

// CERTO — a resposta já foi enviada, então não há latência percebida;
// o await só mantém a instância viva até a escrita terminar
try { await minhaEscrita(); } catch (e) { logger.warn("falhou", e); }
```

Descoberto em 2026-08-27 com o `ai_traces`: a Lia respondia normalmente e
nenhum trace era gravado, sem erro nenhum no log. O mesmo padrão estava no
refund de `refundAiMessage` em `ai/chat.route.ts` (perder aquele write cobra do
tenant uma mensagem que falhou) — os dois foram corrigidos juntos. Guard de
regressão: `src/ai/trace.test.ts`, "finish só resolve depois que a escrita
termina".

O sintoma engana porque em produção **às vezes funciona**: com concurrency 80 e
outras requests em voo, a CPU segue alocada e a escrita completa. Em dev
(`maxInstances: 1`, sem tráfego) falha de forma consistente.

### Modulo Fiscal (Nota Fiscal)

- **Provedor unico: Focus NFe.** Cobre NF-e, NFC-e, NFS-e municipal e NFS-e Nacional no
  mesmo cadastro de empresa. Auth = HTTP Basic com o token no usuario e senha em branco.
- **Cadastro de empresa e consulta de CNPJ so existem em `api.focusnfe.com.br`.** Verificado
  batendo nos dois hosts: em homologacao `/v2/empresas` e `/v2/cnpjs` respondem **404**; em
  producao, 401. Nao e limitacao do provedor — o cadastro de empresas e unico, e o ambiente
  e expresso por qual token a empresa devolve e por quais flags `habilita_*` ela recebe,
  nunca pela URL. `/hooks` existe nos dois. A divisao coincide com a dos tokens:
  token da conta => `resolveRegistryBaseUrl()`; token da empresa => `resolveFocusBaseUrl(env)`.
  O sintoma quando isso quebra e enganoso: o Focus responde "Endpoint nao encontrado",
  que parece erro de rota nossa.
- **A NFS-e tem DOIS padroes, e recursos diferentes.** `FiscalNfsePadrao` (`nacional` |
  `municipal`, default nacional) fica no emitente e resolve o recurso em
  `resolveResourcePath`: nacional => `/v2/nfsen`, municipal => `/v2/nfse`. Os payloads
  **nao se parecem** — o nacional e plano (`cnpj_prestador`, `descricao_servico`,
  `razao_social_tomador`, `logradouro_tomador`...) e o municipal e aninhado
  (`prestador`/`tomador`/`servico`). O cadastro tambem muda: `habilita_nfsen_producao` /
  `habilita_nfsen_homologacao` + `serie_nfsen_*` + `proximo_numero_nfsen_*` no nacional,
  `habilita_nfse` + `serie_nfse_producao` no municipal.
- **`padraoNfse` NAO e um terceiro `FiscalDocumentType`.** Quase toda ramificacao por tipo
  no modulo pergunta "e nota de servico?", e as duas respondem sim — um terceiro valor no
  enum viraria bug silencioso em cada lugar que esquecesse de inclui-lo.
- **O padrao e gravado na propria nota** (`InvoiceDocument.padraoNfse`), nao so nas
  configuracoes do tenant: consultar e cancelar tem que usar o mesmo recurso com que ela
  nasceu. Se o tenant migrar de municipal para nacional, ler o padrao atual tornaria as
  notas antigas inalcancaveis.
- **`codigoTributacaoNacional` e obrigatorio no padrao nacional** e nao e derivavel do item
  da LC 116 — o codigo nacional tem um desdobro que a lista antiga nao carrega (31.01
  sozinho nao diz se e .01 ou .02). O gate cobra; `buildNfsenPayload` lanca
  `NFSEN_SEM_CODIGO_TRIBUTACAO_NACIONAL` como ultima linha de defesa.
- **Data e hora dos documentos vao no fuso de BRASILIA, nunca em UTC**
  (`fiscal-datetime.ts`). O Ambiente Nacional compara o RELOGIO DE PAREDE: uma DPS enviada
  com `dhEmi` em UTC foi rejeitada com **E0008** ("a data de emissao nao pode ser posterior
  a data do seu processamento") mesmo tendo sido emitida 5 segundos ANTES — `03:08+00:00`
  contra `00:08-03:00` do processamento. A competencia tem o mesmo problema por outro
  caminho: `slice(0, 10)` de um ISO em UTC adianta o dia em toda nota emitida depois das
  21h, erro que so aparece a noite. Sem horario de verao desde o Decreto 9.772/2019, entao
  −03:00 e fixo; se voltar, `fiscal-datetime.ts` e o unico arquivo a mudar.
- **Em HOMOLOGACAO a NF-e leva o nome do destinatario substituido pelo literal**
  `NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL` (NT 2011/002, obrigatorio
  desde 01/05/2011). Qualquer outro valor devolve rejeicao **598**. A regra so existe no
  ambiente de teste, entao nunca aparece em producao — e por isso mesmo e facil de esquecer.
  Nao vale para NFS-e: e regra da SEFAZ, nao do Ambiente Nacional.
- **A NF-e e o unico caminho testavel em homologacao para o primeiro emitente.** A NFS-e
  Nacional depende de o municipio ter aderido ao Padrao Nacional **em homologacao**, e a
  adesao e separada por ambiente: Machado/MG so credenciou producao (confirmado pelo Focus,
  rejeicao **E0037**). A NF-e vai para a SEFAZ estadual, que tem homologacao para todos os
  estados — entao o ciclo completo (emissao, autorizacao, gatilho, arquivamento, `ready`)
  da para validar por ali sem emitir nada com valor fiscal.
- **Todo item da NF-e leva os grupos PIS e COFINS**, mesmo zerados — sem eles a SEFAZ
  rejeita com **745** ("NF-e sem grupo do PIS"). O CST sai de `derivePisCofinsCst`, junto
  das outras derivacoes por regime: **99** no Simples (recolhimento unificado no DAS,
  destacar declararia contribuicao que a empresa nao apura ali) e **49** no Regime Normal,
  que apura de verdade mas com aliquota dependente de ser cumulativo ou nao — dado que o
  cadastro nao tem. 49 com zeros nao inventa valor; e o primeiro campo a revisar quando
  existir um tenant fora do Simples.
- **A inscricao municipal do prestador vai na DPS** (`inscricao_municipal_prestador`)
  sempre que existir. A exigencia e do MUNICIPIO, nao do leiaute: cada prefeitura registra
  no CNC da NFS-e se ela e obrigatoria, e Machado exige — rejeicao **E0116**. Mandar sempre
  que houver e mais barato que mapear onde e obrigatoria; omitir quando nao houver tambem
  importa, porque alguns municipios validam o formato de uma IM presente.
- **`totTrib` e um CHOICE obrigatorio dentro de `trib`, e qual filho entra depende do
  regime.** As opcoes sao `vTotTrib`, `pTotTrib`, `indTotTrib` e `pTotTribSN` — exatamente
  uma. Para **ME/EPP** (`opSimpNac` 3) o indicador e PROIBIDO (rejeicao **E0712**) e o campo
  certo e `percentual_total_tributos_simples_nacional`, a aliquota efetiva do DAS; para
  **nao optante** o espelho vale (**E0713**: ali o `pTotTribSN` e que e proibido). MEI segue
  no indicador — nao testado, e mudar no escuro trocaria um caso que funciona por um palpite.
  O `indTotTrib` significa "opto por nao informar os tributos estimados" (Decreto
  8.264/2014): essa porta existe para os demais e esta fechada para ME/EPP.
  A aliquota muda com o faturamento e sai do DAS, entao e do tenant
  (`percentualTotalTributosSimplesNacional` em `fiscal_settings`, campo em
  `/settings/fiscal` visivel so no Simples) — nao uma pergunta por nota. Falta dela vira
  **lacuna** em `fiscal-readiness`, com nome e lugar para resolver, em vez de uma sigla que
  chega minutos depois; `buildNfsenPayload` ainda lanca
  `NFSEN_SEM_PERCENTUAL_SIMPLES_NACIONAL` como ultima linha de defesa.
- **A serie da DPS identifica o SISTEMA emissor, e tem faixa reservada:**
  `00001-49999` aplicativo proprio (nos), `50000-69999` mobile, `70000-79999` emissor web
  (o portal nfse.gov.br), `80000-89999` transcricao manual. Serie fora da faixa e rejeicao
  **E0010**. Consequencia boa e nao obvia: quem emite hoje pelo portal usa a faixa 70000 e
  **precisa** trocar de serie ao migrar — e como a numeracao e por serie, a nova comeca do 1
  sem risco de duplicidade com o que o portal ja emitiu. `lib/fiscal/serie-dps.ts` avisa no
  formulario.
- **A numeracao nao vai no payload de emissao**, nem no nacional nem no municipal: serie e
  proximo numero vivem no cadastro da empresa. Mandar o numero em cada emissao criaria duas
  fontes da verdade para a sequencia, que e o caminho mais curto para duplicidade.
- **DOIS niveis de token — confundir os dois quebra a integracao:**
  - **Token da conta** (`FOCUS_NFE_MASTER_TOKEN`, em env): gerencia o cadastro de empresas,
    consulta CNPJ e registra webhooks. **Nunca emite.**
  - **Token da empresa**: devolvido por `POST /v2/empresas` como `token_homologacao` /
    `token_producao`. E ele que assina as notas daquele CNPJ. Fica cifrado em KMS em
    `fiscal_settings` (`focusTokenHomologacaoEnc` / `focusTokenProducaoEnc`) e e lido por
    `getIssuingToken(tenantId, env)`. Isso e uma vantagem no multi-tenant: nenhum bug
    consegue emitir sob o CNPJ de outro tenant.
  - Nao existe token de homologacao no nivel da conta — ele nasce junto com a empresa.
- **Nenhum codigo de dominio importa o SDK do provedor.** Tudo passa pela interface
  `FiscalProvider` (`api/services/fiscal/`); os nomes de campo do Focus vivem so em
  `focus-payload.ts` (saida) e `focus-response.ts` (entrada). Motivo: a Nuvem Fiscal foi
  desativada em 31/07/2026 com 90 dias de aviso.
- **`fiscal_settings/{tenantId}`** — colecao propria com `allow read, write: if false`,
  NAO um map em `tenants/{id}`: aquele doc e legivel por qualquer membro do tenant e o
  Firestore nao tem regra por campo. Guarda CNPJ, IE/IM, regime, serie/numeracao e a senha
  do certificado A1 cifrada em KMS (`FISCAL_SECRET_KMS_*`, chave separada da do Calendar).
- **O certificado A1 (.pfx) nunca e persistido** — sobe uma vez para o provedor, que o
  custodia e valida (senha, titularidade do CNPJ, validade), e sai da memoria.
- **Ambiente default e `homologacao`**, e a troca tem endpoint proprio
  (`PUT /v1/fiscal/environment`), nao um campo do formulario de configuracao. Salvar a
  configuracao **preserva** o ambiente: antes disso o campo ausente virava "" e resolvia
  para homologacao, entao qualquer salvamento derrubaria um emitente ativo de volta para
  teste em silencio — ele acharia que esta emitindo e nao estaria.
- **`ready` sobrevive a um salvamento de configuracao.** Ate 2026-08-31 qualquer save
  rebaixava `ready` para `registered`, em silencio — e como emissao automatica e convite
  pos-aprovacao dependem de `ready`, corrigir um e-mail desligava os dois sem aviso;
  mexer no proprio `autoIssueRule` desligava o que se acabara de configurar. Agora so
  rebaixa quando o **CNPJ muda**, que e o unico caso em que a prova nao se transfere:
  `ready` significa "uma nota ja foi autorizada por ESTE CNPJ". Comparacao com os digitos
  normalizados dos dois lados, senao o CNPJ mascarado do formulario parece troca de
  empresa a cada salvamento. Guard: `fiscal-settings.ready.test.ts`.
- **O portao e `status === "ready"`**, marcado por `markIssuerReady` na PRIMEIRA nota
  autorizada. Homologacao prova que o nosso codigo monta a nota certa; so a autorizacao
  prova que o emitente esta credenciado na SEFAZ/prefeitura. Existe escape (`force`), com
  confirmacao explicita na UI, para quem ja emite por outro sistema — Bling, Omie e Tiny
  nem travam a troca, entao travar sem saida seria mais rigido que o mercado inteiro.
- **O aviso de modo de teste fica na tela de NOTAS**, nao em configuracoes (padrao do
  Bling): e ali que a pessoa olha o que emitiu, e e ali que "isso nao vale nada ainda"
  precisa estar visivel. E o texto nao diz "homologacao" — para quem instala automacao
  isso nao significa nada, "modo de teste" significa.
- Emissao e **assincrona**: pre-validacao sincrona no provedor, depois fila. `ref` (nossa)
  e query param obrigatorio — reenviar a MESMA ref e idempotente no provedor.
- **A `ref` NAO impede emitir a mesma proposta duas vezes.** Ela nasce de
  `db.collection("invoices").doc()`, ou seja, um id novo a cada chamada: dois cliques
  em "Emitir NF" produzem duas notas distintas, ambas aceitas pelo fisco. Quem cobre
  isso e `previewFromProposal`, que consulta `listInvoicesByProposal` e devolve
  `jaEmitidas` (so **autorizada** e **em processamento** — rejeitada, cancelada, com
  erro e rascunho ficam de fora, porque nao sao documento valido e reemitir depois
  delas e o caminho normal). A UI **avisa e deixa seguir**: existe motivo legitimo
  para uma segunda nota, entao bloquear seria errado; o que faltava era o usuario
  saber.
- **Campos fiscais sao opcionais no cadastro e exigidos na emissao.** Ninguem precisa parar
  para classificar o catalogo inteiro antes de usar o ERP; o gate e `fiscal-readiness.ts`,
  que roda na emissao e lista TODAS as lacunas de uma vez (emitente, cliente, itens).
- **CFOP, CST/CSOSN e unidade comercial NAO ficam no produto** — sao derivados na emissao
  (`natureza-operacao.ts`). CFOP e propriedade da *operacao*: a mesma cortina e 5102 dentro
  do estado e 6102 fora. Guardar no produto forcaria correcao manual em toda venda
  interestadual. CST/CSOSN sai do regime do emitente; a unidade sai do `inventoryUnit`.
- **O gatilho usa o token da EMPRESA daquele ambiente, na base daquele ambiente** — mesma
  regra da emissao. **O token e o que define o ambiente do gatilho no provedor**: registrar
  com o token da conta cria um hook de PRODUCAO (o painel mostra "Utilizar Token: Token
  Principal de Producao · Ambiente: Producao") que nunca notifica uma nota de homologacao.
  `listWebhooks` tambem — listar com o token errado faz o reconcile enxergar os hooks de
  outro ambiente e apagar os errados, ou nenhum.
- **Trocar de ambiente RE-REGISTRA os gatilhos.** Como o token da empresa define onde o
  gatilho vale, mudar o ambiente sem re-registrar deixaria a emissao num lugar e a
  notificacao escutando no outro — as notas voltariam a depender do cron, sem erro e sem
  explicacao. Best-effort e isolado num try/catch proprio: o ambiente JA foi gravado quando
  o registro roda, e deixar a excecao escapar devolveria erro para uma troca que aconteceu.
- **"Ja existe um gatilho para este evento, empresa e url" NAO e falha.** O Focus
  registra por (CNPJ, evento, URL) e recusa duplicata — se ele diz que ja existe, o
  gatilho **esta no ar com a URL que queremos**. Tratar como erro mostrava
  "Notificacao automatica nao registrada" sobre uma integracao funcionando, com um
  botao "Tentar de novo" que nunca resolveria: cada tentativa recria a mesma
  duplicata e recebe a mesma recusa. `isDuplicateWebhookError` conta como
  registrado. Acontece quando o `reconcile` nao apagou o hook antigo — `listWebhooks`
  falhou (o catch de la so registra warning) ou devolveu a lista de outro ambiente.
- **Falha de registro de gatilho e visivel na UI** (`webhookStatus` em `fiscal_settings`,
  exibido no card fiscal) com botao de reenviar (`POST /v1/fiscal/webhooks/retry`). Antes o
  status era gravado e nunca mostrado, e a unica forma de repetir o registro era reenviar o
  certificado — recadastrando a empresa inteira no provedor para recriar um hook.
- **O gatilho e registrado pelo nome do EVENTO do provedor, que tem TRES valores**
  (`nfe`, `nfse`, `nfsen`) enquanto o dominio tem dois. `registerFiscalWebhooks` deriva o
  evento de `resolveResourcePath` — o mesmo que escolhe o recurso de emissao —, e o receptor
  traduz de volta em `EVENT_TO_TYPE`. Registrar `nfse` e emitir em `nfsen` **nao da erro em
  lugar nenhum**: o registro e aceito, a emissao e aceita, e a notificacao nunca chega; a
  nota fica presa em `processing` ate o cron. Foi assim com a primeira nota real, que ja
  estava rejeitada no Ambiente Nacional enquanto a UI mostrava "Processando".
- **Webhook do Focus NAO tem cabecalho de autenticacao** (diferente do Asaas, que assina com
  `asaas-access-token`). A propria URL e a credencial: `/webhooks/focus/:tenantId/:secret/:type`,
  com o segredo comparado em tempo constante. Segredo invalido responde **200**, nao 401 — e
  falha permanente, e 401 faria o Focus retentar 5 vezes em 24h a toa.
- **O cron `processInvoiceRetries` (15 min) nao e redundancia, e o unico backstop.** O Focus
  retenta a notificacao em 1min, 30min, 1h, 3h e 24h e depois **nunca mais dispara**. Uma queda
  de entrega nessa janela deixaria a nota presa em `processing` para sempre.
- **A nota nasce de um documento de negocio**, nunca de formulario em branco:
  `POST /v1/fiscal/invoices/from-proposal/:id` e `from-transaction/:id`. Uma proposta
  **mista gera DUAS notas** — NF-e da mercadoria e NFS-e da mao de obra —, separadas por
  `ProposalProduct.itemType`. Faltando qualquer dado fiscal, **nenhuma** e enviada: meia
  venda mista faturada e pior que nenhuma.
- **Botoes e gatilhos automaticos chamam as MESMAS funcoes** (`invoice-issue.service.ts`),
  entao nao existe caminho automatico que pule uma validacao do manual.
- **`GET /v1/fiscal/invoices/preview/from-proposal/:id` responde sem emitir.** Reaproveita
  `assembleInvoices` — que monta os documentos e acumula as lacunas mas nao despacha — e
  por isso da exatamente a mesma resposta que a emissao daria, em vez de uma segunda
  implementacao da regra que poderia divergir em silencio. Devolve `canIssue`, `reason`,
  `gaps`, `documentos` (dois numa venda mista) e `jaEmitidas`.
- **Aprovar uma proposta CONVIDA a emitir**, e isso e comportamento padrao, nao
  configuracao: aprovar e faturar sao o mesmo momento para quem vende. O convite e
  **condicional** — so aparece se o preview disser `canIssue` e nao houver nota valida
  dessa proposta. Convidar e depois mostrar uma checklist de pendencias transformaria o
  atalho em armadilha, e convidar sobre proposta ja faturada seria convite a duplicar.
  Recusar nao deixa pendencia: o botao "Emitir NF" continua na lista.
  Ligado em `useProposalInvoicePrompt`, consumido pela lista de propostas e pelo arraste
  do kanban. **Falta o formulario da proposta**, que redireciona logo apos salvar.
- **`autoIssueRule` continua sem UI, de proposito.** O convite pos-aprovacao entrega a
  conveniencia sem que nada seja emitido sem confirmacao; expor `on_payment` /
  `on_proposal_approved` acrescentaria emissao sem humano no circuito. O codigo dos
  gatilhos segue ligado em `asaas-webhook.controller.ts` e `proposals.controller.ts`,
  alcancavel so por escrita direta no Firestore.
- **Gatilhos sao opt-in e best-effort.** `tryAutoIssue` so dispara se
  `autoIssueRule` bater E `status === "ready"`, e **nunca lanca**: o pagamento ja foi
  confirmado e a proposta ja foi aprovada — falhar a nota nao pode desfazer a venda.
  Ganchos: `handlePaymentSuccess` (asaas-webhook) e `syncApprovedProposalTransactions`.
- **O PDF da NFS-e vem em `url_danfse`, nao em `caminho_danfe`.** A NF-e devolve
  `caminho_danfe` RELATIVO a base; a NFS-e — nos dois padroes — devolve `url_danfse`
  ABSOLUTO (S3, fora do host da API). Ler so o campo da NF-e fez toda NFS-e autorizada
  nascer sem `pdfUrl`: sem botao de baixar na lista e com o arquivamento legal guardando
  apenas o XML. O fixture do teste de NFS-e omitia o campo, entao a suite concordava com o
  bug.
- **Link de documento pode chegar DEPOIS, e `canApplyStatus` nao pode barrar isso.** A
  guarda existe contra regressao de STATUS; consultar uma nota autorizada devolve
  `authorized` de novo, a transicao e recusada e o update inteiro era descartado — links
  inclusive. Uma nota que nasceu sem `pdfUrl` ficava sem ele para sempre, e nenhum botao da
  UI a recuperava. Agora, quando o status nao muda, os campos de link AUSENTES sao
  preenchidos e o retorno e `applied: true` para o arquivamento rodar. Link de documento
  nao regride: ou falta, ou existe e e imutavel — por isso preencher e completar o
  registro, nao reverter estado. Guard: `invoice.backfill-links.test.ts`.
  **Preencher no service nao bastava:** nada disparava a consulta numa nota autorizada —
  `pollPendingInvoices` so varre `processing`/`error`, e o botao "Consultar agora" da UI so
  aparecia em `processing`. A lista mostra agora um botao de buscar o PDF **na propria
  celula onde o download ficaria**, quando a nota esta autorizada e sem `pdfUrl`; ele some
  sozinho assim que o link chega.
- **IBS/CBS na NFS-e: em 2026 o Simples nao destaca nada.** O preenchimento so passa a ser
  obrigatorio para Simples/MEI em **01/01/2027**; em 2026 os dois seguem recolhidos por
  dentro do DAS, e o unico campo novo esperado e o **codigo NBS** (opcional no catalogo,
  enviado como `codigo_nbs` quando o servico tem `nbs`). No DANFSe v2.0 (NT 008/2026) o
  bloco de valores tem TRES linhas — "Valor Liquido da NFS-e", "Total do IBS/CBS" e "Valor
  Liquido da NFS-e + IBS/CBS" — e a NT manda preencher com traço o que nao vem no XML. A
  terceira linha e um TOTAL A PAGAR, nao um valor de imposto.
- **O DANFSe NAO e mais gerado pelo Ambiente Nacional.** A API nacional de geracao foi
  suspensa em **03/08/2026** (NT 008/2026): desde entao cada sistema emissor renderiza o
  proprio PDF a partir do XML. O PDF que baixamos e **do Focus**; o que o contador ve no
  portal e do emissor web. Dois renderizadores lendo o mesmo XML podem divergir num campo
  CALCULADO — e divergem: com o grupo IBSCBS ausente, o portal zera
  "Valor Liquido da NFS-e + IBS/CBS" e o Focus repete o valor liquido. **O XML e o
  documento que vale; o DANFSe e representacao.**
- **Existe grupo IBSCBS na DPS e nos NAO o enviamos** — `ibs_cbs_situacao_tributaria`
  (CST) e `ibs_cbs_classificacao_tributaria` (cClassTrib) no Focus, mais `regApIBSCBSSN`
  para o Simples na NT 009. Na DPS so se declara a SITUACAO; aliquota e valor sao
  calculados pelo Ambiente Nacional e voltam na nota autorizada. A validacao de
  obrigatoriedade esta suspensa (NT 004 v2.00) e para Simples/MEI a regra so vale em
  **01/01/2027** — por isso a nota passou sem o grupo. **Nao chutar CST/cClassTrib:** sao
  codigos de classificacao fiscal, e um valor errado num documento fiscal e pior que a
  ausencia. Os codigos tem zeros a esquerda significativos (`000001` != `1`).
- **DANFE e XML sao espelhados no nosso Storage** (`tenants/{id}/fiscal/{invoiceId}/`) assim
  que a nota e autorizada. Nao e conveniencia: guarda legal de **5 anos + ano corrente**
  (Ajuste SINIEF 07/2005), e depender do link do provedor deixaria o acervo do cliente fora
  do nosso controle. Best-effort e idempotente — falhar nao pode desfazer uma nota valida;
  o cron reencontra e tenta de novo.
- **Download passa pelo backend**, nunca por link direto: `storage.rules` nega a pasta
  `fiscal/` ao client e `application/xml` nem esta na allowlist de content-type.
- **Lancamento avulso nao emite** — sem proposta vinculada nao ha itens, e o sistema
  falha com `LANCAMENTO_SEM_PROPOSTA` em vez de inventar uma linha.
- **A CC-e e CUMULATIVA: a ultima sobrescreve as anteriores perante o fisco.** Cada nova
  carta precisa repetir tudo o que ainda vale — mandar so a novidade apaga a correcao
  anterior, sem erro nenhum, e ninguem descobre antes de uma fiscalizacao. Por isso
  `correctInvoice` **persiste** o texto em `InvoiceDocument.correcoes` (so DEPOIS de o
  fisco aceitar) e o dialogo abre pre-preenchido com a ultima. Limite de **20** eventos
  por NF-e; passar disso e a rejeicao **594**, entao a UI barra antes de gastar a chamada.
- **O que a CC-e NAO corrige** (Ajuste SINIEF 01/07): base de calculo, aliquota,
  quantidade, valor da operacao, qualquer tributo, dado que mude remetente ou
  destinatario, e data de emissao ou de saida. Escrever algo assim **nao da erro** — gera
  uma carta registrada e inutil, com falsa sensacao de resolvido. O dialogo diz isso antes
  do campo de texto. So NF-e tem CC-e; na NFS-e o caminho e cancelar e substituir, e a
  regra e de cada prefeitura.
- **Cancelamento recusado LANCA, nao passa em silencio.** O provedor responde **200 mesmo
  quando o fisco recusa** — o corpo traz `erro_cancelamento` e a nota continua autorizada.
  Sem checar `result.status !== "cancelled"`, o resultado caia em `error`, `canApplyStatus`
  bloqueava a transicao (autorizada nao regride), nada mudava, e a UI mostrava "cancelada"
  sobre uma nota que seguia valendo. O motivo mais comum e prazo: 24h para NF-e na maioria
  dos estados, por municipio na NFS-e. A UI confere o status devolvido tambem — nao confia
  no 200.
- **Status nunca regride** (`canApplyStatus`): webhook nao e ordenado e o cron pode correr junto.
  A unica transicao permitida a partir de terminal e autorizada → cancelada.
- **O unico campo que o usuario realmente digita e o NCM** (por produto) e o codigo LC 116 +
  aliquota ISS (por servico). `POST /v1/fiscal/ncm-suggestions` sugere o NCM via Lia
  (Gemini), reaproveitando cota, rate limiter e gate de plano do modulo de IA. A sugestao
  nunca e aplicada sozinha — a classificacao fiscal e responsabilidade do cliente.
  Na UI esses campos vivem em `components/features/fiscal/catalog-fiscal-fields.tsx`, uma
  secao **recolhida por padrao** no cadastro de produto e de servico. Recolhida de
  proposito: sao opcionais no cadastro e exigidos so na emissao, e quem cadastra um produto
  no dia a dia nao deve tropecar neles.
- **O destinatario tem endereco fiscal PROPRIO** (`clients/{id}.enderecoFiscal`), separado do
  campo `address` livre. Aquele e uma string unica, boa para o dia a dia e inutil para a
  SEFAZ, que valida logradouro, numero, bairro, UF e o codigo IBGE; dividir a string daria
  erro em toda ambiguidade de virgula. **So a NF-e exige endereco** — a NFS-e se contenta com
  nome e documento. Campos: `enderecoFiscal`, `inscricaoEstadual`, `indicadorIe`,
  `consumidorFinal`, todos opcionais e todos na allowlist de `clients.controller.ts`.
  `indicadorIe` vazio e **derivado** do documento (`deriveIndicadorIe`): CPF nunca vira
  "isento", que e a rejeicao 805.
- **Campo fiscal numerico em branco vira `null`, nunca 0.** `Number("")` e 0, e 0 e uma
  aliquota de ISS *valida* (Simples Nacional recolhe o ISS no DAS), entao deixar passar
  faria a nota sair com uma aliquota que o usuario nunca escolheu. `origem` e a excecao
  deliberada: ali 0 = nacional e o default documentado. Coberto por
  `fiscal-catalog-fields.test.ts`.

### Modulo Fiscal — Notas de ENTRADA (recepcao)

Complementa a emissao e e **independente** dela. Aqui NAO somos o emitente: nao
controlamos numeracao, nao assinamos e nao cancelamos. Recebemos, arquivamos e
permitimos a manifestacao.

- **Opt-in por tenant** via `habilitaManifestacao` (flag `habilita_manifestacao` no cadastro
  da empresa no Focus). Nasce **desligada** porque **cada nota recebida consome uma unidade
  do pacote mensal** — a regra do Focus e "cada nota emitida OU RECEBIDA conta como uma
  unidade". O campo e enviado sempre, inclusive `false`, para o cadastro nao precisar ser
  refeito quando a recepcao for ligada. **Ate 2026-09-03 o formulario nao mandava esse
  campo**, entao o modulo inteiro era inalcancavel: backend pronto, cron rodando, colecoes
  criadas, e nenhuma forma de ligar. O mapeamento formulario -> payload virou funcao pura
  (`lib/fiscal/settings-payload.ts`) justamente porque a falha dele e silenciosa — campo
  que nao entra ali some sem erro em lugar nenhum.
- **"Data de inicio de recebimento NFes" no cadastro do Focus e CONTROLE DE CUSTO, e e
  IRREVERSIVEL.** Tooltip do painel, verbatim: *"notas com data de emissao anterior a esta
  data serao descartadas e voce so sera cobrado pelas notas posteriores. Ao deixar em
  branco, iremos recuperar todas as notas que estiverem disponiveis. Apos alterado, este
  campo nao podera ser modificado."* Ou seja: **em branco, a primeira sincronizacao puxa
  todo o historico disponivel e cobra por cada nota**. Nao e obrigatorio — nao e causa de
  "nenhuma nota nova".
  **Nos NAO enviamos esse campo** (`buildEmpresaPayload` manda so `habilita_manifestacao`),
  e o **cliente nao tem painel do Focus** — a conta e da ProOps, as empresas sao cadastradas
  sob ela. Entao hoje **so a ProOps consegue definir essa data**, manualmente, no painel,
  por empresa, ANTES de o cliente ligar a recepcao. Pendente: pegar o nome do campo com o
  suporte do Focus (a pagina `campos.focusnfe.com.br` responde 403 e o nome nao esta em
  fonte publica) e passar a envia-lo — senao todo tenant que ligar a recepcao nasce com o
  historico inteiro sendo cobrado.
- **A UI vive como ABA da tela de notas** (`/invoices`, aba "Recebidas"), nao numa rota
  propria: sao as duas metades do mesmo modulo e compartilham o `pageId` "invoices" e o
  `requirePlanCapability("fiscal")`. O vocabulario e que muda — aqui nao ha numeracao
  nossa, nada e assinado por nos e nao existe cancelamento.
- **O dialogo de manifestacao descreve a CONSEQUENCIA, nao o termo tecnico** ("Confirmo a
  compra", nao "ciencia da operacao"): quem instala automacao nao sabe o jargao mas sabe
  dizer se comprou. Nada vem pre-selecionado e a escolha e zerada ao abrir para outra nota
  — herdar seria o caminho mais curto para manifestar a nota errada.
- **Sincronizacao incremental por `versao`.** Cada nota recebida tem um campo `versao`, unico
  por CNPJ e incrementado a cada alteracao (cancelamento, carta de correcao). O cursor fica em
  `received_invoice_cursors/{tenantId}` e **so avanca depois da gravacao** — se o processo
  morrer no meio, o proximo ciclo refaz o lote em vez de pular notas.
- `shouldApplyReceivedVersion` recusa versao igual ou menor: aceitar uma menor sobrescreveria
  um cancelamento com o estado anterior e a nota voltaria a parecer valida.
- **Antes da manifestacao a Receita entrega so um RESUMO.** O XML completo — com itens, NCM e
  impostos — so vem depois da **confirmacao**. Nao e limitacao do provedor: e como o fisco
  desenhou, para o destinatario assumir formalmente a operacao antes de ter o documento.
- **Manifestacao nunca e automatica.** Confirmar e declaracao formal perante a Receita;
  desconhecer uma operacao legitima tem consequencia fiscal. So `nao_realizada` exige
  justificativa (15 a 255 caracteres).
- **A sinergia que justifica o modulo:** o NCM — unico campo da emissao sem default e sem
  derivacao — vem nos itens da nota de entrada. A recepcao alimenta o catalogo fiscal que a
  emissao precisa.
- Cron `syncReceivedInvoices` roda **de hora em hora**, nao a cada 15 min como o de emissao:
  nota de entrada nao tem urgencia de segundos, o destinatario tem dias para se manifestar.
- **O detalhe da nota mostra a CHAVE DE ACESSO**, nao so valor e fornecedor. E com
  ela que se consulta a nota no portal da Receita, e e o que o contador pede — sem
  exibir, o dado existe no nosso banco e fica inalcancavel para quem precisa dele. O
  dialogo abre em TODA nota, inclusive antes da manifestacao: ali ainda nao ha itens,
  e o texto explica que o detalhamento so vem depois da confirmacao (etapa do
  processo, nao falta de dado).
- **Testar a tela em dev sem fornecedor:**
  `npx tsx src/scripts/seed-received-invoices.ts --tenant=<id>` cria 4 notas
  ficticias (resumo sem resposta, confirmada com itens e NCM, so ciencia,
  cancelada). Recusa rodar em producao; `--clean` remove so o que ele criou.
  Chaves comecam com "99", que nao e UF nenhuma, entao nao colidem com nota real.
  **Nao cobre a manifestacao** — ela faz POST no provedor e seria recusada para
  uma chave inexistente; o comportamento de interface dela esta em
  `manifest-invoice-dialog.test.tsx`. Cobre lista, itens/NCM, lancamento, aviso
  de duplicata e o estado "Lancada", que sao caminhos 100% nossos.
- **A nota vira despesa sob CLIQUE, nunca sozinha**
  (`POST /fiscal/received-invoices/:chave/lancamento`). Quem compra costuma **ja ter
  lancado a compra a mao** quando pagou o fornecedor, e um segundo lancamento nao e um
  registro a mais — e o saldo da carteira errado, que so aparece na conciliacao semanas
  depois. Por isso nao ha gatilho automatico nem configuracao para ligar um.
- **Duas guardas distintas, com desfechos distintos:**
  - `transactionId` ja gravado na nota => `already_launched`, devolve o id. Uma nota gera
    UM lancamento; dois cliques seguidos ou dois usuarios na mesma tela nao duplicam.
  - Despesa de valor equivalente na janela de **45 dias** => `needs_confirmation` com os
    candidatos, HTTP **409**. A UI **avisa e deixa seguir** (`force`): comprar duas vezes o
    mesmo valor do mesmo fornecedor e comum, e bloquear seria pior que avisar.
- **Intervalo sem `orderBy` = ASC, e o indice do projeto e DESC.** A consulta de
  duplicatas usa `where(date >=) + where(date <=)`; sem `orderBy` explicito o Firestore
  assume ASC e pede um indice NOVO, enquanto `(tenantId, type, date DESC)` ja existe.
  O sintoma so aparece em runtime (`FAILED_PRECONDITION`), no primeiro clique de alguem
  — foi assim no primeiro "Lancar". Guard: `received-invoice-transaction.index.test.ts`
  grava a cadeia que o servico monta e confere contra `firestore.indexes.json`, direcao
  inclusive. **Reusar indice existente e sempre mais barato que declarar um novo**:
  indice novo custa build, armazenamento e um deploy que ninguem lembra de fazer.
- **A busca por duplicata casa por VALOR e periodo, nao por fornecedor.** O lancamento
  manual raramente traz a razao social — quem digita escreve "material obra" ou o apelido.
  Casar por nome nao acharia quase nada e daria a falsa sensacao de que nao ha duplicata.
  A janela e larga porque o lancamento manual costuma ser feito no dia do PAGAMENTO, nao
  no da emissao: boleto de fornecedor vence em 28 ou 30 dias. Tolerancia de 2 centavos —
  quem digita a mao arredonda. Usa o indice `(tenantId, type, date)`, que ja existia.
- **O lancamento passa pelo `TransactionService`, nao escreve o doc direto**: e ele que
  valida a permissao financeira, ajusta saldo de carteira em transacao atomica e dispara o
  trigger de totais. Escrever na mao pularia os tres.
- **Nota cancelada pelo fornecedor nao vira despesa** — documento sem validade nao gera
  obrigacao financeira.
- O botao de uma nota ja lancada **vira atalho para a despesa**, nao some: sumir seria a
  pessoa procurando onde o lancamento foi parar. Guards:
  `received-invoice-transaction.test.ts` e `launch-received-invoice-button.test.tsx`.

### Plano do tenant: DUAS fontes que podem divergir

O backend resolve o plano por **`tenants/{id}.plan`** (depois `.planTier`, `.tier`,
`.planId`, priceId, dono) em `tenant-plan-policy.ts`. O frontend resolve por
**`users/{uid}.planId`** (`plan-provider.tsx`). **Sao documentos diferentes.**

Os dois passam a ser escritos juntos pelo writer unico
(`syncTenantPlanBillingSnapshot`) desde **2026-05-07 22:51 BRT** (commit `bbfd638d`).
Toda troca de plano ANTERIOR atualizou so o doc do usuario — o do tenant ficou para
tras.

A divergencia foi **inofensiva por meses**, porque ninguem lia `tenants.plan` para
decidir acesso a modulo. Deixou de ser quando `requirePlanCapability` entrou em
`enforce`: o tenant de dev tinha `users.planId = "enterprise"` e
`tenants.plan = "pro"`, entao a tela mostrava Enterprise (com "Notas Fiscais"
listado no plano) e a API devolvia 402 — sem nada, em lugar nenhum, revelando a
contradicao.

- O 402 devolve **`currentPlan`** (o tier que o BACKEND resolveu) alem do
  `requiredPlan`. Sem ele, "plano insuficiente" e "dado desatualizado" produzem a
  mesma resposta, e as duas exigem acoes opostas.
- `npx tsx src/scripts/audit-tenant-plan-drift.ts` lista as divergencias;
  `--apply` corrige adotando o doc do USUARIO como correto. **Conferir a lista
  antes de aplicar**: se algum tenant foi rebaixado de proposito e so o doc do
  tenant foi atualizado, aplicar o promoveria de volta.
- **Nao "consertar" o resolvedor para preferir o tier mais alto.** Isso liberaria
  modulo para quem foi rebaixado. Se um dia unificar, a decisao e sobre QUAL
  documento e autoritativo — e tem implicacao de cobranca nos dois sentidos.

### Secrets
- Ficam APENAS em `apps/functions/.env.erp-softcode` e `apps/functions/.env.erp-softcode-prod`
- Nunca commitar — arquivos ignorados pelo `.gitignore`
- Usar `apps/functions/.env.example` como referência (sem valores reais)

### Logging
- **Em código novo**: usar `logger` de `../lib/logger` ou `../../lib/logger`
  ```typescript
  import { logger } from "../lib/logger";
  logger.info("Proposta criada", { tenantId, proposalId, uid });
  logger.error("Falha ao enviar WhatsApp", { tenantId, error: err.message });
  ```
- O logger emite JSON com campo `severity` reconhecido pelo GCP Cloud Logging, permitindo filtrar por severity no console.
- Em código existente que usa `console.log/error`, não é necessário migrar — o GCP ainda captura esses logs.
- NUNCA logar tokens, senhas, `FIREBASE_PRIVATE_KEY` ou dados pessoais (CPF, email completo, telefone).
- Erros não tratados em rotas Express são capturados automaticamente pelo global error handler em `api/index.ts` (loga estruturado + alimenta o pipeline de error observability — issues agrupadas no Firestore). Não há Sentry no projeto.

## Módulo Financeiro: Lançamentos & Carteiras (backend)

### Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/api/services/transaction.service.ts` | TODA lógica de negócio de lançamentos (~1800 linhas) |
| `src/api/services/transaction-summary.service.ts` | Summary financeiro via aggregation queries (`GET /v1/transactions/summary`) |
| `src/lib/transaction-totals.ts` | `computeTransactionTotals()` — semântica dos campos desnormalizados `paidTotal`/`pendingTotal` |
| `src/onTransactionTotals.ts` | Trigger que mantém `paidTotal`/`pendingTotal` em todo write de transactions |
| `src/api/controllers/wallets.controller.ts` | CRUD de carteiras |
| `src/lib/finance-helpers.ts` | `resolveWalletRef()`, `addMonths()`, permissões |

### Summary financeiro agregado (paidTotal/pendingTotal)

Cada doc de `transactions` carrega `paidTotal` e `pendingTotal` desnormalizados
(pai entra pelo status do pai; cada extraCost pelo PRÓPRIO status, default
"pending"; overdue conta como pendente). Mantidos pelo trigger
`onTransactionTotals` em qualquer write — **nenhum writer precisa preencher os
campos manualmente**. O endpoint `GET /v1/transactions/summary` soma via
aggregation (2 queries, 1 leitura/1000 docs) — substitui o cálculo no browser
que baixava a coleção inteira. Docs pré-trigger: rodar
`npx tsx src/scripts/backfill-transaction-totals.ts` (idempotente). Índices:
`(tenantId, type, paidTotal)` e `(tenantId, type, pendingTotal)` em
`firestore.indexes.json`.

### Resumos de grupo (`transaction_groups`)

O mesmo trigger `onTransactionTotals` mantém: (a) o campo booleano `grouped`
em cada doc de `transactions` (true se pertence a grupo — habilita a query de
avulsos `where("grouped","==",false)`, já que Firestore não consulta campo
ausente); (b) 1 doc-resumo por grupo em `transaction_groups/{groupDocId}`
(`groupDocId` = groupKey com `:` → `_`, ex: `proposal_p1`, `group_g1`).

- Chave espelha `getGroupedTransactionKey` do frontend: `proposalGroupId` >
  `installmentGroupId`/`recurringGroupId` > avulso (sem doc).
- Cálculo puro em `src/lib/transaction-group-summary.ts`
  (`computeGroupSummary` — usa `computeTransactionTotals` por membro; nunca
  duplicar a semântica de extraCosts).
- Recompute total do grupo a cada write relevante de membro (não increments);
  writes que só tocam campos irrelevantes ao resumo (ou o echo do próprio
  trigger) não geram queries.
- Grupos legados mistos (parte com `proposalGroupId`, parte só
  `installmentGroupId`): promovidos à chave proposal; o doc `group_` é
  deletado.
- Write em `transaction_groups` só via Admin SDK (rules negam client write);
  client lê direto (aba Agrupados).
- Backfill histórico: `npx tsx src/scripts/backfill-transaction-groups.ts`
  (idempotente).

### Arquitetura de Carteiras (CRÍTICO)

**Saldos são DESNORMALIZADOS** no documento Firestore da carteira (campo `balance`). Não são calculados on-the-fly. Toda operação que afeta saldo usa `FieldValue.increment()` dentro de uma Firestore Transaction atômica.

**Campo `wallet` nas transações** = string que pode ser wallet NAME (dados antigos) ou wallet ID (dados novos após migração de abril/2025). O backend resolve ambos via `resolveWalletRef()` em `finance-helpers.ts` — tenta ID primeiro, depois NAME.

**`resolveWalletRef()`** nunca deve retornar null silenciosamente quando há ajuste de saldo — se retornar null, deve lançar erro (comportamento implementado em abril/2025).

Nomes de carteiras são únicos por tenant (validado no create e update de wallet).

### Lógica de Saldo: getWalletImpacts()

```typescript
// Regra: SÓ afeta saldo se status === "paid" E wallet está definido
if (data.status === "paid" && data.wallet) {
  impact = type === "income" ? +amount : -amount
}
// extraCosts seguem o mesmo sinal do pai
```

Ao atualizar: calcula `oldImpacts` (estado atual no DB) e `newImpacts` (novo estado), aplica o delta. Tudo dentro de `db.runTransaction()`.

### syncExtraCostsStatus()

Quando o status do pai muda, custos extras **alinhados** com o status antigo do pai são sincronizados. Custos extras com status independente (diferente do pai) são preservados.

### Proposta → Transação

`syncApprovedProposalTransactions()` em `proposals.controller.ts` cria transações com `proposalId` + `proposalGroupId` + `installmentGroupId`. Wallet resolvida de `proposal.installmentsWallet` ou `proposal.downPaymentWallet` (fallback: carteira padrão do tenant).

Quando a transação muda de carteira, o campo correspondente na proposta é atualizado de volta (`installmentsWallet` ou `downPaymentWallet`).

**Guard crítico:** transações pagas vinculadas a propostas aprovadas NÃO podem ser revertidas para pendente. Para reverter: primeiro reverter a proposta para rascunho.

### Infraestrutura / GCP

- **Cloud Monitoring alerts** — as policies vivem SÓ no GCP (o script
  `scripts/setup-gcp-monitoring.sh` citado antes não existe mais no repo; editar via
  console ou `gcloud monitoring policies update`). Existem em ambos os projetos:
  uptime check no `/api/health`, indisponibilidade (CRITICAL), erros 5xx (ERROR),
  latência p95 (WARNING), pico de instâncias (WARNING), erros por tenant.
  - **`Firestore reads acima do free tier (prod)`** (2026-08-27) — soma de
    `firestore.googleapis.com/document/read_count` > 50.000 numa janela de 24h.
    50k é a cota diária gratuita: o alerta dispara no dia em que a leitura
    deixaria de ser grátis. Baseline medido na criação (30 dias): mediana
    1.666/dia, média 2.293/dia, pico 10.479/dia — o limite fica ~4,8× acima do
    maior pico, então disparo significa mudança real de comportamento.
  - **`Rate limit sem store distribuido (fail-open)`** (2026-08-27) — alerta
    log-based em `ratelimit_store_error_allowing_request`. Filtro obrigatório:
    `resource.type="cloud_run_revision" AND textPayload:"..."`. **É
    `textPayload`, não `jsonPayload`**: `logSecurityEvent` emite
    `console.warn("[SECURITY] " + JSON.stringify(...))`, e o prefixo impede o
    Cloud Logging de fazer o parse para JSON estruturado — diferente do
    `logger` de `lib/logger.ts`, que emite JSON puro e vira `jsonPayload`.
  - **Latência p95**: filtra APENAS o serviço `api` (`resource.labels.service_name = "api"`),
    threshold 8s, duration 300s. Não remover o filtro de serviço: os crons são serviços
    Cloud Run próprios cuja "latência" = duração do job (checkduedates ~20s diários),
    o que disparava alerta falso-positivo todo dia (corrigido 2026-07-06).
- **GCP Cloud Logging** — filtrar por `severity=ERROR` ou pelo campo `tenantId` nos logs estruturados.

---

## Checklist antes de deploy para prod
- [ ] Testado localmente com `npm run dev:backend`
- [ ] `cd apps/functions && npm run build` sem erros
- [ ] Se mudou billing/Stripe: revisão manual feita
- [ ] Se mudou schema Firestore: migração planejada e testada
- [ ] Se mudou Security Rules: testadas com Firebase Emulator
- [ ] Deploy para dev primeiro: `npm run deploy:dev`
- [ ] Validar comportamento no ambiente dev antes de prod
