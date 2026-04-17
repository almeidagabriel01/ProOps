# 12-RESEARCH — Lia: Mapeamento do Codebase

> O que precisa ser entendido/lido antes de escrever qualquer código da Fase 2 em diante.
> Preencher com os achados reais do codebase durante a Fase 1.

---

## Arquivos obrigatórios para ler antes de codar

### Backend (functions/)

| Arquivo | Por quê ler |
|---|---|
| `functions/src/api/middleware/auth.middleware.ts` | Reutilizar `validateFirebaseToken()` sem copiar |
| `functions/src/api/middleware/rateLimit.middleware.ts` | Entender o padrão atual para criar o rate limit específico de AI |
| `functions/src/api/middleware/tenant.middleware.ts` | Padrão de extração e validação de `tenantId` |
| `functions/src/api/services/proposal.service.ts` | Assinatura dos métodos que a Lia vai chamar (list, create, update, delete) |
| `functions/src/api/services/contact.service.ts` | Idem |
| `functions/src/api/services/product.service.ts` | Idem |
| `functions/src/api/services/transaction.service.ts` | Idem |
| `functions/src/api/services/wallet.service.ts` | Idem |
| `functions/src/api/controllers/proposal.controller.ts` | Padrão de validação Zod para criar os schemas das tools |
| `functions/src/utils/sanitize.ts` | Reutilizar `sanitizeText()` nos inputs do usuário antes de salvar |
| `functions/src/stripe/` | Entender como `planId` e `subscriptionStatus` estão expostos no tenant |
| `firebase.json` | Onde registrar a nova Cloud Function `aiChat` |

### Frontend (src/)

| Arquivo | Por quê ler |
|---|---|
| `src/providers/AuthProvider.tsx` | Como acessar `getIdToken()` no hook `useAiChat` |
| `src/providers/TenantProvider.tsx` | Como acessar `tenant.planId`, `tenant.modules` e `tenant.limits` |
| `src/app/layout.tsx` | Onde injetar o `<LiaPanel />` globalmente |
| `src/components/ui/` | Quais componentes shadcn/ui já existem (Dialog, Button, Sheet, Badge) |
| `src/app/(dashboard)/proposals/page.tsx` | Exemplo de página para entender o padrão de layout |

### Regras e configuração

| Arquivo | Por quê ler |
|---|---|
| `firestore.rules` | Entender padrão atual para adicionar as regras de `aiUsage` e `aiConversations` |
| `functions/eslint.config.mjs` | Garantir que o código novo passa no linter |
| `playwright.config.ts` | Onde adicionar os novos specs E2E da Lia |

---

## Perguntas a responder durante a pesquisa

### Sobre os services existentes

- [ ] Os services de proposal/contact/product/transaction aceitam `tenantId` como parâmetro direto, ou fazem lookup pelo contexto do request?
- [ ] Há validação de limites de plano dentro dos services, ou apenas nos controllers? (para não duplicar a lógica no tool executor)
- [ ] O `delete` nos services é soft delete (campo `deletedAt`) ou hard delete? Isso afeta como a Lia confirma o que foi deletado.

### Sobre o Firestore

- [ ] Existe já algum subcoleção `usage` no documento do tenant? (para entender se `aiUsage` deve ser subcoleção ou campo no documento raiz)
- [ ] Qual é a estrutura atual de `tenants/{tenantId}` — quais campos existem no documento? Especialmente `modules`, `limits`, `planId`.

### Sobre o frontend

- [ ] O layout root já tem algum elemento fixo no canto inferior direito que possa conflitar com o botão da Lia? (ex: chat de suporte, botão de notificações)
- [ ] Existe algum `Sheet` ou `Drawer` do shadcn já em uso? Pode ser reaproveitado para o painel lateral.

---

## Achados (preenchido na Fase 1)

### Serviços disponíveis para a Lia

**proposals (controller: `proposals.controller.ts`)**
- `createProposal(req, res)` — POST /v1/proposals — valida com `CreateProposalSchema` (Zod)
- `updateProposal(req, res)` — PUT /v1/proposals/:id — valida com `UpdateProposalSchema`
- `deleteProposal(req, res)` — DELETE /v1/proposals/:id — **hard delete** (apaga doc + storage)
- Limite mensal verificado via `enforceTenantPlanLimit` (feature: `maxProposalsPerMonth`) dentro de `createProposal`

**clients (controller: `clients.controller.ts`)**
- `createClient(req, res)` — POST /v1/clients — valida com `CreateClientSchema` (Zod)
- `updateClient(req, res)` — PUT /v1/clients/:id — valida com `UpdateClientSchema`
- `deleteClient(req, res)` — DELETE /v1/clients/:id — **hard delete** (`t.delete(clientRef)` em Firestore Transaction)
- Limite verificado via `checkClientLimit(masterData)` de `billing-helpers.ts`

**products (controller: `products.controller.ts`)**
- `createProduct(req, res)` — POST /v1/products — valida com `CreateProductSchema` (Zod)
- `updateProduct(req, res)` — PUT /v1/products/:id — valida com `UpdateProductSchema`
- `deleteProduct(req, res)` — DELETE /v1/products/:id — **hard delete** + limpeza de imagens no Storage

**transactions (service: `TransactionService`)**
- `TransactionService.createTransaction(userId, user, data)` — recebe `CreateTransactionDTO`
- `TransactionService.updateTransaction(userId, user, id, data)` — update atômico com ajuste de saldo
- `TransactionService.updateFinancialEntryWithInstallments(userId, user, id, data)` — update com parcelas
- `TransactionService.updateStatusBatch(userId, user, ids, status)` — batch status update
- `TransactionService.deleteTransaction(userId, user, id)` — **hard delete** com rollback de saldo
- `TransactionService.deleteTransactionGroup(userId, user, groupId)` — hard delete em grupo

**wallets (controller: `wallets.controller.ts`)**
- `createWallet(req, res)` — POST /v1/wallets — limite via `enforceTenantPlanLimit` (feature: `maxWallets`)
- `updateWallet(req, res)` — PUT /v1/wallets/:id
- `deleteWallet(req, res)` — DELETE /v1/wallets/:id
- `transferValues(req, res)` — POST /v1/wallets/transfer
- `adjustBalance(req, res)` — POST /v1/wallets/adjust

**Conclusão sobre delete:** Todos os recursos (proposals, clients, products, transactions, wallets) usam **hard delete**. Não há campo `deletedAt`. A Lia deve exibir a severidade corretamente: deleção é irreversível.

**Conclusão sobre limites:** A verificação de limites de plano acontece **dentro dos controllers/services** (não no tool executor da Lia). A Lia NÃO precisa duplicar essa lógica — basta chamar o endpoint e tratar o erro 402/403.

---

### Estrutura do tenant/{tenantId}

Campos relevantes para a Lia (mapeados via `tenant-plan-policy.ts` e `TenantProvider`):

```typescript
// Campos lidos pelo backend (via tenant-plan-policy.ts):
tenantData.plan          // tier direto: 'free' | 'starter' | 'pro' | 'enterprise'
tenantData.planTier      // alias de plan
tenantData.planId        // referência ao doc plans/{planId} → tem campo .tier
tenantData.stripePriceId // mapeado para tier via stripeConfig
tenantData.subscriptionStatus  // 'active' | 'past_due' | 'canceled'
tenantData.stripeSubscriptionId

// Campos lidos pelo frontend (via TenantProvider):
tenant.id                // tenantId
tenant.name
tenant.primaryColor
tenant.niche             // 'automacao_residencial' | 'cortinas'
tenant.whatsappEnabled
```

**Importante:** O campo `modules` (lista de módulos ativos) **não existe** como campo no documento `tenants/{tenantId}`. O controle de acesso a módulos é feito por `planId` (tier) e pelas features de cada plano. Para verificar se um módulo financeiro está ativo, a Lia deve confiar no tier do plano (Starter tem limitações) e não num array `modules`.

**planId no frontend:** Vive em `user.planId` (campo no `users/{uid}`) e em `tenantOwner.planId` — não no documento `tenants/`. O hook `usePlanLimits()` resolve via `user.planId` → `plans/{planId}.tier`. Para a Lia, o middleware `ai-auth.middleware.ts` deve ler o tier diretamente do doc `tenants/{tenantId}` via `tenant-plan-policy.ts` (já implementado).

---

### Autenticação e middleware

**Arquivo:** `functions/src/api/middleware/auth.ts`
- Middleware central: `validateFirebaseIdToken(req, res, next)`
- Popula `req.user: AuthContext` com: `uid`, `tenantId`, `role`, `masterId`, `isSuperAdmin`, `hasRequiredClaims`
- Claims lidas de `userRecord.customClaims` (via Admin SDK) — sempre frescas
- Stale-claims fallback: se claims incompletas, lê `users/{uid}` no Firestore
- Nunca confiar em `tenantId` do body — usar sempre `req.user.tenantId`
- Pattern a reutilizar: `validateFirebaseIdToken` → `req.user` → `req.user.tenantId`

**Regra de posicionamento:** rotas públicas → `validateFirebaseIdToken` → rate limiters → rotas protegidas

---

### Rate limiting existente

**Arquivo:** `functions/src/api/middleware/pdf-rate-limiter.ts`
- In-memory, sliding window, 5 req/60s por uid ou IP
- Expõe `pdfRateLimiter(req, res, next)`
- Pattern reutilizável para criar `aiRateLimiter` com janela/limite diferentes
- Limitação: por instância do Cloud Run (não global)

Para AI, o rate limit será diferente: limite mensal por tenant (não por minuto). Implementar via Firestore (`aiUsage/YYYY-MM`) com `FieldValue.increment()`, não via memória.

---

### Sanitização de input

**Arquivo:** `functions/src/utils/sanitize.ts`
- `sanitizeText(input: string): string` — remove TODAS as tags HTML, retorna plain text
- `sanitizeRichText(input: string): string` — permite `<b>`, `<i>`, `<em>`, `<strong>`, `<br>`, `<p>`
- Usa biblioteca `sanitize-html` internamente
- Reutilizar `sanitizeText()` em todos os inputs do usuário antes de construir o contexto para o Gemini

---

### Padrão de validação Zod encontrado

Exemplo real de `proposals.controller.ts`:

```typescript
const CreateProposalSchema = z.object({
  title: z.string().max(300).trim().optional(),
  clientId: z.string().max(100).optional(),
  // ...
  products: z.array(z.unknown()).max(500).optional(),
}).passthrough();

const UpdateProposalSchema = CreateProposalSchema.partial();

// Uso nos handlers:
const parseResult = CreateProposalSchema.safeParse(req.body);
if (!parseResult.success) {
  const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
  return res.status(400).json({ message: firstError });
}
const input = parseResult.data;
```

As tools da Lia devem seguir exatamente este padrão: Zod schema → `.safeParse()` → mensagem do primeiro erro.

---

### Subcoleções Firestore existentes

Padrões de subcoleção já em uso no codebase:

| Coleção raiz | Subcoleção | Onde usado |
|---|---|---|
| `whatsappUsage/{tenantId}` | `months/{YYYY-MM}` | `reportWhatsappOverage.ts` — billing mensal |
| `tenant_usage/{tenantId}` | `months/{YYYY-MM}` | `tenant-plan-policy.ts` — contagem de propostas |
| `users/{uid}` | `permissions/{permDoc}` | Auth middleware — permissões granulares |

**Para `aiUsage`:** O padrão correto é `tenants/{tenantId}/aiUsage/{YYYY-MM}` (subcoleção do tenant) — consistente com o padrão de `tenant_usage` e mantém os dados de uso próximos ao documento do tenant. Alternativa `whatsappUsage` usa coleção raiz separada — padrão legado.

**Decisão de schema:** Usar subcoleção `tenants/{tenantId}/aiUsage/{YYYY-MM}` e `tenants/{tenantId}/aiConversations/{sessionId}`. Confirma a proposta original do CONTEXT.md.

---

### Frontend: Layout e conflitos

**Arquivo principal:** `src/app/layout.tsx`
- Root layout: `AuthProvider` → `PermissionsProvider` → `TenantProvider` → `ProtectedRoute` → `{children}`
- **Não há `(dashboard)` route group** — o layout é flat. `<LiaPanel />` deve ser injetado no root layout dentro de `ProtectedRoute` (ou como filho de `TenantProvider`), condicionando ao usuário autenticado.
- Não há `src/app/(dashboard)/layout.tsx` — este arquivo não existe no projeto.

**Conflito com bottom-dock:**
- `components/layout/bottom-dock.tsx`: `className="fixed left-0 right-0 bottom-0 z-30"` e `z-40`
- O dock está fixo na **parte inferior central** (centralizado com `-translate-x-1/2`)
- O `LiaTriggerButton` deve ser posicionado em `bottom-6 right-6` com `z-50` — **sem conflito** de posição
- O `LiaPanel` (aside) com `right: 0` pode conflitar visualmente com o dock em mobile — gerenciar com media queries

**Sheet/Drawer:**
- Não existe componente `sheet.tsx` nem `drawer.tsx` em `src/components/ui/`
- Alternativa: usar `<aside>` custom com Tailwind transitions (já previsto no CONTEXT.md)

**Componentes shadcn/ui disponíveis relevantes:**
- `dialog.tsx` — para `LiaToolConfirmDialog`
- `badge.tsx` — para `LiaUsageBadge`
- `button.tsx`, `card.tsx`, `avatar.tsx`, `input.tsx`, `textarea.tsx`, `tooltip.tsx`
- `alert-dialog.tsx` — alternativa mais semântica para confirmações destrutivas
- `skeleton.tsx` — para estado de loading

---

### Acesso ao ID Token no frontend

Para `useAiChat.ts` enviar requests autenticados para a nova Cloud Function:

```typescript
// Via auth-provider.tsx — auth.currentUser está disponível:
import { auth } from "@/lib/firebase";
const idToken = await auth.currentUser?.getIdToken();
```

O padrão correto é: `auth.currentUser.getIdToken()` → `Authorization: Bearer ${idToken}` no header do fetch SSE.

**Atenção:** O hook `useAiChat` deve chamar `/api/backend/ai/chat` (proxy Next.js) → Cloud Function, seguindo o padrão split-backend do projeto. Não chamar a URL da Cloud Function diretamente.

---

### Registro da nova Cloud Function

**Arquivo:** `firebase.json`
- Functions usam `source: "functions"`, `codebase: "default"`
- A nova `aiChat` Cloud Function deve ser exportada em `functions/src/index.ts`
- Ela é uma Cloud Function HTTP (não Express monolith) — semelhante a `stripeWebhook`
- Ou: pode ser registrada **dentro do monolito Express** como rota `/v1/ai/chat` — mais simples para reutilizar `validateFirebaseIdToken` sem duplicar setup

**Recomendação:** Integrar como rota Express (`/v1/ai/chat`) dentro do monolito `api` — reutiliza CORS, auth middleware e toda a infraestrutura. SSE funciona em Cloud Functions V2 (Cloud Run suporta streaming HTTP).

---

### Lint config

`functions/eslint.config.mjs` — ESLint para functions. Código novo deve passar. Padrões comuns:
- `@typescript-eslint/no-explicit-any` — evitar `any` sem comentário
- `@typescript-eslint/no-floating-promises` — sempre `await` ou `void` em Promises

---

### Playwright config

`playwright.config.ts` — specs E2E em `e2e/`. Novos specs de Lia vão em `e2e/ai/` (como especificado no PLAN.md).

---

### Perguntas respondidas

- **Services aceitam `tenantId` como parâmetro?** Não diretamente — controllers extraem de `req.user.tenantId`. O `TransactionService` recebe `userId` e `user` (claims), e resolve o `tenantId` internamente via `checkFinancialPermission()`. Para a Lia, o executor de tools deve sempre passar `req.user` (auth context) ao chamar os services/controllers — nunca aceitar `tenantId` como parâmetro do modelo.

- **Validação de limites está nos services ou controllers?** Nos **controllers** (proposals, clients) e dentro do `TransactionService`. A Lia não precisa duplicar — basta tratar erros 402 retornados.

- **Delete é hard ou soft?** **Hard delete em todos os domínios.** Não há campo `deletedAt`. A Lia deve tratar deleção como irreversível e usar `request_confirmation` sempre.

- **Existe subcoleção `usage` no tenant?** Sim, em `tenant_usage/{tenantId}/months/{YYYY-MM}`. Usar `tenants/{tenantId}/aiUsage/{YYYY-MM}` como subcoleção direta do tenant (padrão mais limpo para dados de AI).

- **Há elemento fixo no canto inferior direito?** Não. O bottom-dock é centralizado (`-translate-x-1/2`). O canto direito está livre para o `LiaTriggerButton`.