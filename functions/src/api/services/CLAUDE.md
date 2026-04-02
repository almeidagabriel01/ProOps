# CLAUDE.md — Services: PDF e Notifications

## Arquivos desta pasta

| Arquivo | Responsabilidade |
|---------|-----------------|
| `core-pdf.service.ts` | Renderizacao PDF via Playwright — base para todos os PDFs |
| `proposal-pdf.service.ts` | PDF de proposta: cache, lock, storage, versionamento |
| `transaction-pdf.service.ts` | PDF de recibo de lancamento financeiro |
| `notification.service.ts` | CRUD de notificacoes no Firestore |
| `shared-proposal.service.ts` | Criacao e resolucao de share links de propostas |
| `shared-transactions.service.ts` | Criacao e resolucao de share links de lancamentos |
| `transaction.service.ts` | Logica de negocio de lancamentos financeiros (~1350 linhas) |
| `pdf-filename.ts` | Helpers para construcao de nomes e Content-Disposition de PDF |
| `whatsapp/` | Servicos do bot WhatsApp (ver `whatsapp.CLAUDE.md`) |

---

## PDF — Arquitetura geral

### Por que Playwright?

PDFs sao gerados renderizando a pagina Next.js com Playwright/Chromium headless no servidor. Isso garante que o PDF seja identico ao que o usuario ve no browser, incluindo fontes customizadas, logos, temas de cor e layout responsivo.

### Bibliotecas

| Pacote | Papel |
|--------|-------|
| `playwright-core` | API do Playwright |
| `@sparticuz/chromium` | Binario Chromium otimizado para Lambda/Cloud Run |

### Fluxo geral

```
Request
  └─ Controller (autenticado ou publico com token)
  └─ pdfRateLimiter middleware (5 PDFs/min por usuario/IP)
  └─ getOrGenerateProposalPdf / generateAuthenticatedTransactionPdf
      └─ Verifica cache no Firebase Storage (hash de versao)
      └─ Se cache valido: retorna buffer do Storage
      └─ Adquire lock atomico no Firestore (evita geracao duplicada)
      └─ renderPageToPdfBuffer (core-pdf.service.ts)
          └─ Playwright lanca Chromium headless
          └─ Navega para URL do shared link (proposal) ou pagina autenticada
          └─ Aguarda seletor CSS de "pronto" + fonts + imagens
          └─ page.emulateMedia({ media: "print" })
          └─ page.pdf() → Buffer
      └─ Salva no Firebase Storage
      └─ Atualiza metadados de cache no documento Firestore
      └─ Libera lock
  └─ Retorna Buffer com headers Content-Type: application/pdf
```

---

## `core-pdf.service.ts` — Renderizacao base

### `renderPageToPdfBuffer(options: RenderPdfOptions): Promise<Buffer>`

Unica funcao exportada para uso pelos servicos especificos.

```typescript
interface RenderPdfOptions {
  url: string;           // URL completa com ?print=1 (ou equivalente)
  readySelector: string; // CSS selector que marca "pagina pronta"
  appOrigin: string;     // Usado em logs
  vercelBypassSecret?: string; // Para bypassar Vercel Preview Protection
}
```

### Inicializacao do browser

```typescript
chromiumPackage.setGraphicsMode = false;
const executablePath = await chromiumPackage.executablePath();
await chromium.launch({ executablePath, args: chromiumPackage.args, headless: true });
```

### Headers extras injetados na pagina

```
x-pdf-generator: "true"              // Identifica requisicao interna
x-vercel-protection-bypass: <secret> // Se configurado (preview deploys)
```

### Sequencia de "readiness"

1. `page.goto(url, { waitUntil: "networkidle", timeout: 45s })`
2. `page.waitForFunction` que:
   - Espera `document.fonts.ready`
   - Verifica que `document.querySelector(readySelector)` existe
   - Aguarda todas as `<img>` carregarem (load ou error)
   - Timeout: 20 segundos
3. `setTimeout(1000)` — pausa extra para animacoes CSS
4. `page.emulateMedia({ media: "print" })` — ativa media queries de impressao
5. `page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true })`

### Protecao contra SSRF

O Playwright bloqueia requisicoes para IPs/hostnames internos antes de qualquer navegacao:

| Categoria | Bloqueado |
|-----------|-----------|
| Loopback | `localhost`, `127.x`, `::1` |
| RFC-1918 | `10.x`, `172.16-31.x`, `192.168.x` |
| Link-local / IMDSv1 | `169.254.x.x`, `fe80:` |
| IPv6 unique-local | `fc00::/7` |
| Cloud metadata hostnames | `metadata.google.internal` |

URLs HTTPS para dominios publicos (incluindo o proprio app) sao permitidas — necessario para a pagina buscar seus dados.

### Constantes

```typescript
PDF_VIEWPORT_WIDTH = 1280
PDF_VIEWPORT_HEIGHT = 1700
PDF_PAGE_READY_TIMEOUT_MS = 45_000   // timeout de navegacao
PDF_RENDER_ASSET_TIMEOUT_MS = 20_000  // timeout do seletor de readiness
```

---

## `proposal-pdf.service.ts` — PDF de proposta

### Versioning e cache

**`PDF_TEMPLATE_VERSION = "proposal-pdf-v5-playwright"`**

Ao mudar o template HTML/CSS de proposta, incrementar esta string para invalidar todos os caches em producao.

O hash de versao (`versionHash`) e calculado com SHA-256 sobre:

```
{
  templateVersion: "proposal-pdf-v5-playwright",
  proposalId: string,
  proposal: { ...proposalData sem campos pdf/lock/timestamps },
  tenant: { name, primaryColor, logoUrl, niche, proposalDefaults }
}
```

Timestamps (`createdAt`, `updatedAt`) e metadados de PDF sao excluidos do hash para evitar ciclos de re-geracao.

### Storage path

```
tenants/{tenantId}/proposals/{proposalId}/pdf/proposal.pdf
```

### Lock atomico de geracao

`acquirePdfGenerationLock(proposalRef, lockOwner)` usa Firestore Transaction:

1. Le o documento da proposta dentro da transacao
2. Verifica se ha lock ativo (nao expirado) de outro worker
3. Lock expira apos `PDF_GENERATION_LOCK_TIMEOUT_MS = 2 minutos`
4. Se livre: seta `pdfGenerationLock.lockedAt` e `lockedBy` — retorna `true`
5. Se ocupado: retorna `false`

Se `acquirePdfGenerationLock` retorna `false`, o servico espera o outro worker terminar (`waitForPdfGeneratedByAnotherWorker`):
- 6 tentativas com intervalo de 1.5s
- Se o outro worker terminar e o cache ficar disponivel: retorna o buffer
- Se expirar: lanca `PDF_GENERATION_IN_PROGRESS` (HTTP 409)

### Geracao via shared link

A pagina renderizada para o PDF e o **shared link publico** da proposta (nao a pagina autenticada). Isso e intencional: o Playwright nao tem token de usuario.

Um link interno com `purpose: "system_pdf_render"` e criado via `SharedProposalService.createInternalRenderLink`. Este tipo de link e bloqueado no endpoint publico de download de PDF compartilhado (`downloadSharedProposalPdf` recusa links com `purpose === "system_pdf_render"`).

URL: `{shareUrl}?print=1`
Ready selector: `[data-pdf-products-ready="1"]` (atributo setado pelo componente de proposta quando todos os dados estao renderizados)

### `getOrGenerateProposalPdf(tenantId, proposalId, isSuperAdmin)`

- `isSuperAdmin = true`: ignora validacao de `tenantId` (admin global pode baixar qualquer proposta)
- Lanca `PROPOSAL_NOT_FOUND`, `FORBIDDEN_TENANT_MISMATCH`, `PDF_GENERATION_IN_PROGRESS`
- Retorna `{ buffer: Buffer, proposalTitle: string }`

---

## `transaction-pdf.service.ts` — PDF de recibo

**`PDF_TEMPLATE_VERSION = "receipt-pdf-v2-playwright"`**

Mesma arquitetura de cache/lock da proposta, mas mais simples:
- Sem lock (recibos tem menos concorrencia)
- Storage path: `tenants/{tenantId}/transactions/{transactionId}/pdf/receipt.pdf`
- Hash inclui dados da transacao + tenant (name, logoUrl, primaryColor)

### `generateAuthenticatedTransactionPdf(tenantId, transactionId)`

Para o endpoint privado (requer Bearer token). Valida que `transaction.tenantId === tenantId`.

### `generateSharedTransactionPdf(token)`

Para o endpoint publico (share token). Valida o shared link via `SharedTransactionService`.

---

## PDF — Controllers e endpoints

### PDF autenticado (requer Bearer token)

| Rota | Controller | Uso |
|------|-----------|-----|
| `GET /v1/proposals/:id/pdf` | `proposal-pdf.controller.ts` | Download PDF de proposta pelo dono |
| `GET /v1/transactions/:id/pdf` | `transaction-pdf.controller.ts` | Download recibo de lancamento pelo dono |

Ambos passam pelo middleware `pdfRateLimiter`.

### PDF publico (share token como auth)

| Rota | Controller | Uso |
|------|-----------|-----|
| `GET /v1/share/:token/pdf` | `shared-proposal-pdf.controller.ts` | PDF de proposta compartilhada |
| `GET /v1/share/transaction/:token/pdf` | `shared-transaction-pdf.controller.ts` | Recibo de lancamento compartilhado |

Nesses endpoints o token **e** a autenticacao — nao requerem Bearer token.

---

## PDF Rate Limiter (`pdf-rate-limiter.ts`)

Middleware in-memory (por instancia do Cloud Function):

```
Janela: 60 segundos (deslizante)
Limite: 5 requisicoes por janela por usuario (uid) ou IP
```

- Usuarios autenticados: chave = `uid:<firebaseUid>`
- Endpoints publicos (sem uid): chave = `ip:<x-forwarded-for ou req.ip>`
- HTTP 429 com header `Retry-After: <segundos>` e corpo `{ code: "PDF_RATE_LIMIT_EXCEEDED" }`

**Atencao:** Em ambientes com multiplas instancias Cloud Run, o rate limit e por instancia. Para enforcement global use Firebase App Check ou Cloud Armor.

Limpeza automatica do mapa a cada 60s via `setInterval(...).unref()`.

---

## Notifications (`notification.service.ts`)

### Colecao `notifications`

```typescript
interface Notification {
  id: string
  tenantId: string
  userId?: string            // se undefined: visivel para todo o tenant
  type: NotificationType
  title: string
  message: string
  proposalId?: string        // referencia opcional
  sharedProposalId?: string
  transactionId?: string
  isRead: boolean
  createdAt: string          // ISO string
  readAt?: string
}
```

### Tipos de notificacao

| Tipo | Origem |
|------|--------|
| `proposal_viewed` | Quando cliente visualiza proposta compartilhada |
| `proposal_approved` | Quando proposta e aprovada |
| `transaction_due_reminder` | Cron `checkDueDates` — lancamento vencendo em 3 dias |
| `proposal_expiring` | Cron `checkDueDates` — proposta vencendo em 3 dias |
| `system` | Cron `checkStripeSubscriptions` — notificacoes de sistema para superadmins |
| `transaction_viewed` | Quando lancamento compartilhado e visualizado |

### Metodos publicos

| Metodo | Descricao |
|--------|-----------|
| `createNotification(data)` | Cria nova notificacao |
| `getNotifications(scope, { limit, offset, unreadOnly })` | Lista com paginacao |
| `markAsRead(notificationId, scope)` | Marca como lida |
| `markAllAsRead(scope)` | Batch: marca todas como lidas |
| `deleteNotification(notificationId, scope)` | Remove uma notificacao |
| `clearAllNotifications(scope)` | Remove todas em batches de 400 |
| `getUnreadCount(scope)` | Conta nao lidas |
| `findActiveReminders(tenantId, type, resourceId, resourceField)` | Busca lembretes ativos |
| `claimDailyDueToast(tenantId, type, userId)` | Claim idempotente para toast diario |

### NotificationScope

Toda operacao recebe um `scope` resolvido por `resolveNotificationScopeFromRequest`. O scope garante que usuarios so vejam notificacoes do proprio tenant (ou `tenantId: "system"` para superadmins).

### Due Toast Claim (`notification_due_toast_claims`)

Mecanismo para garantir que o toast de "tem lancamentos vencendo" aparece no maximo uma vez por dia por tenant por tipo:

- Documento: `notification_due_toast_claims/{tenantId}_{type}_{YYYY-MM-DD}`
- `claimRef.create(...)` e atomico — lanca erro `already-exists` se ja foi reclamado hoje
- O controller retorna `{ shouldShow: boolean }`

---

## Endpoints de notificacoes

Todos requerem autenticacao. Montados em `/v1/notifications`.

| Metodo | Caminho | Descricao |
|--------|---------|-----------|
| `GET` | `/` | Lista notificacoes (`limit`, `offset`, `unreadOnly`) |
| `GET` | `/unread-count` | Contador de nao lidas |
| `POST` | `/due-toast/claim` | Claim diario de toast (`type` no body) |
| `DELETE` | `/clear-all` | Remove todas |
| `PUT` | `/:id/read` | Marca como lida |
| `DELETE` | `/:id` | Remove uma |
| `PUT` | `/mark-all-read` | Marca todas como lidas |

---

## Indice Firestore necessario para notificacoes

A query de listagem usa `where("tenantId", "==", ...)` + `orderBy("createdAt", "desc")` — requer indice composto:

```json
{
  "collectionGroup": "notifications",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Com filtro `isRead == false`:
```json
{
  "collectionGroup": "notifications",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "isRead", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Verificar `firestore.indexes.json` — indices precisam ser criados no console antes de usar em producao.

---

## Pontos de atencao ao modificar PDFs

- Ao mudar template de proposta: incrementar `PDF_TEMPLATE_VERSION` em `proposal-pdf.service.ts`
- Ao mudar template de recibo: incrementar `PDF_TEMPLATE_VERSION` em `transaction-pdf.service.ts`
- O ready selector `[data-pdf-products-ready="1"]` deve estar no componente React correspondente
- PDFs sao cacheados no Firebase Storage — invalidacao so acontece quando o hash muda
- Playwright instancia um browser por request — alto custo de CPU. O rate limiter e essencial
- `VERCEL_PROTECTION_BYPASS_SECRET` deve estar configurado para funcionar em preview deploys
