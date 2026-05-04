# CLAUDE.md — functions/src/api/middleware/

Documentação da infraestrutura de middleware do Express monolith.

## Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `auth.ts` | Middleware de autenticação Firebase ID Token |
| `pdf-rate-limiter.ts` | Rate limiting específico para geração de PDF |

---

## auth.ts — Middleware de Autenticação

### Visão Geral

`validateFirebaseIdToken` é o middleware central de autenticação. Ele é registrado globalmente no Express **após** todas as rotas públicas, garantindo que todo o tráfego subsequente seja autenticado.

```typescript
// Posição no pipeline do Express (api/index.ts):
app.use(publicRoutes...);        // rotas públicas primeiro
app.use(validateFirebaseIdToken); // barreira de autenticação
app.use(protectedLimiter);        // rate limiter protegido
app.use(protectedRoutes...);      // rotas protegidas
```

### Rotas que Bypassam Auth

O middleware retorna `next()` imediatamente (sem verificar token) nestas condições:

| Condição | Motivo |
|----------|--------|
| `req.method === "OPTIONS"` | Preflight CORS — o header `Authorization` ainda não está presente |
| `req.path.startsWith("/v1/share/")` | Links compartilhados são intencionalmente públicos |
| `req.path.startsWith("/share/")` | Compatibilidade com path legado de links públicos |

Rotas públicas adicionais são registradas **antes** do middleware no `api/index.ts`:
- `GET /health`
- `GET /v1/aux/proxy-image`
- `POST /webhooks/whatsapp`
- `GET|POST /v1/stripe` (planos, publicStripeRoutes)
- `POST /v1/validation/contact`
- `GET /v1/calendar/google/callback`
- `GET /v1/share/*` (shared proposals / transactions)

### Fluxo de Verificação

```
Request → OPTIONS? → next()
       → /share/*? → next()
       → shouldRequireStrictClaims()
       → resolveAuthContextFromRequest()
           ├── Verifica token Firebase ID com Admin SDK
           ├── Extrai custom claims (tenantId, role, masterId, isSuperAdmin)
           └── Stale claims fallback (ver abaixo)
       → req.user = authContext
       → hasRequiredClaims?
           ├── false → loga AUTH_COMPAT (WARN) + continua (não bloqueia)
           └── true  → next()
```

### Stale Claims Fallback

Quando `shouldRequireStrictClaimsInMiddleware()` retorna `false` (padrão), o sistema aceita tokens com claims potencialmente desatualizadas e faz fallback para o documento do usuário no Firestore para validar `tenantId` e `role` se os claims estiverem ausentes.

Isso permite que usuários recém-criados ou com claims recém-atualizadas continuem funcionando sem precisar fazer logout/login imediato.

O flag `hasRequiredClaims` em `AuthContext` indica se os claims estavam completos. Quando `false`, um evento `AUTH_COMPAT` é emitido para rastreamento de frequência de claims desatualizados.

### Custom Claims Verificados

| Claim | Tipo | Obrigatório | Uso |
|-------|------|-------------|-----|
| `tenantId` | `string` | Sim (para rotas protegidas) | Isolamento multi-tenant |
| `role` | `string` | Sim (para rotas protegidas) | Controle de acesso por função |
| `masterId` | `string` | Não | Identifica master de sub-usuários |
| `isSuperAdmin` | `boolean` | Não | Acesso cross-tenant para admins internos |

### req.user (AuthContext)

Após autenticação bem-sucedida, `req.user` contém:

```typescript
interface AuthContext {
  uid: string;
  tenantId: string;
  role: string;
  masterId?: string;
  isSuperAdmin?: boolean;
  hasRequiredClaims: boolean;
}
```

Acessar via `req.user?.tenantId` em controllers. **Nunca** confiar no `tenantId` do body da requisição — usar sempre `req.user.tenantId`.

### Eventos de Segurança Emitidos

| Situação | Evento | Nível |
|----------|--------|-------|
| Claims ausentes mas token válido | `AUTH_COMPAT` | WARN |
| Falha geral de autenticação | `auth_verification_failed` | WARN |
| Claim de role ausente | `AUTH_CLAIMS_MISSING_ROLE` | WARN + contador |
| Claim de tenant ausente | `AUTH_CLAIMS_MISSING_TENANT` | WARN + contador |
| Tenant do token diverge do esperado | `FORBIDDEN_TENANT_MISMATCH` | WARN + contador |

Os eventos com contador também geram audit events no Firestore (`security_audit_events`).

### Mapeamento de Erros para HTTP Status

| Código de Erro | HTTP Status |
|----------------|-------------|
| `UNAUTHENTICATED` | 401 |
| `AUTH_CLAIMS_MISSING_*` | 403 |
| `FORBIDDEN_*` | 403 |
| `auth/*` (Firebase Auth errors) | 401 |
| outros | 403 |

### Regras ao Modificar

- Nunca mover a posição de `app.use(validateFirebaseIdToken)` para antes das rotas públicas sem garantir que as rotas públicas estejam explicitamente no bypass ou registradas antes
- Se adicionar nova rota pública que passe pelo middleware (ex: nova rota `/v1/public/*`), adicionar o path no bypass dentro do middleware OU registrar a rota antes de `validateFirebaseIdToken` no `api/index.ts`
- O tipo `AuthContext` é definido em `../../lib/auth-context` — modificações lá afetam todo o pipeline de autenticação

---

## pdf-rate-limiter.ts — Rate Limiter de PDF

### Contexto

Cada requisição de PDF abre um browser Chromium headless. Sem rate limiting, um usuário autenticado poderia exaurir CPU/memória da instância Cloud Run. O limiter é específico para endpoints de PDF e opera em memória por instância.

### Parâmetros

| Parâmetro | Valor | Configurável? |
|-----------|-------|---------------|
| Janela temporal | 60 segundos | Não (hardcoded) |
| Máximo de requisições | 5 por janela | Não (hardcoded) |
| Escopo | Por uid (autenticado) ou por IP (público) | - |

### Derivação da Chave

```typescript
// Usuário autenticado → uid (mais preciso, não sofre IP spoofing)
key = "uid:${uid}"

// Endpoint público (token de link compartilhado) → IP do cliente
key = "ip:${ip}"
// IP extraído de: x-forwarded-for[0] → req.ip → req.socket.remoteAddress → "unknown"
```

### Comportamento em Rate Limit Excedido

Retorna HTTP 429 com:
- Header `Retry-After: N` (segundos até a janela liberar)
- Body: `{ code: "PDF_RATE_LIMIT_EXCEEDED", message: "...", retryAfter: N }`

O tempo de retry é calculado com base no timestamp mais antigo dentro da janela deslizante, não no início fixo da janela.

### Limpeza de Memória

Um `setInterval` limpa o mapa interno a cada 60 segundos, removendo entradas cujas janelas expiraram. `.unref()` é chamado no timer para não bloquear o processo durante shutdown da instância.

### Limitação Multi-Instância

**Importante:** Este limiter é **por instância** do Cloud Run. Com `concurrency: 80` e `maxInstances: 10`, múltiplas instâncias podem estar ativas simultaneamente. Para enforcement global, usar Cloud Armor ou Firebase App Check. Para uso típico (PDF sob demanda por usuário), a limitação por instância é suficientemente protetora.

### Onde é Usado

Aplicado nas rotas de geração de PDF dentro de `finance.routes.ts` e `core.routes.ts`. Verificar os arquivos de rotas para localizar os pontos exatos de aplicação:

```typescript
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";
router.get("/proposals/:id/pdf", pdfRateLimiter, generateProposalPdf);
```

### Regras ao Modificar

- Aumentar o limite pode degradar a disponibilidade da instância Cloud Run (CPU/RAM)
- Não usar este limiter para rotas não-PDF — usar o sistema de rate limiting geral em `lib/rate-limit/`
- Se trocar para rate limiting distribuído (Redis), migrar para `lib/rate-limit/factory.ts` em vez de editar este arquivo
