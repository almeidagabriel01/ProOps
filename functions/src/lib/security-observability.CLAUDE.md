# CLAUDE.md — functions/src/lib/ (Logger + Security Observability)

Documentação dos módulos de observabilidade e logging do backend.

## Arquivos Cobertos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `logger.ts` | Logger estruturado para GCP Cloud Logging |
| `security-observability.ts` | Audit trail, métricas e eventos de segurança no Firestore |
| `request-auth.ts` | Helpers de acesso ao AuthContext a partir do `req` |
| `secret-rotation-guard.ts` | Detecta secrets comprometidos em variáveis de ambiente |
| `lib/rate-limit/` (4 arquivos) | Sistema de rate limiting plugável (memória ou Redis) |

---

## logger.ts — Logger Estruturado

### Como Usar

```typescript
import { logger } from "../lib/logger";

// Com contexto estruturado (recomendado)
logger.info("Proposta criada", { tenantId, proposalId, uid });
logger.warn("Wallet não encontrada", { tenantId, walletId });
logger.error("Falha ao enviar WhatsApp", { tenantId, error: err.message });
logger.debug("Iniciando sync de calendário", { tenantId, integrationId });
```

### Severity Levels

| Método | Severity | `console.*` usado |
|--------|----------|-------------------|
| `logger.debug()` | `DEBUG` | `console.log` |
| `logger.info()` | `INFO` | `console.log` |
| `logger.warn()` | `WARN` | `console.warn` |
| `logger.error()` | `ERROR` | `console.error` |

### Formato de Saída

Cada chamada emite um único JSON em uma linha:

```json
{
  "severity": "INFO",
  "message": "Proposta criada",
  "timestamp": "2025-04-01T12:00:00.000Z",
  "tenantId": "abc123",
  "proposalId": "xyz789",
  "uid": "user456"
}
```

O campo `severity` é o campo especial reconhecido pelo **GCP Cloud Logging** para categorização automática. Os logs aparecem no GCP Console com o nível correto (INFO, WARN, ERROR) e podem ser filtrados por severity.

### Integração com GCP Cloud Logging

- **Filtrar erros em produção:** `severity=ERROR` no GCP Console → Cloud Logging
- **Filtrar por tenant:** adicionar `jsonPayload.tenantId="abc123"` no filtro
- **Alertas:** Cloud Monitoring pode criar alertas baseados em `severity=ERROR` e campos customizados
- Todos os logs de Cloud Functions aparecem automaticamente em GCP Logging — não é necessário configurar nada adicional

### O que NUNCA Logar

Nunca incluir os seguintes dados no contexto de log:

| Dado | Motivo |
|------|--------|
| `FIREBASE_PRIVATE_KEY` | Secret crítico de autenticação |
| `STRIPE_SECRET_KEY` | Credencial financeira |
| `WHATSAPP_APP_SECRET` / `WHATSAPP_ACCESS_TOKEN` | Credenciais de integração |
| Senhas de usuário | Dados de autenticação |
| CPF/CNPJ completo | Dados pessoais sensíveis (LGPD) |
| Email completo de clientes | PII (pode logar primeiros caracteres mascarados) |
| Tokens de sessão / ID tokens Firebase | Credenciais de acesso |
| Números de cartão de crédito | PCI-DSS |

### Código Legado com console.log

Controllers mais antigos usam `console.log/error` diretamente — o GCP ainda captura esses logs, mas sem `severity` estruturado. **Em código novo**, sempre usar `logger`. Não é necessário migrar código existente que funciona, mas ao editar um controller existente, converter os `console.*` para `logger.*` na mesma sessão de edição.

---

## security-observability.ts — Audit Trail e Métricas

### Visão Geral

Módulo de observabilidade de segurança com três responsabilidades:
1. **Log estruturado** de eventos de segurança (via `console.*` com prefixo `[SECURITY]`)
2. **Contadores por janela horária** no Firestore (`security_metrics`)
3. **Audit trail** de eventos individuais no Firestore (`security_audit_events`)

### Habilitação

Controlado por `SECURITY_OBSERVABILITY_ENABLED` (padrão: `true`). Setar para `"false"` desabilita todas as escritas no Firestore e todos os logs — útil apenas para testes unitários.

### Coleções Firestore

| Coleção | Env var customizável | Conteúdo |
|---------|---------------------|----------|
| `security_metrics` | `SECURITY_METRICS_COLLECTION` | Contadores por janela de 1 hora |
| `security_metrics_tenants` | - (derivado) | Contadores por janela + por tenant |
| `security_audit_events` | `SECURITY_AUDIT_COLLECTION` | Eventos individuais com contexto |

### Contadores Disponíveis (`SecurityCounterName`)

| Contador | Quando é Incrementado |
|----------|----------------------|
| `AUTH_COMPAT` | Token válido mas claims incompletas (stale claims) |
| `AUTH_CLAIMS_MISSING_ROLE` | Token sem claim de `role` |
| `AUTH_CLAIMS_MISSING_TENANT` | Token sem claim de `tenantId` |
| `FORBIDDEN_TENANT_MISMATCH` | Tenant do token difere do esperado |
| `webhook_failed` | Webhook recebido com assinatura inválida |
| `cors_denied` | Origem bloqueada pela política de CORS |
| `ratelimit_triggered` | Rate limit excedido em qualquer limiter |
| `plan_limit_blocked` | Operação bloqueada por limite do plano |
| `plan_limit_would_block` | Operação próxima do limite do plano |
| `plan_source_compat_default` | Plano resolvido por compatibilidade (sem fonte definida) |

### Estrutura de Contadores (`security_metrics`)

Documento ID: `YYYYMMDDHHH` (ex: `2025040112` = 1 de abril de 2025, hora 12)

```typescript
{
  windowId: "2025040112",
  windowStart: "2025-04-01T12:00:00.000Z",
  updatedAt: "2025-04-01T12:34:56.000Z",
  counters: {
    cors_denied: 3,
    ratelimit_triggered: 15,
    AUTH_COMPAT: 2,
  }
}
```

Documentos de tenant ficam em `security_metrics_tenants` com ID `{windowId}_{sanitizedTenantId}`.

### Estrutura de Audit Events (`security_audit_events`)

Cada evento é um documento com ID auto-gerado:

```typescript
{
  eventType: "cors_denied",
  requestId: "uuid-...",
  route: "/v1/proposals",
  status: 403,
  tenantId: "abc123",
  uid: "user456",
  reason: "origin_not_allowed",
  source: "cors",
  createdAt: "2025-04-01T12:34:56.000Z",
  // outros campos podem ser null
}
```

### API das Funções

#### `buildSecurityLogContext(req, overrides?)`

Constrói o contexto de segurança a partir da request. Extrai `uid`, `tenantId` de `req.user`, `requestId` de `req.requestId` ou header `x-request-id` (gera UUID se nenhum). Overrides têm prioridade sobre os valores extraídos.

```typescript
const context = buildSecurityLogContext(req, {
  route: "/v1/wallets",
  status: 403,
  reason: "tenant_mismatch",
  source: "wallets_controller",
});
```

#### `logSecurityEvent(event, context, level?)`

Emite log estruturado com prefixo `[SECURITY]`. Nível padrão: `"INFO"`.

```typescript
logSecurityEvent("rate_limit_exceeded", context, "WARN");
```

#### `incrementSecurityCounter(counter, context?)`

Incrementa contador na janela horária atual. Usa `FieldValue.increment(1)` — operação atômica, segura para concorrência. Falhas na escrita são logadas como `WARN` mas não propagam erro (fire-and-forget intencionalmente).

```typescript
// Sempre usar void — não await (fire-and-forget)
void incrementSecurityCounter("cors_denied", context);
```

#### `writeSecurityAuditEvent(params)`

Grava evento individual na coleção de audit. Também fire-and-forget:

```typescript
void writeSecurityAuditEvent({
  eventType: "cors_denied",
  requestId: context.requestId,
  route: context.route,
  status: 403,
  tenantId: context.tenantId,
  uid: context.uid,
  reason: context.reason,
  source: context.source,
});
```

#### `attachRequestId(req, res)`

Lê ou gera um `requestId` para a request (a partir do header `x-request-id` ou `randomUUID()`), persiste em `req.requestId` e define o header `x-request-id` na resposta.

Deve ser chamado como **primeiro middleware** no pipeline do Express (já configurado no `api/index.ts`).

### Padrão de Uso em Controllers

```typescript
import {
  buildSecurityLogContext,
  incrementSecurityCounter,
  logSecurityEvent,
  writeSecurityAuditEvent,
} from "../../lib/security-observability";

// Em caso de violação de segurança:
const context = buildSecurityLogContext(req, {
  route: req.path,
  status: 403,
  reason: "unauthorized_cross_tenant_access",
  source: "proposals_controller",
});
logSecurityEvent("forbidden_access", context, "WARN");
void incrementSecurityCounter("FORBIDDEN_TENANT_MISMATCH", context);
void writeSecurityAuditEvent({ eventType: "forbidden_access", ...context });
```

---

## request-auth.ts — Helpers de AuthContext

### Visão Geral

Funções utilitárias para acessar e validar claims do `req.user` (AuthContext) em controllers. Encapsulam o acesso direto a `req.user` e lançam erros padronizados.

### Funções Disponíveis

| Função | Retorno | Lança erro? | Uso |
|--------|---------|-------------|-----|
| `getRoleClaim(req)` | `string` | Nunca | Lê role (string vazia se ausente) |
| `getTenantClaim(req)` | `string` | Nunca | Lê tenantId (string vazia se ausente) |
| `isSuperAdminClaim(req)` | `boolean` | Nunca | Verifica `isSuperAdmin === true` |
| `isTenantAdminClaim(req)` | `boolean` | Nunca | Verifica se role é admin do tenant |
| `assertSuperAdminClaim(req)` | `void` | `FORBIDDEN_SUPERADMIN_REQUIRED` | Guards em rotas de super-admin |
| `assertTenantAdminClaim(req)` | `void` | `FORBIDDEN_TENANT_ADMIN_REQUIRED` | Guards em rotas de admin do tenant |
| `assertTenantClaim(req)` | `string` | `UNAUTHENTICATED` ou erros de claims | Obtém tenantId garantido (privilegiado) |
| `requirePrivilegedContext(req)` | `AuthContext` | `UNAUTHENTICATED` ou erros de claims | AuthContext completo validado |

### Padrão de Uso em Controllers

```typescript
import { assertTenantClaim, isSuperAdminClaim } from "../../lib/request-auth";

export async function deleteWallet(req: Request, res: Response) {
  try {
    const tenantId = assertTenantClaim(req); // lança se não autenticado
    const isSuperAdmin = isSuperAdminClaim(req);
    // ...
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FORBIDDEN_")) {
      return res.status(403).json({ message: "Acesso negado." });
    }
    // ...
  }
}
```

---

## secret-rotation-guard.ts — Guard de Secrets Comprometidos

### Visão Geral

Detecta se variáveis de ambiente contêm secrets que já foram comprometidos (expostos, rotacionados por emergência etc.). Executado uma única vez no boot da função, via `runSecretRotationGuard({ source: "api" })` no início do `api/index.ts`.

### Como Funciona

1. Itera sobre secrets monitorados (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`)
2. Calcula SHA-256 do valor atual de cada variável
3. Compara com lista de fingerprints comprometidos conhecidos
4. Se encontrar match: emite `console.error` com mensagem de alerta OU lança erro (bloqueando o boot)

### Comportamento de Bloqueio

Controlado por `SECURITY_BLOCK_COMPROMISED_SECRETS`:
- `"true"` → lança `Error` impedindo o boot da função (quebra o deploy)
- qualquer outro valor (incluindo padrão `"false"`) → apenas `console.error` (alerta sem bloqueio)

### Idempotência

A flag `hasRun` garante que a verificação roda apenas **uma vez** por instância, mesmo que o módulo seja importado múltiplas vezes.

### Quando Adicionar Fingerprints

Ao detectar que um secret foi comprometido/vazado:
1. Calcular `sha256(valor_comprometido)` em hexadecimal
2. Adicionar ao `Set` correspondente em `COMPROMISED_FINGERPRINTS`
3. Fazer deploy imediatamente — o guard vai alertar qualquer instância que ainda use o valor comprometido

---

## lib/rate-limit/ — Sistema de Rate Limiting

### Arquitetura

Sistema plugável com interface comum (`RateLimitStore`) e duas implementações:

```
factory.ts          → Cria singleton do store correto
  ├── memory-store.ts → MemoryRateLimitStore (padrão)
  └── redis-store.ts  → RedisRestRateLimitStore (opcional)
types.ts            → Interfaces compartilhadas
```

### Interface `RateLimitStore`

```typescript
interface RateLimitStore {
  kind: "memory" | "redis";
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}

interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  current: number;
  retryAfterSeconds: number;
  windowMs: number;
}
```

`consume()` é uma operação atômica: incrementa o contador da chave e retorna a decisão em uma única chamada.

### MemoryRateLimitStore (padrão)

- **Janela fixa** por chave: ao criar a primeira entrada ou ao expirar a janela, reseta o contador
- **Capacidade máxima:** 25.000 chaves (configurável no constructor). Acima disso, `prune()` remove entradas com janelas expiradas há mais de `2 * windowMs`
- **Limitação:** por instância Cloud Run (não distribuído). Adequado para o volume atual

### RedisRestRateLimitStore (opcional)

- Usa **Upstash Redis REST API** (HTTP, sem conexão TCP persistente — compatível com Cloud Functions)
- Algoritmo: `INCR key` → `PEXPIRE key windowMs` (apenas no primeiro incremento) → `PTTL key`
- Completamente distribuído — enforcement global entre todas as instâncias

### Configuração via Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RATE_LIMIT_STORE` | `"memory"` | `"memory"` ou `"redis"` |
| `RATE_LIMIT_REDIS_REST_URL` | - | URL REST do Upstash Redis |
| `RATE_LIMIT_REDIS_REST_TOKEN` | - | Token de autenticação Upstash |
| `UPSTASH_REDIS_REST_URL` | - | Alias alternativo para a URL |
| `UPSTASH_REDIS_REST_TOKEN` | - | Alias alternativo para o token |
| `RATE_LIMIT_PROTECTED_MAX` | `240` | Máximo de requisições na janela protegida |
| `RATE_LIMIT_PROTECTED_WINDOW_MS` | `60000` | Janela em ms para rotas protegidas |
| `RATE_LIMIT_PRIVILEGED_MAX` | `120` | Máximo de requisições para rotas privilegiadas |
| `RATE_LIMIT_PRIVILEGED_WINDOW_MS` | `60000` | Janela em ms para rotas privilegiadas |

### Fallback Automático

Se `RATE_LIMIT_STORE=redis` mas as variáveis Redis não estão configuradas ou a inicialização falha, o factory cai automaticamente para `MemoryRateLimitStore` e loga um `WARN` com o evento `ratelimit_store_fallback_memory`.

### Limiters Configurados no `api/index.ts`

| Limiter | Prefixo | Máximo | Janela | Chave | Aplicado em |
|---------|---------|--------|--------|-------|-------------|
| `publicGeneralLimiter` | `public-general` | 300 | 60s | IP | `/health`, `/v1/aux/proxy-image`, `/v1/stripe` (planos), `/v1/validation` |
| `publicShareLimiter` | `public-share` | 80 | 60s | IP | Links compartilhados (`/v1/share/*`) |
| `publicWebhookLimiter` | `public-webhook` | 180 | 60s | IP | `/webhooks/whatsapp` |
| `protectedLimiter` | `protected` | 240* | 60s* | IP:uid:tenantId | Todas as rotas autenticadas |
| `privilegedLimiter` | `privileged` | 120* | 60s* | IP:uid:tenantId | `/v1/admin/*`, `/v1/stripe/*` |

*Configurável via env vars `RATE_LIMIT_PROTECTED_MAX`, `RATE_LIMIT_PROTECTED_WINDOW_MS`, etc.

### Comportamento em Falha do Store

Se `consume()` lança uma exceção (ex: Redis indisponível), a requisição é **permitida** (fail-open) com log `WARN` do evento `ratelimit_store_error_allowing_request`. Isso prioriza disponibilidade sobre enforcement estrito em cenários de falha de infraestrutura.

### Timeout de Rotas Protegidas

Além do rate limiting, rotas protegidas têm timeout automático configurado no `api/index.ts`:

| Rota | Timeout |
|------|---------|
| `proposals/:id/pdf` | 120s (padrão) ou `PROTECTED_PDF_ROUTE_TIMEOUT_MS` |
| Todas as outras protegidas | 20s (padrão) ou `PROTECTED_ROUTE_TIMEOUT_MS` |

Em timeout, retorna HTTP 408 com log do evento `request_timeout`.
