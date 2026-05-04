# transactions.CLAUDE.md

Documentacao interna do `transactions.controller.ts` e `transaction.service.ts`. Leia integralmente antes de modificar qualquer logica de lancamentos financeiros, saldos ou parcelamentos.

---

## Visao geral

O modulo de transacoes e dividido em duas camadas:

- **Controller** (`transactions.controller.ts`): camada HTTP — valida inputs, chama o service, mapeia erros para HTTP status codes.
- **Service** (`TransactionService` em `transaction.service.ts`): toda a logica de negocio — Firestore Transactions atomicas, ajuste de saldos, sincronizacao de recorrencias.

**Rotas registradas em:** `functions/src/api/routes/finance.routes.ts`

---

## Endpoints

| Metodo | Path | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/transactions` | `createTransaction` | Token + financeiro |
| `PUT` | `/transactions/:id` | `updateTransaction` | Token + financeiro |
| `PUT` | `/transactions/:id/installments` | `updateTransactionWithInstallments` | Token + financeiro |
| `POST` | `/transactions/status-batch` | `updateTransactionsStatusBatch` | Token + financeiro |
| `DELETE` | `/transactions/:id` | `deleteTransaction` | Token + financeiro |
| `GET` | `/transactions/:id/pdf` | `downloadTransactionPdf` (outro controller) | Token + rate limit |
| `POST` | `/transactions/:id/share-link` | `createTransactionShareLink` (outro controller) | Token |

---

## Autenticacao e permissoes financeiras

Todos os endpoints chamam `checkFinancialPermission(userId, permission, claims)` de `finance-helpers.ts`.

### Fluxo de verificacao

```
1. claims.uid === userId → senao: UNAUTHENTICATED
2. claims.role existe → senao: AUTH_CLAIMS_MISSING_ROLE
3. Se isSuperAdmin → permite tudo
4. Se isMaster (MASTER | ADMIN | WK) → permite tudo
5. Se membro → verifica users/{id}/permissions/financial.{permission}
   Ex: canCreate, canEdit, canDelete
6. Verifica que claims.tenantId bate com users/{id}.tenantId no Firestore
```

### Mapeamento de erros HTTP

| Prefixo/mensagem do erro | HTTP Status |
|--------------------------|-------------|
| `FORBIDDEN_*`, `AUTH_CLAIMS_MISSING_*`, "Sem permiss", "Acesso negado" | 403 |
| "nao encontrada" | 404 |
| "Dados invalidos", "Status invalido", "ID invalido" | 400 |
| Qualquer outro | 500 |

---

## `POST /transactions` — createTransaction

### Validacao do body

`validateTransactionData()` verifica campos obrigatorios: `description`, `amount`, `date`, `type`, `status`.

**Safety Lock (prevencao de parcelas fantasmas):**
```typescript
if (!data.isInstallment && !data.isDownPayment && !data.isRecurring) {
  data.installmentCount = 1;
  delete data.installmentNumber;
  delete data.installmentGroupId;
}
```
Garante que uma transacao simples nunca carregue metadados de parcelamento.

### `CreateTransactionDTO`

```typescript
{
  description: string,
  amount: number,
  date: string,          // YYYY-MM-DD
  type: "income" | "expense",
  status: "paid" | "pending" | "overdue",
  dueDate?: string,
  clientId?: string,
  clientName?: string,
  proposalId?: string,
  category?: string,
  wallet?: string,       // ID (pos-abril/2025) ou nome (legado)
  targetTenantId?: string,
  isDownPayment?: boolean,
  downPaymentType?: string,
  downPaymentPercentage?: number,
  isInstallment?: boolean,
  installmentCount?: number,
  installmentNumber?: number,
  installmentGroupId?: string,
  installmentInterval?: number,
  isRecurring?: boolean,
  recurringGroupId?: string,
  paymentMode?: "total" | "installmentValue",
  notes?: string,
  extraCosts?: any[],
}
```

### `TransactionService.createTransaction()`

Toda a logica ocorre dentro de `db.runTransaction()`.

#### Modo parcelado ou recorrente

Ativado quando:
```typescript
shouldGenerateInstallments = isInstallment && installmentCount > 1 && (!installmentNumber || installmentNumber === 1)
shouldGenerateRecurrences  = isRecurring && installmentCount > 1 && (!installmentNumber || installmentNumber === 1)
```

Para cada parcela `i` de `0` a `count-1`:
- `status`: somente a primeira (`i === 0`) recebe o status do request; as demais recebem `"pending"`.
- `date` (data de lancamento): igual para todas as parcelas.
- `dueDate` (vencimento): calculado por `addMonths(baseDueDate, i * interval)`.
- `description`: primeira parcela recebe o texto original; as demais recebem `"{desc} ({i+1}/{count})"`.
- `installmentGroupId`: preenchido apenas se `isInstallment`.
- `recurringGroupId`: preenchido apenas se `isRecurring`.

#### Modo transacao unica

Cria um unico documento com todos os campos do DTO.

#### Ajuste de saldo de carteiras

Apos construir todos os documentos, para cada documento:
1. Calcula impactos via `getWalletImpacts(txData)`.
2. Acumula ajustes por carteira em `walletAdjustments: Map<string, number>`.
3. Para cada ajuste != 0: chama `resolveWalletRef(t, db, tenantId, walletIdentifier)`.
4. Se carteira nao encontrada: lanca erro e aborta a Transacao.
5. Aplica `FieldValue.increment(adjustment)` no campo `balance` da carteira.

**Regra do impacto:**
```
Afeta saldo se: status === "paid" E wallet definido
income → +amount
expense → -amount
extraCosts → mesmo sinal do pai (income/expense)
```

#### Resposta de sucesso

```json
{
  "success": true,
  "transactionId": "id-da-primeira-parcela",
  "message": "3 parcelas criadas."  // ou "Transacao criada."
}
```

---

## `PUT /transactions/:id` — updateTransaction

Chama `TransactionService.updateTransaction()`.

**Safety Lock no controller:**
```typescript
if (updateData.isInstallment === false && updateData.isDownPayment !== true && updateData.isRecurring !== true) {
  updateData.installmentCount = 1;
  updateData.installmentNumber = null;
  updateData.installmentGroupId = null;
}
```

### `TransactionService.updateTransaction()`

#### Sanitizacao de campos

Somente campos da whitelist `UPDATABLE_TRANSACTION_FIELDS` sao aplicados:

```typescript
const UPDATABLE_TRANSACTION_FIELDS = new Set([
  "type", "description", "amount", "date", "dueDate", "status",
  "clientId", "clientName", "proposalId", "proposalGroupId", "category",
  "wallet", "isDownPayment", "downPaymentType", "downPaymentPercentage",
  "isInstallment", "installmentCount", "installmentNumber", "installmentGroupId",
  "installmentInterval", "isRecurring", "recurringGroupId", "paymentMode",
  "notes", "extraCosts",
]);
```

#### Guard critico: reverter pagamento de proposta aprovada

```typescript
if (nextStatus && nextStatus !== "paid" && currentData.status === "paid" && currentData.proposalId) {
  proposalSnap = await t.get(proposalRef)
  if (proposalSnap.data()?.status === "approved") {
    throw new Error("Nao e possivel reverter o pagamento...")
  }
}
```

#### Sincronizacao de extraCosts

Se o status mudar, `syncExtraCostsStatus()` e chamada:
- Extra costs com status igual ao status antigo do pai sao sincronizados para o novo status.
- Extra costs com status diferente (independentes) sao preservados.

#### Calculo de delta de saldo

```
oldImpacts = getWalletImpacts(currentData)
newImpacts = getWalletImpacts({ ...currentData, ...normalizedUpdateData })

Para cada carteira:
  delta = newImpacts.get(wallet) - oldImpacts.get(wallet)
```

#### Sincronizacao de carteira na proposta vinculada

Se a carteira mudou e a transacao tem `proposalId`:
```typescript
if (currentData.isDownPayment) {
  proposalUpdate.downPaymentWallet = newData.wallet
} else {
  proposalUpdate.installmentsWallet = newData.wallet
}
```
Isso mantem os campos de carteira da proposta em sincronia.

#### paidAt timestamp

```typescript
if (nextStatus === "paid") {
  finalUpdateData.paidAt = now
} else if (nextStatus) {
  finalUpdateData.paidAt = FieldValue.delete()
}
```

#### Recorrencias

Se o status mudou e a transacao e recorrente (`isRecurring && recurringGroupId`), chama `getNextRecurringTransactionOps()`:
- Status virou `"paid"` E nao existe proxima recorrencia: **cria** a proxima com status `"pending"`.
- Status voltou de `"paid"` E a proxima existe com status `"pending"` ou `"overdue"`: **deleta** a proxima.

---

## `PUT /transactions/:id/installments` — updateTransactionWithInstallments

Endpoint de edicao completa de um grupo de parcelamento. Recalcula e persiste toda a estrutura atomicamente.

Chama `TransactionService.updateFinancialEntryWithInstallments()`.

### Payload (`UpdateFinancialEntryWithInstallmentsDTO`)

```typescript
{
  description?, type?, category?, clientId?, clientName?, notes?,
  status?, amount?, date?, dueDate?,
  isInstallment?, installmentCount?, paymentMode?,
  installmentValue?, firstInstallmentDate?,
  wallet?, installmentsWallet?,
  downPaymentEnabled?, downPaymentType?,
  downPaymentPercentage?, downPaymentValue?, downPaymentWallet?, downPaymentDueDate?,
  expectedUpdatedAt?,     // millis — otimistic concurrency check
  targetTenantId?,
  extraTransactionIds?,   // IDs adicionais para incluir no grupo
  installmentInterval?,
  isRecurring?, recurringGroupId?,
}
```

### Verificacao de concorrencia otimista

```typescript
if (expectedUpdatedAt > 0 && currentUpdatedAt > expectedUpdatedAt + 1) {
  throw new Error("Conflito de atualizacao. Recarregue os dados e tente novamente.")
}
```

### Coleta de documentos do grupo

1. Le todos os IDs em `extraTransactionIds` (verificando tenantId).
2. Se existe `installmentGroupId`: busca todos os documentos com esse grupo.
3. Senao: usa somente o documento ancora.

### Separacao entrada/parcelas

```typescript
isDownPaymentLikeDoc = (data) => !!data.isDownPayment || installmentNumber === 0

downPaymentCandidates = allDocs.filter(isDownPaymentLikeDoc)
  .sort(por updatedAt DESC, createdAt DESC)
existingDownPayment = downPaymentCandidates[0]
extraDownPayments   = downPaymentCandidates.slice(1)  // → serao deletados

existingInstallments = allDocs.filter(!isDownPaymentLikeDoc)
  .sort(por installmentNumber ASC)
```

### Calculo de valores

**paymentMode === "installmentValue":**
- Cada parcela recebe exatamente `installmentValue`.
- Entrada calculada como `installmentValue * count * (downPaymentPercentage / 100)` (se percentual).

**paymentMode === "total":**
- `remaining = totalAmount - downPaymentAmount`
- `equalInstallmentAmount = remaining / targetInstallmentCount`

### Geracao das operacoes (toCreate, toUpdate, toDelete)

Para cada posicao `i` de 0 a `targetInstallmentCount - 1`:
- Se existe `existingInstallments[i]`: adiciona a `toUpdate`.
- Senao: adiciona a `toCreate`.

Para parcelas extras (`existingInstallments.length > targetInstallmentCount`): adiciona a `toDelete`.

Para a entrada:
- `shouldHaveDownPayment`: existingDownPayment → toUpdate; senao → toCreate.
- `!shouldHaveDownPayment`: existingDownPayment → toDelete.

`extraDownPayments` (duplicatas) vao sempre para `toDelete`.

### Calculo atomico de delta de saldo

Para cada operacao:
- `toUpdate`: `oldImpacts - newImpacts` (delta)
- `toCreate`: `+newImpacts`
- `toDelete`: `-oldImpacts`

Todos resolvidos via `resolveWalletRef()` antes de qualquer escrita.

### Sincronizacao da proposta vinculada

Se a transacao ancora tem `proposalId`, ao final atualiza a proposta:
```typescript
proposalRef.update({
  installmentsWallet: installmentsWallet,
  downPaymentWallet: shouldHaveDownPayment ? downPaymentWallet : null,
  updatedAt: now,
})
```

---

## `POST /transactions/status-batch` — updateTransactionsStatusBatch

Atualiza o status de multiplas transacoes em uma unica Firestore Transaction.

### Body

```json
{ "ids": ["id1", "id2"], "newStatus": "paid" }
```

### Sequencia da transacao (ordem critica)

Firestore exige reads antes de writes na mesma transacao:

```
1. READS: le todos os documentos de transactions (ids)
   - Verifica tenantId de cada um
   - Calcula nextTxData com status novo
   - Calcula walletDiffs por transacao
   - Acumula walletAdjustments (key = "{tenantId}::{wallet}")

2. READS: resolve todas as wallet refs via resolveWalletRef()
   - Se qualquer carteira nao for encontrada: aborta tudo

2.5 READS: resolve ops de recorrencia (getNextRecurringTransactionOps)

3. WRITES: atualiza status das transacoes + extraCosts + paidAt

4. WRITES: aplica deltas nas wallets

5. WRITES: cria/deleta proximas recorrencias

6. WRITES: atualiza updatedAt das proposals vinculadas
```

### Retorno

```json
{ "success": true, "message": "Status atualizado em lote com sucesso.", "count": 2 }
```

---

## `DELETE /transactions/:id` — deleteTransaction

### Guard: proposta aprovada

Se a transacao tem `proposalId` e a proposta esta com `status === "approved"`:
```
Erro: "Nao e possivel excluir um lancamento vinculado a uma proposta Aprovada."
```
Para deletar: primeiro reverter a proposta para rascunho.

### Calculo de reverso de saldo

Para a transacao principal (se `status === "paid" && wallet`):
```
income:  saldo -= amount
expense: saldo += amount
```

Para cada extra cost (se `status === "paid"`):
- Usa `ec.wallet` se existir, senao `currentData.wallet`
- Mesmo sinal do tipo da transacao pai

Todos os walletRefs sao resolvidos antes de qualquer escrita.

---

## Funcao central: `getWalletImpacts(data)`

```typescript
function getWalletImpacts(data): Map<string, number>
```

Retorna mapa `{wallet → impacto}` para um documento de transacao.

```
Regra: impacto existe SE status === "paid" E wallet definido

transacao principal:
  income  → +amount
  expense → -amount

extraCosts (para cada ec com status="paid" e wallet):
  income  → +ec.amount
  expense → -ec.amount
```

**Atencao:** extra costs herdam o sinal do tipo do pai, nao tem tipo proprio.

---

## Funcao auxiliar: `syncExtraCostsStatus(extraCosts, newStatus, oldParentStatus)`

```typescript
// Retorna array atualizado
extraCosts.map(ec => {
  if (oldParentStatus && ec.status && ec.status !== oldParentStatus) {
    return ec;  // Independente — preserva
  }
  return { ...ec, status: newStatus };  // Alinhado — sincroniza
})
```

---

## Funcao auxiliar: `getNextRecurringTransactionOps()`

Gerencia a cadeia de recorrencias ao mudar status:

```
currentData.installmentNumber = N (numero atual)
nextNumber = N + 1
groupId = currentData.recurringGroupId

Consulta: transactions onde tenantId=X AND recurringGroupId=groupId AND installmentNumber=nextNumber

SE status virou "paid" E nao existe proxima:
  CRIA proxima recorrencia com:
    status: "pending"
    dueDate: addMonths(currentData.dueDate || date, interval)
    date: currentData.date (data de lancamento fixa)
    wallet: currentData.installmentsWallet || currentData.wallet
    extraCosts: []  // nao propaga custos extras manuais

SE status saiu de "paid" E existe proxima com status "pending" ou "overdue":
  DELETA a proxima (revertida automaticamente)
```

---

## Funcao `resolveWalletRef(t, db, tenantId, identifier)`

Em `functions/src/lib/finance-helpers.ts`. Chamada em toda operacao que afeta saldo.

```
1. Tenta como ID: db.collection("wallets").doc(identifier)
   → Se existe E data.tenantId === tenantId → retorna

2. Tenta como nome:
   wallets WHERE tenantId=tenantId AND name=identifier LIMIT 1
   → Se encontrado → retorna

3. Retorna null
```

**Comportamento quando retorna null:**
Desde abril/2025, qualquer chamada que retorna null com ajuste != 0 lanca erro e aborta a Firestore Transaction. Anteriormente ignorava silenciosamente.

---

## Funcao `addMonths(dateStr, months)`

Em `functions/src/lib/finance-helpers.ts`. Usado para calcular datas de parcelas/recorrencias.

```
Entrada: "2026-04-15", 3
Saida:   "2026-07-15"
```

**Parsing manual para evitar problemas de timezone** — nao usa `new Date(dateStr)` diretamente. Trata edge cases de fim de mes (ex: 31 de janeiro + 1 mes = 28/29 de fevereiro).

---

## Estrutura do documento `transactions`

```typescript
{
  tenantId: string,
  type: "income" | "expense",
  description: string,
  amount: number,           // sempre positivo, tipo define o sinal
  date: string,             // YYYY-MM-DD (data de lancamento)
  dueDate: string | null,   // YYYY-MM-DD (vencimento)
  status: "paid" | "pending" | "overdue",
  paidAt?: Timestamp,       // setado quando status vira "paid"
  wallet: string | null,    // ID (pos-abril/2025) ou nome (legado)
  clientId: string | null,
  clientName: string | null,
  proposalId: string | null,
  proposalGroupId: string | null,
  category: string | null,
  notes: string | null,
  extraCosts: ExtraCost[],

  // Parcelamento
  isDownPayment: boolean,
  downPaymentType: "value" | "percentage" | null,
  downPaymentPercentage: number | null,
  isInstallment: boolean,
  installmentCount: number | null,
  installmentNumber: number | null,  // 0=entrada, 1..N=parcelas
  installmentGroupId: string | null, // "gen_{ts}" ou "proposal_installments_{id}" ou "installment_{ts}"
  installmentInterval: number | null, // meses entre parcelas (default: 1)
  paymentMode: "total" | "installmentValue" | null,

  // Recorrencia
  isRecurring: boolean,
  recurringGroupId: string | null,

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdById: string,
}
```

### ExtraCost

```typescript
{
  status: "paid" | "pending" | "overdue",
  wallet?: string,   // se omitido, usa wallet do pai
  amount: number,
  // outros campos livres
}
```

---

## Relacoes entre entidades

```
proposals (1) ←→ (N) transactions
  proposal.id           = transaction.proposalId
  "proposal_{id}"       = transaction.proposalGroupId
  "proposal_installments_{id}" = transaction.installmentGroupId

transactions (grupo) ←→ wallets
  transaction.wallet    → wallets.id OU wallets.name (legado)
  ajuste de saldo       → wallets.balance via FieldValue.increment()

transactions (recorrentes)
  transaction.recurringGroupId → agrupa todas as recorrencias
  transaction.installmentNumber → numero sequencial na cadeia
```

---

## Migracoes e compatibilidade de dados

### Campo `wallet`: ID vs Nome

| Epoch | Valor armazenado | Como resolver |
|-------|-----------------|---------------|
| Antes de abril/2025 | Nome da carteira (ex: "NuBank") | `resolveWalletRef()` — tenta ID, fallback nome |
| Depois de abril/2025 | ID do Firestore (ex: "389pG63x...") | `resolveWalletRef()` — encontra diretamente por ID |

Para **exibicao no frontend:**
```typescript
wallets.find(w => w.id === tx.wallet || w.name === tx.wallet)?.name ?? tx.wallet
```

Para **popular form de edicao (WalletSelect usa IDs):**
```typescript
wallets.find(w => w.name === tx.wallet)?.id ?? tx.wallet
```

### installmentGroupId: formatos conhecidos

| Formato | Origem |
|---------|--------|
| `gen_{timestamp}` | Criado manualmente pelo usuario |
| `proposal_installments_{proposalId}` | Gerado por aprovacao de proposta |
| `installment_{timestamp}` | Criado por updateFinancialEntryWithInstallments |

---

## Bugs conhecidos e edge cases (pos-abril/2025)

### 1. Edit form — WalletSelect com dados legados

`useEditTransaction.ts` no frontend carrega `transaction.wallet` cru (pode ser nome). O `WalletSelect` usa IDs. Para dados antigos, o campo nao faz match e aparece vazio.

**Fix necessario:** no hook de edicao, resolver `wallets.find(w => w.name === tx.wallet)?.id ?? tx.wallet` antes de popular `initialFormData`.

### 2. Transaction card exibe ID em vez de nome

`transaction-card.tsx` renderiza `downPayment.wallet` e `inst.wallet` diretamente. Para dados novos (IDs), exibe o Firestore ID em vez do nome legivel.

**Fix necessario:** usar `wallets.find(w => w.id === wallet || w.name === wallet)?.name ?? wallet`.

### 3. Conflito de concorrencia em updateFinancialEntryWithInstallments

O check `expectedUpdatedAt` previne sobrescrever edicoes concorrentes, mas tem tolerancia de 1ms (`currentUpdatedAt > expectedUpdatedAt + 1`) que pode ser insuficiente em alta concorrencia.

### 4. extraCosts sem wallet proprio

Extra costs sem `wallet` explicitamente definido herdam a carteira da transacao pai. Se a carteira da transacao pai mudar e o extra cost nao tiver sua propria, pode resultar em ajustes de saldo inesperados.

---

## Checklist ao modificar este modulo

- [ ] Toda operacao que ajusta saldo deve estar dentro de `db.runTransaction()`
- [ ] Todos os reads de Firestore devem vir antes de qualquer write na mesma transacao
- [ ] `resolveWalletRef()` retornando null deve sempre lancar erro (nao ignorar)
- [ ] Testar com dados legados (wallet = nome) e dados novos (wallet = ID)
- [ ] Testar reverter status de transacao vinculada a proposta aprovada (deve rejeitar)
- [ ] Testar criar/deletar proxima recorrencia ao pagar/reverter
- [ ] Verificar `syncExtraCostsStatus()` em cenarios com extra costs independentes
- [ ] Campos novos no documento devem ser adicionados a `UPDATABLE_TRANSACTION_FIELDS`
- [ ] `getWalletImpacts()` deve refletir qualquer novo campo que afete saldo
