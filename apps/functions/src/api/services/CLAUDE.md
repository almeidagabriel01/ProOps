# CLAUDE.md — Services: PDF e Notifications

## Arquivos desta pasta

| Arquivo | Responsabilidade |
|---------|-----------------|
| `core-pdf.service.ts` | Renderizacao PDF via Playwright — base para todos os PDFs |
| `proposal-pdf.service.ts` | PDF de proposta: cache, lock, storage, versionamento |
| `transaction-pdf.service.ts` | PDF de recibo de lancamento financeiro |
| `notification.service.ts` | Notificacoes por pessoa: destinatarios, leitura, limpeza e aviso por e-mail |
| `notification-audience.ts` | Quem recebe cada tipo (catalogo + permissoes + preferencias) |
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

### Onde roda

Os 4 endpoints de PDF sao atendidos pela **funcao Cloud dedicada `pdf`** (`src/pdfApp.ts`, config `PDF_OPTIONS`: 1GiB, `concurrency: 2` = max 2 Chromiums por instancia). O proxy Next.js roteia paths `*/pdf` para ela. As mesmas rotas seguem montadas no monolito `api` como fallback e para o fluxo interno WhatsApp→PDF (que chama `getOrGenerateProposalPdfBuffer` in-process). Lock (Firestore) e cache (Storage) sao compartilhados entre as duas funcoes.

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

**`PDF_TEMPLATE_VERSION = "proposal-pdf-v9-playwright"`**

Ao mudar o template HTML/CSS de proposta, incrementar esta string para invalidar todos os caches em producao.

O hash de versao (`versionHash`) e calculado com SHA-256 sobre:

```
{
  templateVersion: "proposal-pdf-v9-playwright",
  proposalId: string,
  proposal: { ...proposalData sem campos pdf/lock/timestamps },
  tenant: { name, primaryColor, logoUrl, niche, proposalDefaults }
}
```

O que fica de FORA do hash esta em `PDF_IRRELEVANT_PROPOSAL_FIELDS`, no proprio
arquivo: timestamps e metadados de PDF (para nao criar ciclo de re-geracao) e
tambem os campos que nao aparecem no documento — `status`, `commissions`,
`searchTokens`, `primarySystem`/`primaryEnvironment` e
`driveFileId`/`driveSyncError`. Estes dois ultimos sao escritos pela PROPRIA
entrega no Drive, entao mante-los no hash fazia o PDF recem-gerado invalidar o
proprio cache; `status` fazia toda mudanca de coluna do kanban reabrir o
Chromium. A mesma lista decide se vale reentregar no Drive. Guard:
`api/services/pdf-irrelevant-fields.test.ts`.

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
- Endpoints publicos (sem uid): chave = `ip:<resolveClientIp>` (`lib/client-ip.ts`: IP repassado pelo proxy com segredo, senão o ÚLTIMO valor do x-forwarded-for)
- HTTP 429 com header `Retry-After: <segundos>` e corpo `{ code: "PDF_RATE_LIMIT_EXCEEDED" }`

**Atencao:** Em ambientes com multiplas instancias Cloud Run, o rate limit e por instancia. Para enforcement global use Firebase App Check ou Cloud Armor.

Limpeza automatica do mapa a cada 60s via `setInterval(...).unref()`.

---

## Notifications (`notification.service.ts`)

### Por pessoa, desde a central de notificacoes (2026-09-26)

Ate a central, toda notificacao valia para a empresa inteira: um membro sem
acesso ao financeiro via "pagamento recebido", e a leitura de um marcava para
todos. Agora cada documento carrega **`recipientUids`** e **`readBy`**:

- **Quem recebe** sai de `shared/notification-catalog.ts` (`NOTIFICATION_CATALOG`):
  cada tipo declara o `pageId` que a pessoa precisa VER (`proposals`,
  `transactions`, `kanban`, `projects`), `admins` (so dono e administradores)
  ou `direct` (tarefa atribuida, mencao, lembrete de tarefa): ai quem recebe e
  so quem veio em `targetUids`, e so se for pessoa da empresa.
  `notification-audience.ts` cruza isso com as permissoes e as preferencias de
  cada pessoa (`resolveRecipients`, pura e testada), com cache de 60s por
  instancia (`loadTenantAudience`), limpo ao salvar preferencia ou permissao.
- **As rules leem `recipientUids`.** A consulta do sino e
  `tenantId == X` + `recipientUids array-contains uid` + `orderBy createdAt desc`
  (indice proprio). Documento sem `recipientUids` nao e lido por ninguem da
  empresa: por isso existe `scripts/backfill-notification-recipients.ts`.
- **Leitura e limpeza sao da pessoa.** Marcar como lida faz `arrayUnion` em
  `readBy`; limpar tira a pessoa de `recipientUids`, e o documento so e apagado
  com o ultimo destinatario.
- **O superadmin continua na visao da empresa** (`NotificationViewer.perRecipient
  = false`): escopo `system`, ou vendo uma empresa pelo painel. Ali valem
  `isRead` e a exclusao do documento, como antes.
- **Quem grava por conta propria** (crons com id fixo e `BulkWriter`) pede os
  campos a `NotificationService.recipientFields(tenantId, type)`. Lembrete
  regravado leva `readBy: []` e volta como nao lido para todos, como o
  `isRead: false` fazia.
- **Aviso por e-mail** (`sendNotificationEmails`, template
  `services/email/templates/notification.ts`): na hora, para quem ligou o tipo.
  Os lembretes diarios (vencimento, proposta expirando, CRM) nao saem por e-mail,
  porque repetem todo dia; o aviso de preco tambem nao, porque ja tem e-mail
  proprio. Nunca lanca, e e aguardado (Cloud Run). O link do e-mail e o mesmo do
  sino (`notificationLinkPath`).
- **Preferencias** em `users/{uid}.preferences.notifications`
  (`{ [tipo]: { inApp?, email? } }`), lidas e gravadas por
  `GET/PUT /v1/notifications/preferences`. O padrao mora no catalogo: sino ligado
  em tudo; e-mail ligado so em aceite do cliente, pedido de ajuste, pagamento
  online, entrega aceita e avisos do sistema.

**Tipo novo:** entra em `NOTIFICATION_CATALOG` (e na copia do front,
`apps/web/src/lib/notifications/catalog.ts`; o teste de paridade falha se
divergirem) e e criado por `createNotification` ou com `recipientFields`. Um
`db.collection("notifications").add(...)` direto nasce sem destinatario e
ninguem o ve.

### Colecao `notifications`

```typescript
interface Notification {
  id: string
  tenantId: string           // "system" = superadmins
  type: NotificationType     // catalogo em shared/notification-catalog.ts
  title: string
  message: string
  proposalId?, sharedProposalId?, transactionId?, leadId?, clientId?, projectId?
  recipientUids?: string[]   // quem ve (as rules leem este campo)
  readBy?: string[]          // quem ja leu
  isRead: boolean            // so a visao da empresa (superadmin) usa
  createdAt: string          // ISO string
  readAt?: string
}
```

### Tipos de notificacao

| Tipo | Origem | Quem recebe | E-mail (padrao) |
|------|--------|-------------|-----------------|
| `proposal_viewed` | Cliente abre a proposta compartilhada | ve propostas | pode, desligado |
| `proposal_accepted` | Cliente aceita pelo link (`proposal-online-approval.controller.ts`) | ve propostas | ligado |
| `proposal_changes_requested` | Cliente pede mudancas pelo link | ve propostas | ligado |
| `proposal_follow_up` | Cron `checkDueDates` (2b), uma vez por link | ve propostas | pode, desligado |
| `proposal_expiring` | Cron `checkDueDates`, diario | ve propostas | nao |
| `project_delivery_accepted` | Cliente aceita a entrega (`shared-projects.controller.ts`) | ve projetos | ligado |
| `lead_reminder` | Cron `checkDueDates` (2c), diario | ve o CRM (`kanban`) | nao |
| `transaction_due_reminder` | Cron `checkDueDates`, diario | ve lancamentos | nao |
| `transaction_viewed` | Lancamento compartilhado visualizado | ve lancamentos | pode, desligado |
| `transaction_paid_online` | Webhook do Asaas | ve lancamentos | ligado |
| `system` | Repasse do Asaas que falhou, certificado A1 vencendo; e os do superadmin (`tenantId: "system"`) | dono e admins | ligado |
| `price_change` | Cron `checkPriceChanges` | dono e admins | nao (tem e-mail proprio) |
| `task_assigned` | Tarefa passada para alguem (`tasks.controller.ts`); quem fez a acao nunca e avisado. O texto NAO leva o prazo: a notificacao e uma foto do momento e ficaria com a data velha na primeira edicao | so o responsavel (`targetUids`) | ligado |
| `booking_requested` | Cliente pediu visita pelo link de agendamento (`booking.service.ts`) | ve a Agenda (`calendar`) | ligado |
| `task_updated` | Outra pessoa mudou (ou tirou) o prazo de uma tarefa que ja tinha responsavel; com atribuicao nova na mesma edicao, vale so o `task_assigned` | so o responsavel | pode, desligado |
| `task_mentioned` | Alguem citado com @ numa tarefa; so quem foi citado AGORA, e nao o responsavel ja avisado | so os citados | ligado |
| `task_reminder` | Cron `checkDueDates` (2d), tarefa com prazo hoje, id `task_{id}_{dia}` | o responsavel, ou quem criou | nao |

### Metodos publicos

Todos os de leitura e escrita recebem `scope` e `viewer` (`{ uid, perRecipient }`).

| Metodo | Descricao |
|--------|-----------|
| `createNotification(data)` | Resolve destinatarios, grava e manda os e-mails |
| `recipientFields(tenantId, type)` | Destinatarios para quem grava por conta propria |
| `sendNotificationEmails(notification, recipients)` | Aviso por e-mail; nunca lanca |
| `getNotifications(scope, viewer, { limit, offset, unreadOnly })` | Lista; por pessoa, `unreadOnly` filtra depois da consulta |
| `markAsRead` / `markAllAsRead` | Por pessoa: `readBy`. Empresa: `isRead` |
| `deleteNotification` / `clearAllNotifications` | Por pessoa: sai de `recipientUids`. Empresa: apaga |
| `getUnreadCount(scope, viewer)` | Por pessoa: conta nas 50 mais recentes. Empresa: aggregation `count()` |
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
| `GET` | `/` | Lista notificacoes (`limit` ate 100, `offset`, `unreadOnly`) |
| `GET` | `/unread-count` | Contador de nao lidas |
| `GET` | `/preferences` | Preferencias da pessoa (so o que ela escolheu) |
| `PUT` | `/preferences` | Grava por cima so os tipos enviados; recusa tipo fora do catalogo |
| `POST` | `/due-toast/claim` | Claim diario de toast (`type` no body) |
| `DELETE` | `/clear-all` | Limpa a central da pessoa |
| `PUT` | `/:id/read` | Marca como lida |
| `DELETE` | `/:id` | Tira da central da pessoa |
| `PUT` | `/mark-all-read` | Marca todas como lidas |

`/preferences` e montado antes de `/:id`: o Express casa por ordem. Guards:
`notification-audience.test.ts`, `notification.per-recipient.test.ts`,
`notifications.preferences.test.ts` e `tests/firestore-rules/notifications.test.ts`.

---

## Indice Firestore necessario para notificacoes

- `tenantId` + `recipientUids` (array-contains) + `createdAt DESC`: o sino e a
  central de cada pessoa.
- `tenantId` + `createdAt DESC`: a visao da empresa (superadmin) e o tenant de
  demonstracao.
- `isRead` + `tenantId` + `createdAt DESC`: `unreadOnly` na visao da empresa.

Verificar `firestore.indexes.json` — indices precisam ser criados no console antes de usar em producao.

---

## Pontos de atencao ao modificar PDFs

- Ao mudar template de proposta: incrementar `PDF_TEMPLATE_VERSION` em `proposal-pdf.service.ts`
- Ao mudar template de recibo: incrementar `PDF_TEMPLATE_VERSION` em `transaction-pdf.service.ts`
- O ready selector `[data-pdf-products-ready="1"]` deve estar no componente React correspondente
- PDFs sao cacheados no Firebase Storage — invalidacao so acontece quando o hash muda
- Playwright instancia um browser por request — alto custo de CPU. O rate limiter e essencial
- `VERCEL_PROTECTION_BYPASS_SECRET` deve estar configurado para funcionar em preview deploys
