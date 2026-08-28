# Roadmap de Escala — custo e performance

Escrito em 2026-08-27, com 1 cliente ativo. A regra que organiza tudo aqui:
**nada entra antes de o gatilho disparar**, e todo item declara o gatilho e o
custo. Gasto fixo mensal novo hoje = R$ 0.

O maior risco de escala deste produto nunca foi falta de infraestrutura — é
query cujo custo cresce com o histórico do cliente. Infra se adiciona numa
tarde; leitura amplificada só aparece quando o cliente grande reclama de
lentidão e a fatura chega junto.

---

## 1. Base que já existe (não refazer)

Verificado no código. Não "melhorar" nada disto sem medir antes:

- **Cache LRU** do doc do tenant (`lib/tenant-doc-cache.ts`, TTL 5s) e do plano
  (`lib/tenant-plan-policy.ts`, TTL 30s). O caminho de auth não bate no
  Firestore a cada request.
- **Aggregation query `.count()`** para uso de plano (propostas/carteiras/
  usuários/planilhas), com doc agregado em `tenant_usage` na frente.
- **Summary financeiro server-side** (`GET /v1/transactions/summary`) via
  `paidTotal`/`pendingTotal` desnormalizados, mantidos pelo trigger
  `onTransactionTotals`. Substitui cálculo no browser.
- **Escopo por período** nas transações + aba Agrupados lendo 1 doc-resumo por
  grupo de `transaction_groups`, com membros lazy.
- **`limit(50)`** no listener realtime de notificações, com pausa em aba oculta.
- **PDF isolado do monolito** (`concurrency: 2`, `maxInstances: 5`) — OOM
  eliminado por construção, com cache em Storage e lock em Firestore.
- **Filas que já existem**: `wallet_cascade_jobs` (doc Firestore + trigger +
  cursor de continuação, sobrevive ao timeout de 540s) e `payout_attempts`
  (retry por `nextRetryAt`).

## 2. Feito em 2026-08-27

- **Editor de lançamento escopado** — 4 chamadas de `getTransactions(tenantId)`
  removidas. Abrir a edição de uma recorrência baixava a coleção inteira do
  tenant **duas vezes**. Detalhes e o guard de varredura em
  `apps/web/src/app/transactions/CLAUDE.md`.
- **`ai_traces`** — um doc por turno da Lia (ferramenta, latência, desfecho,
  provider, tokens). Ver `apps/functions/CLAUDE.md`.

---

## 3. Pendente com você — ~20 min, custo R$ 0

> **Status em 2026-08-27:** 3.1 concluído até o secret (falta o deploy). 3.2
> concluído: budget de R$ 200 com gatilhos 50/80/100%, alerta de leituras do
> Firestore, alerta log-based de fail-open do rate limit, e TTL de `ai_traces`
> nos dois projetos. Pendente: TTL de `occurrences` (apaga dado existente —
> ver `apps/functions/CLAUDE.md`) e o deploy.

Não dá para fazer por código: exigem login interativo e permissão de billing.

### 3.1 Ligar o rate limit distribuído

Hoje `RATE_LIMIT_STORE` não está setado em nenhum `.env`, então os **4**
limitadores (`api/index.ts` global, `ai/rate-limiter.ts`, `pdf-rate-limiter.ts`,
`ai/field-gen-rate-limiter.ts`) contam em memória, **por instância**. Com
`maxInstances` de 10 (monolito) e 5 (pdf), o limite real é o configurado
multiplicado pelo número de instâncias: o teto de PDF de 5/min vira ~25/min, o
da Lia de 20/min vira ~200/min.

O código está pronto e testado (`lib/rate-limit/redis-store.ts`,
`factory.ts` — 20 testes). Falta credencial.

1. Criar um Redis no [Upstash](https://upstash.com) (free tier; o gatilho para
   começar a pagar é o teto de comandos/dia, bem acima do volume atual).
2. **Só em produção** — acrescentar a `apps/functions/.env.erp-softcode-prod`
   (as chaves já estão documentadas, comentadas, em `.env.example`):
   ```
   RATE_LIMIT_STORE=redis
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```
   **Não ligar em dev.** Três razões: dev roda `maxInstances: 1`
   (`deploymentConfig.ts`), então a contagem em memória já é globalmente
   correta lá; o E2E depende do 429 real com `emulatorBypass: false`, e apontar
   dev para a rede tornaria esses testes dependentes de latência e queimaria
   quota; e o free tier do Upstash dá **1 database**, então dev e prod
   colidiriam nas mesmas chaves (mesmo uid, mesmo prefixo).
3. **Região**: escolher a mais próxima de `southamerica-east1` (São Paulo, se
   oferecida). O limitador global de API roda em TODA request e cada checagem
   são ~2 round-trips REST (INCR + PTTL) — um Redis nos EUA adicionaria duas
   idas e voltas intercontinentais por request, regressão pior que o bug que
   se está corrigindo.
4. **Atualizar o secret do GitHub** — sem isso, a próxima função nova nasce
   sem as variáveis (ver `.claude/rules/ci-cd.md`):
   ```bash
   gh secret set FUNCTIONS_ENV_PRODUCTION --env production --repo almeidagabriel01/ProOps \
     < apps/functions/.env.erp-softcode-prod
   ```
5. `npm run deploy:prod`.

Se a URL/token faltarem, o `factory.ts` cai para memória e emite
`ratelimit_store_fallback_memory` — falha visível, não silenciosa.

### 3.2 Alerta de orçamento e de leituras

O item mais barato de todos e o que evita o susto: sem ele, um bug de
amplificação de leitura é descoberto **na fatura**, 30 dias depois.

A conta `softcodedv@gmail.com` enxerga os dois projetos e a billing account
`0116E9-8D3771-9B2264`, mas a API de budgets exige `gcloud auth
application-default login` (interativo) e habilitar `billingbudgets.googleapis.com`.
Pelo console é mais rápido:

1. **Budget** — console → Billing → Budgets & alerts → Create budget. Escopo:
   `erp-softcode-prod`. Valor: o que você considera inaceitável hoje (com 1–3
   clientes, algo entre R$ 200 e R$ 500 já é sinal de que algo saiu do lugar).
   Alertas em 50% / 80% / 100%. Marcar o e-mail de faturamento.
2. **Leituras Firestore** — console → Monitoring → Alerting → Create policy.
   Métrica `firestore.googleapis.com/document/read_count`, agregação diária,
   threshold acima do seu normal. As policies já existentes (uptime, 5xx,
   latência p95 filtrada no serviço `api`, pico de instâncias) estão descritas
   em `apps/functions/CLAUDE.md`.
3. **TTL de `ai_traces`** (opcional agora, só higiene):
   ```bash
   gcloud firestore fields ttls update expiresAt \
     --collection-group=ai_traces --enable-ttl --project=erp-softcode-prod
   ```

> Atenção à conta: a conta gcloud ativa nesta máquina é de outra empresa. Use
> `--account=softcodedv@gmail.com` ou troque com `gcloud config set account`.

---

## 4. Próximos passos, por gatilho

Ordenados por quando o gatilho tende a disparar. **Nenhum deles vale a pena
antes do gatilho** — implementar cedo é custo fixo comprado sem necessidade.

### 4.1 Histórico da carteira sem full-fetch

**Gatilho:** o primeiro tenant passar de ~3.000 lançamentos, ou o dialog de
histórico ficar perceptivelmente lento.

`app/wallets/_components/wallet-history-dialog.tsx` é o último
`getTransactions(tenantId)` do projeto, e está na allowlist do guard de
propósito. **Não escopar ingenuamente**: um extra-cost carrega carteira **e**
status próprios, independentes do lançamento pai (o usuário escolhe a carteira
do acréscimo em `extra-cost-dialog.tsx`). Logo:

- `where("wallet","in",[id,name])` perde acréscimo pago nesta carteira cujo
  lançamento pai está em outra;
- `where("status","==","paid")` perde acréscimo pago sob lançamento pendente.

Os dois derrubam entrada de histórico financeiro em silêncio — pior que o custo
que resolvem.

**Fix correto:** campo desnormalizado `walletsInvolved: string[]` no doc de
transactions, mantido pelo trigger `onTransactionTotals` (que já recomputa em
todo write relevante), contendo a carteira do pai e a de cada extraCost.
Consulta vira `where("walletsInvolved","array-contains", walletId)`. Precisa de
script de backfill idempotente — seguir o padrão de
`src/scripts/backfill-transaction-totals.ts`.

### 4.2 Cloud Tasks para trabalho realmente assíncrono

**Gatilho:** envio de WhatsApp ou e-mail competindo com tráfego de request, ou
`processPayoutRetries` (cron de hora em hora varrendo Firestore) virando
desperdício visível.

`onTaskDispatched` de `firebase-functions/v2/tasks` +
`getFunctions().taskQueue().enqueue()`. Retry com backoff, limite de rate e
concorrência por fila, entrega agendada (`scheduleTime`), auth por IAM, escala a
zero, mesmo `firebase deploy` que já existe. Custo praticamente nulo no volume
atual.

**Ressalva:** Cloud Tasks não tem dead-letter nativo (isso é do Pub/Sub). No
estouro de tentativas, persistir o fracasso — `payout_attempts` já é o modelo.

**Não usar BullMQ, pg-boss ou RabbitMQ.** BullMQ exige Redis persistente **e um
worker sempre ligado** com conexão TCP — Cloud Functions congela a instância
fora da request, então o worker é quebrado por construção; seria preciso um
Cloud Run separado com `min-instances=1`, ou seja, piso de custo fixo mensal.
pg-boss exige Postgres, que não existe no projeto. RabbitMQ é broker com ops
própria.

### 4.3 PDF assíncrono

**Gatilho:** saturar de fato os 10 Chromiums simultâneos de produção
(`maxInstances: 5` × `concurrency: 2`), ou 429 de `PDF_RATE_LIMIT_EXCEEDED`
virando reclamação.

Antes disso, fila **piora** a UX: troca um download direto por pedir → aguardar
→ baixar. O cache em Storage e o lock em Firestore já absorvem o caso comum.

### 4.4 Paginação nos services que ainda não têm

**Gatilho:** um tenant com muitos contatos/propostas reclamar de lentidão de
carregamento.

Sem `limit()` hoje: `addon`, `ambiente`, `custom-field`, `kanban`, `option`,
`proposal-template`, `sistema`, `tenant`, `user`. A maioria é coleção pequena
por natureza (opções, sistemas) — os que importam de verdade são
`client-service` (contatos/CRM) e `proposal-service`.

### 4.5 Langfuse

**Gatilho:** você começar a **iterar prompt com avaliação** — comparar versões,
dar nota em resposta, montar dataset de regressão.

Até lá, `ai_traces` responde as perguntas operacionais ("o que quebrou, qual
ferramenta falha, quanto custa por tenant"). Quando o gatilho vier, **self-host**:
os args das ferramentas carregam nome de cliente, valor e CPF, e mandar isso
para SaaS de terceiro é questão de LGPD, não de gosto. O SDK também faz flush em
batch por HTTP — em Cloud Run com scale-to-zero, flush no shutdown é pouco
confiável e perde trace justamente das instâncias que morreram.

### 4.6 LangGraph

**Gatilho:** a Lia virar job assíncrono multi-passo que precisa sobreviver a
restart de processo ("fecha o mês pra mim", rodando minutos), ou existirem
agentes especializados distintos.

Hoje é turno único, `MAX_TOOL_ROUNDS = 5`, SSE que morre com a request, e o
human-in-the-loop já é melhor que o padrão do framework: `request_confirmation`
+ token assinado contra `sessionId`, com gate server-side (`ctx.confirmed !==
true`) em **todos** os 7 handlers destrutivos. LangGraph puxa `@langchain/core`
para dentro do bundle e desfaz o `await import()` que existe justamente para
manter `@google/genai` e `groq-sdk` fora do cold start.

**Antes de qualquer discussão sobre LangGraph:** extrair as ~120 linhas do loop
de tool-calling duplicadas no branch de fallback Groq de `ai/chat.route.ts`.
É `extract function`, e é o que realmente incomoda naquele arquivo.

---

## 5. O que não fazer (armadilhas de custo fixo)

- **`min-instances > 0`** — resolve cold start e é a alavanca mais tentadora.
  Custa instância ligada 24/7, por serviço, para sempre, mesmo com zero tráfego.
  Com poucos clientes o cold start incomoda você mais do que eles. Reavaliar só
  quando houver tráfego contínuo suficiente para as instâncias já ficarem
  quentes sozinhas.
- **Redis como cache de aplicação** — o LRU por instância já resolve. Redis
  entra só pelo rate limit (3.1), no free tier.
- **Memorystore** — VPC connector + custo fixo. Upstash REST cobre o caso.
- **Qualquer SaaS com piso mensal** enquanto o problema que ele resolve não
  estiver medido.

---

## 6. Números para acompanhar

Teto atual de produção: `api` 10 instâncias × 80 concurrency = 800 requests
simultâneos; `pdf` 5 × 2 = 10 renders simultâneos. Ambos em
`deploymentConfig.ts`. Não são limites que apertam hoje — são os números para
alarmar antes de encostar.

Custo do Firestore é **por documento lido**, não por CPU. É por isso que a
seção 4 abre com query, não com infraestrutura.
