# Runbook de Escalabilidade — ProOps

Referência operacional: quando agir, o que ligar, e os designs já decididos para
não serem "descobertos" às pressas. Baseline e decisões de 2026-07-06 (plano em
`docs/plans/2026-07-06-otimizacao-escalabilidade.md`).

## Baseline (2026-07-06, prod `erp-softcode-prod`)

| Métrica | Valor |
|---|---|
| Pico de instâncias do `api` | 1–2 (de 10 max) |
| Requests/dia no `api` | ~7.200 — dominado pelo uptime check do `/api/health` (1/~12s); tráfego humano é o delta de ±70/dia |
| Leituras Firestore/dia | 45 – 4.400 (free tier: 50.000/dia) |
| Custo | Dentro do free tier |

## Gatilhos de ação (Cloud Monitoring, projeto prod)

| Métrica | Limiar | Ação |
|---|---|---|
| `run.googleapis.com/container/instance_count` (api), pico sustentado | ≥ 3 por 7 dias | **Ligar Redis** (seção abaixo) |
| `firestore.googleapis.com/document/read_count` | > 20k/dia sustentado | Atacar P1 do backlog client-side (`docs/plans/2026-07-06-firestore-client-audit.md`): summary financeiro server-side |
| idem | > 40k/dia | P1+P2 urgentes (free tier = 50k/dia) |
| Latência p95 do `api` | > 2s sustentado | Perfilar hot path; conferir `AUTH_CLAIMS_FRESHNESS=auto` ativo |
| Memória p99 do `api` | > 80% | NÃO reduzir memória; investigar proxy-image (5MiB/req bufferizado) e fluxo WhatsApp→PDF |
| Memória p99 do `api` | < 40% por 30 dias E fluxo WhatsApp-PDF migrado para a função `pdf` | Candidato a reduzir monolito para 512MiB (corta ~50% do componente memória) |
| Contention em `wallets` (erros ABORTED/latência de criação de transação > 3s) | reclamações | Implementar sharded wallet balance (design abaixo) |
| Erros 429 legítimos de usuários reais | recorrente | Revisar limites por rota antes de subir maxInstances |

## Runbook: ligar rate limiting distribuído (Redis/Upstash)

Todo o rate limiting HTTP (geral, PDF, AI chat RPM, field-gen) já roda sobre o
store plugável (`lib/rate-limit/factory.ts` + `express-limiter.ts`). Ativação é
só configuração — **zero código**:

1. Criar database Upstash Redis, região **AWS sa-east-1** (São Paulo — mesma
   região do Cloud Run). Free tier: 500k comandos/mês (~1 comando/request).
2. Em `apps/functions/.env.erp-softcode` (validar em dev primeiro):
   ```
   RATE_LIMIT_STORE=redis
   UPSTASH_REDIS_REST_URL=https://<db>.upstash.io
   UPSTASH_REDIS_REST_TOKEN=<token>
   ```
3. `npm run deploy:dev` → validar: estourar um limite (ex.: 6º PDF em 1min) e
   conferir `Retry-After` consistente + evento `ratelimit_triggered` no log.
   Falha do Redis é **fail-open** (loga `ratelimit_store_error_allowing_request`
   e deixa passar) — indisponibilidade nunca derruba a API.
4. Repetir env em `.env.erp-softcode-prod` → `npm run deploy:prod`.

Exceções conscientes (continuam por instância, por design):
- **SSE cap do AI chat** (20 conexões/tenant) — conexões abertas são recurso da
  instância; contagem distribuída vazaria slots em crash.
- **stripeWebhook** (240/min por IP, função separada) — assinatura verificada é
  a proteção real; limiter é só anti-flood.

## Design futuro: sharded wallet balance (NÃO implementar antes do gatilho)

Problema: saldo desnormalizado em `wallets/{id}.balance` com
`FieldValue.increment` ⇒ ~1 write/s por documento. Import em massa ou tenant
grande colide (erros ABORTED em transação).

Design decidido:
- `wallets/{id}/shards/{0..N-1}` com campo `delta` (increment); N=5 inicial.
- Escrita: shard escolhido por hash do transactionId (`hash % N`) — mantém
  idempotência de retries no mesmo shard.
- Leitura de saldo: `getAll` dos N shards + campo base `balance` (soma).
- Migração: flag `balanceSharded: true` por wallet; script de backfill move o
  saldo atual para o campo base e zera shards; leitura tolera os dois modos.
- Gatilho: contention real medida (ver tabela). Antes disso é complexidade
  gratuita.

## O que já foi decidido e NÃO fazer

- **minInstances**: desnecessário — uptime check do `/api/health` mantém 1
  instância quente 24/7 sem custo de min-instance.
- **Fila (Cloud Tasks/PubSub)**: sem produtor de volume; PDF isolado na função
  `pdf` e e-mails paralelos resolveram os candidatos. Reavaliar só com fato novo.
- **Reduzir memória do monolito**: bloqueado por proxy-image (buffer 5MiB/req ×
  concurrency 80) e WhatsApp→PDF in-process. Ver gatilho na tabela.
- **`limit()` cego nos getters de lista client-side**: quebraria summary
  financeiro e busca. Backlog correto em
  `docs/plans/2026-07-06-firestore-client-audit.md`.

## Verificação rápida de saúde (comandos)

```bash
# Pico de instâncias e requests/dia (últimos 7 dias) — requer gcloud auth
TOKEN=$(gcloud auth print-access-token)
BASE="https://monitoring.googleapis.com/v3/projects/erp-softcode-prod/timeSeries"
curl -sG "$BASE" -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'filter=metric.type="run.googleapis.com/container/instance_count" AND resource.labels.service_name="api"' \
  --data-urlencode "interval.startTime=$(date -u -d '7 days ago' +%Y-%m-%dT00:00:00Z)" \
  --data-urlencode "interval.endTime=$(date -u +%Y-%m-%dT%H:00:00Z)" \
  --data-urlencode 'aggregation.alignmentPeriod=86400s' \
  --data-urlencode 'aggregation.perSeriesAligner=ALIGN_MAX' \
  --data-urlencode 'aggregation.crossSeriesReducer=REDUCE_MAX'
```

Leituras Firestore: mesmo comando com
`metric.type="firestore.googleapis.com/document/read_count"` e `ALIGN_SUM`/`REDUCE_SUM`.
