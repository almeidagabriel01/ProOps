# proposals.CLAUDE.md

Documentacao interna do `proposals.controller.ts`. Leia antes de tocar em qualquer codigo relacionado a propostas, aprovacoes ou sincronizacao de transacoes.

---

## Visao geral

O controller de propostas e o mais complexo do sistema. Ele gerencia o ciclo de vida completo de uma proposta comercial, incluindo:

- CRUD basico com validacao e sanitizacao robusta
- Limite mensal de propostas por plano (feature gate)
- Limpeza de anexos no Firebase Storage
- **Sincronizacao automatica de transacoes financeiras** ao aprovar/revogar propostas

**Arquivo:** `functions/src/api/controllers/proposals.controller.ts`  
**Rota de entrada:** `functions/src/api/routes/core.routes.ts`

---

## Endpoints

| Metodo | Path | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/proposals` | `createProposal` | Token Firebase + claims |
| `PUT` | `/proposals/:id` | `updateProposal` | Token Firebase + claims |
| `DELETE` | `/proposals/:id` | `deleteProposal` | Token Firebase + claims |
| `GET` | `/proposals/:id/pdf` | `downloadProposalPdf` (outro controller) | Token + rate limit |
| `POST` | `/proposals/:id/share-link` | `createShareLink` (outro controller) | Token |

---

## Constantes do modulo

```typescript
PROPOSALS_COLLECTION = "proposals"
TENANT_USAGE_COLLECTION = "tenant_usage"
MAX_ATTACHMENTS_PER_PROPOSAL = 20
MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024   // 10 MB por anexo
MAX_ATTACHMENT_NAME_LENGTH = 180
MAX_ATTACHMENT_URL_LENGTH = 15 * 1024 * 1024   // URL ou base64 ate 15 MB
MAX_PRODUCTS_PER_PROPOSAL = 500
```

---

## `POST /proposals` — createProposal

### Autenticacao e autorizacao

1. Resolve `userId` do token (`req.user.uid`).
2. Chama `resolveUserAndTenant(userId, req.user)` que retorna `{ masterRef, tenantId, isMaster, isSuperAdmin, userData }`.
3. Se nao e `isMaster` nem `isSuperAdmin`, verifica permissao `proposals.canCreate` no Firestore (`users/{id}/permissions/proposals`).
4. Super admins podem especificar `targetTenantId` no body para criar em nome de outro tenant.

### Validacao do body

**Modo rascunho (`status === "draft"`):** validacao relaxada
- Titulo ausente recebe default `"Rascunho {data}"`.
- `clientName` ausente recebe string vazia.
- `totalValue` ausente ou negativo recebe 0.

**Outros status:** validacao estrita
- `title` com pelo menos 3 caracteres (obrigatorio).
- `clientId` e `clientName` obrigatorios.
- `totalValue` deve ser numero >= 0.

### Sanitizacao de anexos (`sanitizeAttachmentsInput`)

Cada anexo passa pela seguinte validacao:
- `type`: normalizado para `"image"` ou `"pdf"`.
- `id`: deve bater com regex `^[A-Za-z0-9._:-]{6,120}$`; caso contrario, gera `att-{timestamp}-{index}`.
- `name`: caracteres de controle e proibidos removidos; truncado em 180 chars.
- `url`: aceita data URI com MIME valido OU URL HTTPS valida (sem credenciais). HTTP so em `NODE_ENV !== 'production'`.
- `size`: deve ser numero finito, >= 0 e <= 10 MB.
- `uploadedAt`: deve ser data valida.
- `storagePath`: deve comecar com `tenants/` e conter `/proposals/` e `/attachments/`.

**Rejeicao:** qualquer campo invalido lanca `"INVALID_ATTACHMENTS"` → resposta `400`.

### Sanitizacao de produtos (`sanitizeProposalProductsInput`)

- Maximo de 500 produtos.
- Campos truncados: `productName` (300), `productDescription` (4000), `productImage` (4096), etc.
- `itemType`: `"product"` ou `"service"`.
- Servicos (`itemType === "service"`) sempre tem `markup = 0` e `pricingDetails = { mode: "standard" }`.
- `pricingDetails` suporta modos: `curtain_meter`, `curtain_height`, `curtain_width`, `standard`.

### Limite mensal de propostas (feature gate)

Executado apenas para propostas nao-rascunho, dentro da Firestore Transaction:

1. Calcula janela mensal UTC via `buildMonthlyPeriodWindowUtc()`.
2. Le documento `tenant_usage/{tenantId}/months/{YYYY-MM}`.
3. Chama `enforceTenantPlanLimit({ feature: "maxProposalsPerMonth", ... })`.
4. Se bloqueado: lanca `ProposalMonthlyLimitError` (erro tipado com payload completo).
5. Se aprovado: incrementa `proposalsCreated` no documento de uso.
6. **Fail-open:** se a verificacao de limite falhar por erro interno (exceto bloqueio explicito), a proposta e criada mas o evento e registrado em `security_audit_events` e `security_metrics`.

**Resposta de limite atingido (HTTP 402):**
```json
{
  "message": "Limite mensal de propostas atingido.",
  "code": "PLAN_LIMIT_EXCEEDED",
  "used": 10,
  "limit": 10,
  "projected": 11,
  "tier": "free",
  "source": "firestore",
  "periodStart": "2026-04-01T00:00:00.000Z",
  "periodEnd": "2026-04-30T23:59:59.999Z",
  "resetAt": "2026-05-01T00:00:00.000Z"
}
```

### Firestore Transaction de criacao

**Leituras (devem vir antes das escritas):**
- `users/{masterRef}` — referencia do master do tenant
- `companies/{tenantId}` — documento da empresa
- `tenant_usage/{tenantId}/months/{YYYY-MM}` — contador mensal (se nao-rascunho)

**Escritas:**
- `proposals/{newId}` — novo documento da proposta
- `users/{masterRef}` — incrementa `usage.proposals` em +1
- `companies/{tenantId}` — incrementa `usage.proposals` em +1 (se empresa existir)
- `tenant_usage/.../months/{YYYY-MM}` — incrementa `proposalsCreated` (se nao-rascunho)

### Sincronizacao de transacoes apos criacao

Apos a Firestore Transaction de criacao ser confirmada, se o status resultante for aprovado (`isStatusApproved()`), chama `syncApprovedProposalTransactions()`.

**Parametros passados:**
- `initialStatus = input.initialPaymentStatus || "pending"`

### Resposta de sucesso

```json
{ "success": true, "proposalId": "abc123", "message": "Proposta criada com sucesso!" }
```

---

## `PUT /proposals/:id` — updateProposal

### Logica de autorizacao

1. Fetch paralelo: `resolveUserAndTenant()` e `proposalRef.get()` ao mesmo tempo.
2. Verifica `tenantId` da proposta contra claims do usuario.
3. Verifica permissao `proposals.canEdit` para membros nao-master.

### Campos atualizaveis

Apenas campos da whitelist sao aplicados ao `safeUpdate`:

```
title, clientId, clientName, clientEmail, clientPhone, clientAddress,
validUntil, status, products, sistemas, discount, closedValue, extraExpense,
notes, customNotes, sections, pdfSettings, totalValue,
downPaymentEnabled, downPaymentType, downPaymentPercentage, downPaymentValue,
downPaymentWallet, downPaymentDueDate, downPaymentMethod,
installmentsEnabled, installmentsCount, installmentValue,
installmentsWallet, firstInstallmentDate, installmentsPaymentMethod,
paymentMethod, attachments
```

### Recalculo automatico de totalValue

Quando `products` e enviado no body, o `totalValue` e recalculado:
```
totalValue = subtotal - (subtotal * discount / 100) + extraExpense
```
O valor calculado sobrepoe qualquer `totalValue` enviado manualmente junto com `products`.

### Limpeza de anexos removidos

Antes de atualizar, coleta os `storagePath` dos anexos atuais. Apos a atualizacao, calcula os paths removidos e chama `deleteStorageObjectsBestEffort()` — falhas individuais sao enfileiradas em `storage_gc` para retentativa posterior.

### Deteccao de mudanca de status

```typescript
isBeingApproved  = willBeApproved && !isCurrentlyApproved
isBeingReverted  = isCurrentlyApproved && updateData.status !== undefined && !willBeApproved
isAlreadyApproved = isCurrentlyApproved && (updateData.status === undefined || willBeApproved)
```

### Logica de sincronizacao de transacoes

**Campos que disparam sincronizacao (`approvedSyncFields`):**
`title, clientId, clientName, totalValue, validUntil, downPaymentEnabled, downPaymentType, downPaymentPercentage, downPaymentValue, downPaymentWallet, downPaymentDueDate, installmentsEnabled, installmentsCount, installmentValue, installmentsWallet, firstInstallmentDate, products, discount, extraExpense, status`

**Modo metadados-apenas (`approvedSyncIsMetadataOnly`):**
Se apenas campos de metadados mudaram (titulo, clientId, clientName — sem campos estruturais financeiros), a sincronizacao atualiza `description`, `clientId`, `clientName` nas transacoes existentes sem recriar ou recalcular saldos.

**Campos estruturais que forcam sincronizacao completa:**
`totalValue, closedValue, validUntil, downPaymentEnabled, downPaymentType, downPaymentPercentage, downPaymentValue, downPaymentWallet, downPaymentDueDate, installmentsEnabled, installmentsCount, installmentValue, installmentsWallet, firstInstallmentDate, products, discount, extraExpense, status`

**Fluxo completo:**
1. Se `isBeingReverted`: chama `cleanupProposalTransactions()` para deletar e reverter saldos.
2. Se `shouldSyncApprovedTransactions`: chama `syncApprovedProposalTransactions()`.

**Nota:** Existe um bloco `if (false && isAlreadyApproved)` — codigo desativado que implementava sincronizacao em-linha com batch. Esse codigo pode ser ativado no futuro, mas atualmente nao executa.

---

## `DELETE /proposals/:id` — deleteProposal

### Sequencia de operacoes

1. Verifica permissao `proposals.canDelete`.
2. Chama `cleanupProposalTransactions(id, tenantId)` — deleta transacoes vinculadas e reverte saldos.
3. Coleta paths de storage de anexos e PDFs.
4. Executa Firestore Transaction:
   - Deleta `proposals/{id}`
   - Decrementa `usage.proposals` em -1 no master do tenant
   - Decrementa `usage.proposals` em -1 na empresa
5. Chama `deleteStorageObjectsBestEffort()` para paths coletados.

---

## Funcao auxiliar: `isStatusApproved(statusId, tenantId)`

Determina se um status representa "aprovado" com fallback progressivo:

| Regra | Resultado |
|-------|-----------|
| `statusId === "approved"` | `true` |
| `statusId === "default_2"` | `true` (coluna virtual do kanban) |
| `statusId` em `["draft", "in_progress", "sent", "rejected", "default_0", "default_1", "default_3"]` | `false` |
| Documento em `kanban_statuses/{statusId}` com `mappedStatus === "approved"` | `true` |
| Documento com `category === "won"` | `true` (novo modelo de status) |
| Documento com `label` contendo "aprovad", "ganha" ou "approved" | `true` (fallback legado) |
| Qualquer erro ou documento de outro tenant | `false` |

**Guard de tenant:** se o documento de status pertencer a outro tenant, retorna `false` incondicionalmente.

---

## Funcao critica: `syncApprovedProposalTransactions(params)`

Sincroniza as transacoes financeiras de uma proposta aprovada com o estado atual da proposta.

### Parametros

```typescript
{
  proposalId: string,
  proposalTenantId: string,
  proposalData: Record<string, unknown>,
  userId: string,
  initialStatus?: "paid" | "pending" | "overdue",  // default: "pending"
  metadataOnly?: boolean,  // so atualiza descricao/cliente, sem recalcular saldos
}
```

### Estrutura das transacoes geradas

**Cenario 1: Entrada + Parcelas (`downPaymentEnabled && installmentsEnabled`)**
- Um documento com `isDownPayment: true`, `installmentNumber: null`
- N documentos com `isInstallment: true`, `installmentNumber: 1..N`
- `proposalGroupId = "proposal_{proposalId}"` em todos
- `installmentGroupId = "proposal_installments_{proposalId}"` apenas nas parcelas

**Cenario 2: Apenas Parcelas (`!downPaymentEnabled && installmentsEnabled`)**
- N documentos com `isInstallment: true`
- Sem `proposalGroupId`

**Cenario 3: Apenas Entrada (`downPaymentEnabled && !installmentsEnabled`)**
- Um documento com `isDownPayment: true`

**Cenario 4: Transacao simples (`!downPaymentEnabled && !installmentsEnabled`)**
- Um documento simples
- `amount = closedValue > 0 ? closedValue : totalValue`
- `dueDate = validUntil || hoje + 30 dias`

### Wallet das transacoes geradas

```
Entrada:   proposalData.downPaymentWallet  → fallback: carteira padrao do tenant
Parcelas:  proposalData.installmentsWallet → fallback: carteira padrao do tenant
```

A carteira padrao e resolvida por `resolveDefaultWalletNameForTenant()`:
1. Busca carteira com `isDefault === true`
2. Fallback: qualquer carteira com `status === "active"`

**Atencao:** neste contexto, a `wallet` armazenada e o **nome** da carteira, nao o ID. Dados antigos usam nome. Dados novos (pos-abril/2025) criados via formulario usam ID, mas os gerados por proposta ainda usam nome.

### Algoritmo de sincronizacao (merge, nao substituicao)

```
desiredDrafts = buildApprovedProposalTransactionDrafts(...)
existingDocs  = query transactions onde proposalId == proposalId

Para cada existingDoc:
  key = getProposalLinkedTransactionKey(doc)
    "down_payment"       → isDownPayment = true
    "installment_{N}"    → isInstallment = true, installmentNumber = N
    "single"             → transacao simples
    null                 → parcial ou com parentTransactionId (complexo)

Se houver documentos complexos (parciais, duplicatas):
  → metadataOnly=true: atualiza apenas description/clientId/clientName
  → metadataOnly=false: lanca erro "Nao foi possivel sincronizar automaticamente..."

Se desired nao tem a key de um existing:
  → Se existing.status === "paid": lanca erro (nao pode remover parcela paga)
  → Senao: deleta existing

Se desired tem key sem existing: cria novo documento

Se desired tem key com existing:
  → Se mudou amount ou wallet E estava pago: calcula ajuste de saldo
  → Atualiza os campos da parcela existente
```

### Guards criticos

| Situacao | Comportamento |
|----------|---------------|
| Parcela paga sendo removida | Erro: "Nao e possivel remover parcelas/entradas ja pagas" |
| Documentos parciais ou duplicados sem `metadataOnly` | Erro: "Nao foi possivel sincronizar automaticamente" |
| Carteira nao encontrada ao ajustar saldo pago | Silencioso (sem ajuste — comportamento legado) |

---

## Funcao auxiliar: `cleanupProposalTransactions(proposalId, tenantId)`

Remove todas as transacoes vinculadas a uma proposta e reverte saldos de carteiras.

**Executada em:**
- `deleteProposal` — ao excluir proposta
- `updateProposal` — quando `isBeingReverted === true`

**Comportamento:** para cada transacao com `proposalId == id`:
1. Se `status === "paid"` e tem `wallet` e `amount`: calcula reverso do saldo via `resolveWalletRef()`
2. Deleta o documento

**Tratamento de erro:** toda a funcao e envolvida em try/catch. Falhas sao logadas mas nao propagadas — a operacao pai (delete/update da proposta) continua.

---

## Colecoes Firestore utilizadas

| Colecao | Operacoes |
|---------|-----------|
| `proposals` | create, read, update, delete |
| `transactions` | create, read, update, delete (via sync) |
| `wallets` | read, update balance (via sync e cleanup) |
| `users` | read (auth), update `usage.proposals` |
| `companies` | read, update `usage.proposals` |
| `kanban_statuses` | read (para resolver status customizado) |
| `tenant_usage/{id}/months/{YYYY-MM}` | read, set (contador mensal) |
| `security_audit_events` | write (falhas de enforcement) |
| `security_metrics` | write (contadores de seguranca) |
| `storage_gc` | write (paths com falha de delete) |

---

## Modelo do documento `proposals`

```typescript
{
  tenantId: string,
  companyId: string,           // mesmo valor que tenantId
  title: string,
  status: string,              // "draft" | "in_progress" | "sent" | "approved" | "rejected" | ID do kanban status
  totalValue: number,
  closedValue: number | null,  // valor final negociado (tem prioridade sobre totalValue nas transacoes)
  discount: number,            // percentual
  extraExpense: number,
  notes: string | null,
  customNotes: string | null,
  validUntil: string | null,   // YYYY-MM-DD
  clientId: string,
  clientName: string,
  clientEmail: string | null,
  clientPhone: string | null,
  clientAddress: string | null,
  products: SanitizedProduct[],
  sistemas: any[],
  sections: any[],
  pdfSettings: any | null,
  attachments: SanitizedAttachment[],
  // Pagamento
  downPaymentEnabled: boolean,
  downPaymentType: "value" | "percentage",
  downPaymentPercentage: number,
  downPaymentValue: number,
  downPaymentWallet: string | null,
  downPaymentDueDate: string | null,
  downPaymentMethod: string | null,
  installmentsEnabled: boolean,
  installmentsCount: number,
  installmentValue: number,
  installmentsWallet: string | null,
  firstInstallmentDate: string | null,
  installmentsPaymentMethod: string | null,
  paymentMethod: string | null,
  // Audit
  createdById: string,
  createdByName: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // PDF (adicionado por outros controllers)
  pdf?: { storagePath?: string, url?: string },
  pdfPath?: string,            // legado
  pdfUrl?: string,             // legado
}
```

---

## Seguranca de storage (storagePath)

Paths validos devem:
- Comecar com `tenants/`
- Conter `/proposals/{proposalId}/`
- Conter `/attachments/` ou `/pdf/`
- Nao conter `..`
- Ter no maximo 512 caracteres

A funcao `isManagedProposalPath(path, tenantId, proposalId)` valida que o path pertence exatamente ao tenant e proposta corretos — previne path traversal entre tenants.

---

## Erros conhecidos e edge cases

### 1. Block `if (false && isAlreadyApproved)` desativado

O bloco em `updateProposal` (linhas ~1581-1897) implementava sincronizacao em-linha via batch para propostas ja aprovadas. Esta atualmente desativado com `if (false && ...)`. A sincronizacao agora passa por `syncApprovedProposalTransactions()`. O bloco pode ser removido em limpeza futura.

### 2. Wallet por nome vs por ID em propostas aprovadas

`buildApprovedProposalTransactionDrafts()` usa o nome da carteira (`proposalData.installmentsWallet`) para popular o campo `wallet` das transacoes. O backend resolve nome → ID via `resolveWalletRef()` ao ajustar saldos. Para exibicao no frontend, o campo pode conter nome ou ID dependendo da epoca de criacao da proposta.

### 3. closedValue vs totalValue

Para transacao simples (sem entrada/parcelas), `buildApprovedProposalTransactionDrafts()` usa:
```typescript
effectiveTotalValue = closedValue > 0 ? closedValue : totalValue
```
Isso significa que `closedValue` (valor final negociado) sobrepoe `totalValue` na geracao da transacao.

### 4. Super admin criando em nome de outro tenant

O `targetMasterRef` e resolvido buscando o master do tenant alvo:
1. Usuario sem `masterId` (master direto)
2. Usuario com role `MASTER`, `ADMIN` ou `WK`
3. Qualquer usuario do tenant (fallback)

Se nenhum usuario for encontrado, `targetMasterRef` permanece o do super admin — pode causar incremento de `usage.proposals` no tenant errado.

### 5. Sincronizacao com complexDocs

Se existirem transacoes com `isPartialPayment: true` ou `parentTransactionId` (pagamentos parciais), a funcao `syncApprovedProposalTransactions()` nao pode resolver a estrutura automaticamente. Com `metadataOnly: true`, atualiza apenas metadados. Com `metadataOnly: false`, lanca erro.

---

## Checklist ao modificar este controller

- [ ] Qualquer novo campo persistido na proposta deve ser adicionado a whitelist de `updateProposal`
- [ ] Campos que afetam calculo financeiro devem ser adicionados a `approvedSyncFields` e `structuralApprovedSyncFields`
- [ ] Novos tipos de anexo precisam de validacao em `normalizeAttachmentType` e `isSafeAttachmentUrl`
- [ ] Mudancas em `buildApprovedProposalTransactionDrafts()` afetam estrutura das transacoes — verificar `getProposalLinkedTransactionKey()` para compatibilidade
- [ ] Qualquer mudanca em `syncApprovedProposalTransactions()` requer teste com cenarios de parciais existentes
- [ ] Nunca usar batch fora de Firestore Transaction quando ha ajuste de saldo — risco de inconsistencia
