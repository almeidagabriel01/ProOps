# CLAUDE.md — functions/src/api/middleware/

Documentação da infraestrutura de middleware do Express monolith.

## Arquivos

Um arquivo por middleware; liste a pasta. Os documentados aqui são `auth.ts` (autenticação Firebase ID Token), `impersonation.ts` ("Acessar Painel" do superadmin: tenant da empresa vista + modo somente leitura) e `pdf-rate-limiter.ts` (rate limiting específico para geração de PDF).

> A **última vez online** da empresa (`tenant_presence/{tenantId}.lastSeenAt`) NÃO é gravada
> aqui: ela vem de `POST /v1/session/ping`, que o frontend chama quando a
> plataforma abre autenticada (ver `lib/tenant-last-seen.ts` e
> `session.controller.ts`). Era um heartbeat neste middleware, e saiu do caminho
> de toda request quando virou evento.

---

## auth.ts — Middleware de Autenticação

### Visão Geral

`validateFirebaseIdToken` é o middleware central de autenticação. Ele é registrado globalmente no Express **após** todas as rotas públicas, garantindo que todo o tráfego subsequente seja autenticado.

```typescript
// Posição no pipeline do Express (api/index.ts):
app.use(publicRoutes...);        // rotas públicas primeiro
app.use(validateFirebaseIdToken); // barreira de autenticação
app.use(resolveImpersonation);    // superadmin no "Acessar Painel"
app.use(requireActiveSubscription); // free vs pagante
app.use(protectedLimiter);        // rate limiter protegido
app.use(protectedRoutes...);      // rotas protegidas; requirePlanCapability montado por prefixo nos routers
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
- `POST /webhooks/whatsapp`
- `GET|POST /v1/stripe` (planos, publicStripeRoutes)
- `POST /v1/validation/contact`
- `GET /v1/calendar/google/callback`
- `GET /v1/share/*` (shared proposals / transactions)

### Fluxo de Verificação

```
Request → OPTIONS? → next()
       → /share/*? → next()
       → shouldRequireStrictClaimsInMiddleware()
       → resolveAuthContextFromRequest()
           ├── Verifica token Firebase ID com Admin SDK
           ├── Extrai custom claims (tenantId, role, masterId); isSuperAdmin é derivado de role
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

`isSuperAdmin` não é claim: `AuthContext` o deriva de `role === "SUPERADMIN"` (`evaluateAuthContextInvariants` em `lib/auth-context.ts`). Dá acesso cross-tenant para admins internos.

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

### Idempotente na mesma request

Fiscal, Asaas, notificações e a função `pdf` repetem `validateFirebaseIdToken`
por rota. Com `req.user` já preenchido ele só segue: refazer o usuário desfazia
a troca do "Acessar Painel" (`resolveImpersonation`), e essas telas agiam no
tenant do superadmin (a de Notas Fiscais mostrava erro no toast). A função
`pdf` também monta `resolveImpersonation` logo depois da autenticação. Guards:
`__tests__/auth.idempotent.test.ts` e `pdfApp.test.ts`.

### Regras ao Modificar

- Nunca mover a posição de `app.use(validateFirebaseIdToken)` para antes das rotas públicas sem garantir que as rotas públicas estejam explicitamente no bypass ou registradas antes
- Se adicionar nova rota pública que passe pelo middleware (ex: nova rota `/v1/public/*`), adicionar o path no bypass dentro do middleware OU registrar a rota antes de `validateFirebaseIdToken` no `api/index.ts`
- O tipo `AuthContext` é definido em `../../lib/auth-context` — modificações lá afetam todo o pipeline de autenticação

---

## impersonation.ts — "Acessar Painel" do superadmin

`resolveImpersonation` roda logo depois de `validateFirebaseIdToken`. Para
superadmin com `x-tenant-id` diferente do próprio tenant:

- confere que a empresa existe (`assertTenantExists`, 400
  `IMPERSONATION_TENANT_NOT_FOUND` se não);
- troca `req.user.tenantId` pela empresa vista e `req.user.masterId` pelo dono
  dela (cache de 60s), e grava `req.user.impersonation`;
- método de escrita sem `x-impersonation-write: 1` leva 403
  `IMPERSONATION_READ_ONLY`; com ele, grava `super_admin_tenant_write` (com
  `await`) antes de seguir. Ficam fora do bloqueio `/v1/admin`, `/v1/auth`,
  `/v1/profile`, `/v1/notifications` e `/v1/ai` (a Lia barra as ferramentas de
  escrita no executor).

Para qualquer outro usuário os cabeçalhos são descartados.

**"Ver como membro"** (`x-view-as-member: <uid>`, junto do `x-tenant-id`): a
request passa a valer como aquele membro. O middleware confere que ele é da
empresa vista e não é superadmin (400 `MEMBER_VIEW_NOT_FOUND`, cache de 60s) e
troca `uid`, `role`, `isSuperAdmin` (false), `masterId` e `userDoc` pelos do
membro; `impersonation` guarda `memberUid` e `actorUid` (o superadmin). Por
isso `checkPermission(req.user.uid)`, `hasPagePermission`, tarefas, OS, metas
e "Minhas comissões" respondem o que o membro vê sem nenhum controller saber.

- **Nada grava** nesse modo, inclusive `/v1/notifications` e `/v1/ai`, e o
  `x-impersonation-write` é ignorado: 403 `MEMBER_VIEW_READ_ONLY`. O que fosse
  gravado ficaria em nome do membro.
- `/v1/admin`, `/v1/auth` e `/v1/profile` **não** trocam a identidade: são o
  painel e a conta do superadmin (encerrar, trocar de membro).
- O rate limiter por uid conta na cota do membro. Só há leitura, então o
  efeito é pequeno, e é o preço de não espalhar a exceção pelos limitadores.

Consequências para quem escreve controller:

- `resolveUserAndTenant` reconhece `claims.impersonation`: não acusa
  `FORBIDDEN_TENANT_MISMATCH` e devolve o dono da empresa vista como `masterRef`.
  `checkFinancialPermission` (`lib/finance-helpers.ts`) tem a mesma exceção;
  até 2026-10 não tinha, e todo endpoint financeiro dava 403 ao superadmin no
  Acessar Painel. Helper novo que confira tenant contra o doc do usuário
  precisa dela também.
- O dono é o usuário mais antigo sem `masterId` **ou com `masterId` igual ao
  próprio id** (seeds e contas antigas gravam assim). A regra mora em
  `lib/tenant-owner.ts` e é a mesma da aba Acesso do painel
  (`getAllTenantsBilling`) e do Perfil no front.
- `requirePlanCapability` avalia o plano da empresa vista (em `enforce`), sem o
  bypass de superadmin: o superadmin vê o que o cliente vê.
- **Pegue o tenant de `req.user.tenantId`.** Ler `x-tenant-id` ou `targetTenantId`
  por conta própria é o padrão antigo que deixava metade dos módulos gravando no
  tenant do superadmin.

Guard: `__tests__/impersonation.test.ts`.

---

## pdf-rate-limiter.ts — Rate Limiter de PDF

### Contexto

Cada requisição de PDF abre um browser Chromium headless. Sem rate limiting, um usuário autenticado poderia exaurir CPU/memória da instância Cloud Run. O limiter é específico para endpoints de PDF e roda sobre o **store plugável** de `lib/rate-limit` (`createRateLimiter` de `express-limiter.ts`): memória por instância por default, distribuído entre instâncias quando `RATE_LIMIT_STORE=redis` + credenciais Upstash estiverem configuradas (mesma env que os demais limiters). `emulatorBypass: false` — o limite vale também no emulador (E2E depende do 429).

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
// IP: resolveClientIp (lib/client-ip.ts). NUNCA o primeiro valor do
// x-forwarded-for, que é de quem chama: o Google acrescenta o IP real no FIM.
// Pelo proxy da Vercel vale o x-proops-client-ip, só com o segredo
// PROXY_CLIENT_IP_SECRET conferido.
```

### Comportamento em Rate Limit Excedido

Retorna HTTP 429 com:
- Header `Retry-After: N` (segundos até a janela liberar)
- Body: `{ code: "PDF_RATE_LIMIT_EXCEEDED", message: "...", retryAfter: N }`

O tempo de retry é calculado com base no timestamp mais antigo dentro da janela deslizante, não no início fixo da janela.

### Limitação Multi-Instância

Com o store default (memory), o limite é **por instância** do Cloud Run — suficiente para PDF sob demanda no volume atual. Para enforcement global entre instâncias, configurar `RATE_LIMIT_STORE=redis` + `UPSTASH_REDIS_REST_URL/TOKEN` (ver `docs/scalability-runbook.md`) — nenhuma mudança de código necessária.

### Onde é Usado

Aplicado nas rotas de geração de PDF dentro de `finance.routes.ts`, `core.routes.ts`, `shared-proposals.routes.ts`, `shared-transactions.routes.ts` e `pdfApp.ts`. Verificar os arquivos de rotas para localizar os pontos exatos de aplicação:

```typescript
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";
router.get("/proposals/:id/pdf", pdfRateLimiter, downloadProposalPdf);
```

### Regras ao Modificar

- Aumentar o limite pode degradar a disponibilidade da instância Cloud Run (CPU/RAM)
- Não usar este limiter para rotas não-PDF — usar o sistema de rate limiting geral em `lib/rate-limit/`
