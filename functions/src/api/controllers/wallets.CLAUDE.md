# wallets.CLAUDE.md

Documentacao interna do `wallets.controller.ts`. Leia antes de modificar qualquer logica de carteiras, saldos ou transferencias.

---

## Visao geral

O controller de carteiras gerencia o CRUD de carteiras financeiras e operacoes de saldo. Os **saldos sao desnormalizados** — armazenados diretamente no documento da carteira no campo `balance` e atualizados de forma atomica a cada operacao financeira.

**Arquivo:** `functions/src/api/controllers/wallets.controller.ts`  
**Rota de entrada:** `functions/src/api/routes/finance.routes.ts`

---

## Endpoints

| Metodo | Path | Handler | Auth | Permissao |
|--------|------|---------|------|-----------|
| `POST` | `/wallets` | `createWallet` | Token + financeiro | `canCreate` |
| `PUT` | `/wallets/:id` | `updateWallet` | Token + financeiro | `canEdit` |
| `DELETE` | `/wallets/:id` | `deleteWallet` | Token + financeiro | `canDelete` |
| `POST` | `/wallets/transfer` | `transferValues` | Token + financeiro | `canEdit` |
| `POST` | `/wallets/adjust` | `adjustBalance` | Token + financeiro | `canEdit` |

---

## Colecoes Firestore

| Colecao | Proposito |
|---------|-----------|
| `wallets` | Documentos das carteiras com saldo desnormalizado |
| `wallet_transactions` | Historico de movimentacoes (audit trail) |

---

## Autenticacao e permissoes

Todos os endpoints chamam `checkFinancialPermission(userId, permission, req.user)` de `finance-helpers.ts`.

Hierarquia de acesso:
- **SUPERADMIN**: acesso total, pode operar em qualquer tenant via `targetTenantId`
- **MASTER / ADMIN / WK**: acesso total ao proprio tenant
- **Membro**: precisa da permissao especifica em `users/{id}/permissions/financial`

**Mapeamento de erros HTTP:**

| Mensagem do erro | HTTP Status |
|-----------------|-------------|
| `FORBIDDEN_*`, `AUTH_CLAIMS_MISSING_*`, "Sem permiss", "Acesso negado" | 403 |
| "nao encontrada" | 404 |
| "Dados invalidos" | 400 |
| Qualquer outro | 500 |

---

## `POST /wallets` — createWallet

### Campos obrigatorios

```json
{ "name": "string", "type": "string", "color": "string" }
```

### Fluxo completo

1. Valida campos obrigatorios: `name`, `type`, `color`.
2. Chama `checkFinancialPermission(userId, "canCreate", req.user)`.
3. Resolve `tenantId`: usa `data.targetTenantId` apenas se usuario for `isSuperAdmin`.
4. Verifica limite do plano via `enforceTenantPlanLimit({ feature: "maxWallets" })`.
5. **Se `isDefault === true`:** desabilita todas as outras carteiras padrao do tenant (batch update) antes de criar.
6. **Verifica unicidade de nome:** busca `wallets WHERE tenantId=X AND name=data.name.trim() LIMIT 1`. Se existir, retorna 400.
7. Cria o documento da carteira.
8. Se `initialBalance !== 0`: cria registro em `wallet_transactions` com `type: "deposit"` (positivo) ou `"withdrawal"` (negativo).

### Documento criado em `wallets`

```typescript
{
  tenantId: string,
  name: string,             // trim() obrigatorio
  type: string,             // ex: "bank", "cash", "credit"
  balance: number,          // = initialBalance (pode ser 0, positivo ou negativo)
  color: string,
  icon: string | null,
  description: string | null,
  isDefault: boolean,
  status: "active",
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### Documento criado em `wallet_transactions` (se initialBalance != 0)

```typescript
{
  tenantId: string,
  walletId: string,         // ID da carteira recem-criada
  type: "deposit" | "withdrawal",
  amount: number,           // Math.abs(initialBalance)
  description: "Saldo inicial",
  balanceAfter: number,     // = initialBalance
  createdAt: Timestamp,
  createdBy: string,        // userId
}
```

### Resposta de sucesso

```json
{ "success": true, "walletId": "abc123", "message": "Carteira criada." }
```

### Resposta de limite de plano (HTTP 402)

```json
{
  "message": "Limite de carteiras atingido para o plano atual.",
  "code": "PLAN_LIMIT_EXCEEDED"
}
```

---

## `PUT /wallets/:id` — updateWallet

### Fluxo completo

1. Chama `checkFinancialPermission(userId, "canEdit", req.user)`.
2. Le o documento da carteira; retorna 404 se nao existir.
3. Verifica `walletData.tenantId === tenantId` (ou isSuperAdmin).
4. **Se `isDefault === true`:** desabilita outras carteiras padrao (excluindo a propria).
5. Aplica whitelist de campos atualizaveis:
   ```
   name, type, color, icon, description, isDefault, status
   ```
6. **Se nome mudou:** verifica unicidade da novo nome no tenant.
7. Atualiza o documento com `safeUpdate`.

### Nota: `balance` nao e atualizavel por este endpoint

O campo `balance` nao esta na whitelist. Saldo so pode ser alterado por:
- `transferValues` (transferencia)
- `adjustBalance` (ajuste manual)
- `TransactionService` (ao pagar/reverter transacoes)

### Unicidade do nome ao renomear

```typescript
if (typeof safeUpdate.name === "string" && safeUpdate.name !== walletData?.name) {
  // busca duplicata
}
```
A verificacao so ocorre se o nome efetivamente mudar.

---

## `DELETE /wallets/:id` — deleteWallet

### Guards

| Condicao | Resposta |
|----------|----------|
| Carteira nao existe | 404 |
| Carteira de outro tenant | 403 |
| `balance !== 0` E `force !== "true"` | 412 |

**Query param `?force=true`:** permite deletar carteira com saldo. Use com extremo cuidado — nao ha reversao automatica de saldo. O saldo existente e perdido do ponto de vista do sistema.

### Operacoes ao deletar

1. Busca todos os registros em `wallet_transactions WHERE walletId == id`.
2. Cria batch: deleta todos os `wallet_transactions` + o documento da carteira.
3. Executa o batch.

**Atencao:** as `transactions` (lancamentos financeiros) que referenciam esta carteira **nao sao deletadas nem atualizadas**. O campo `wallet` nelas permanece apontando para o ID/nome deletado, resultando em erros futuros ao tentar ajustar saldo.

---

## `POST /wallets/transfer` — transferValues

Transferencia atomica entre duas carteiras do mesmo tenant.

### Body

```json
{
  "fromWalletId": "string",
  "toWalletId": "string",
  "amount": number
}
```

### Validacoes

- Todos os campos obrigatorios e `amount > 0`.
- `fromWalletId !== toWalletId` (mesma carteira rejeitada).
- Ambas as carteiras devem existir e pertencer ao tenant.
- `fromWallet.balance >= amount` (saldo insuficiente rejeitado).

### Firestore Transaction

```
Reads: fromWallet, toWallet
Validates: existencia, tenant, saldo
Writes:
  fromWallet.balance = currentBalance - amount
  toWallet.balance   = currentBalance + amount
  wallet_transactions (transfer_out): tenantId do fromWallet
  wallet_transactions (transfer_in):  tenantId do toWallet
```

**Detalhe importante:** os registros de `wallet_transactions` usam o `tenantId` da propria carteira (`fromData.tenantId`), nao o `tenantId` do usuario. Isso garante que em casos de super admin operando em outro tenant, o registro fica no tenant correto.

### Documentos criados em `wallet_transactions`

**Saida (fromWallet):**
```typescript
{
  tenantId: fromData.tenantId,
  walletId: fromWalletId,
  type: "transfer_out",
  amount: amount,
  description: `Transferencia para ${toData.name}`,
  relatedWalletId: toWalletId,
  balanceAfter: newFrom,
  createdAt: Timestamp,
  createdBy: userId,
}
```

**Entrada (toWallet):**
```typescript
{
  tenantId: toData.tenantId,
  walletId: toWalletId,
  type: "transfer_in",
  amount: amount,
  description: `Transferencia de ${fromData.name}`,
  relatedWalletId: fromWalletId,
  balanceAfter: newTo,
  createdAt: Timestamp,
  createdBy: userId,
}
```

---

## `POST /wallets/adjust` — adjustBalance

Ajuste manual de saldo de uma carteira (deposito ou saque manual).

### Body

```json
{
  "walletId": "string",
  "amount": number,         // positivo = deposito, negativo = saque
  "description": "string"  // obrigatorio
}
```

### Validacoes

- Todos os campos obrigatorios.
- Carteira deve existir e pertencer ao tenant.
- `newBalance = currentBalance + amount >= 0` (saldo nao pode ficar negativo).

### Firestore Transaction

```
Reads: walletDoc
Validates: existencia, tenant, saldo apos ajuste >= 0
Writes:
  wallet.balance = currentBalance + amount
  wallet_transactions: tipo "deposit" ou "withdrawal"
```

**Nota:** diferente de `transferValues`, o ajuste usa o `tenantId` da carteira (`walletData.tenantId`), nao do usuario. Isso e importante para super admins operando em outros tenants.

### Documento criado em `wallet_transactions`

```typescript
{
  tenantId: walletData.tenantId,
  walletId: walletId,
  type: "deposit" | "withdrawal",
  amount: Math.abs(amount),
  description: description.trim(),
  balanceAfter: newBalance,
  createdAt: Timestamp,
  createdBy: userId,
}
```

### Resposta de sucesso

```json
{ "success": true, "newBalance": 1500.00, "message": "Saldo ajustado." }
```

---

## Arquitetura de saldo desnormalizado

### Principio

O campo `balance` no documento da carteira e a **fonte de verdade** do saldo atual. Nao e calculado on-the-fly a partir de historico.

```
wallet.balance = saldo atual real
```

### Operacoes que alteram balance

| Operacao | Mecanismo |
|----------|-----------|
| Criar transacao paga | `FieldValue.increment(±amount)` via `TransactionService` |
| Mudar status para "paid" | `FieldValue.increment(+impact)` via `TransactionService` |
| Reverter status de "paid" | `FieldValue.increment(-impact)` via `TransactionService` |
| Atualizar amount/wallet de transacao paga | Delta = newImpact - oldImpact via `TransactionService` |
| Deletar transacao paga | `FieldValue.increment(-impact)` via `TransactionService` |
| Criar carteira com saldo inicial | Escrita direta (`balance: initialBalance`) |
| Transferencia | Escrita direta (calcula valores antes) |
| Ajuste manual | Escrita direta (calcula novo valor antes) |
| Aprovar proposta com transacoes | Via `syncApprovedProposalTransactions()` |
| Revogar proposta | Via `cleanupProposalTransactions()` |

### Por que nao usar FieldValue.increment em transfers/adjusts

Transferencias e ajustes calculam o novo valor explicitamente dentro da Firestore Transaction porque precisam **validar** o saldo antes de aplicar (ex: saldo insuficiente, saldo nao pode ficar negativo). `FieldValue.increment` nao permite ler o valor resultante antes de commitar.

---

## Regras de unicidade e consistencia

### Nomes de carteiras sao unicos por tenant

Validado tanto no `createWallet` quanto no `updateWallet` (apenas se o nome mudar).

```
wallets WHERE tenantId=X AND name=name.trim() LIMIT 1
```

**Implicacao:** dados legados (`transaction.wallet = nome`) dependem desta unicidade para funcionar corretamente. Se dois tenants diferentes tiverem carteiras com mesmo nome, `resolveWalletRef()` ainda funciona pois filtra por `tenantId`.

### isDefault: somente uma por tenant

```typescript
// Na criacao/edicao de carteira com isDefault: true:
defaults = wallets WHERE tenantId=X AND isDefault=true
batch: defaults.forEach(d => d.update({ isDefault: false }))
```

O batch de remocao de defaults nao esta dentro de uma Firestore Transaction atomica com a criacao da nova carteira — existe uma janela de inconsistencia muito pequena onde nenhuma carteira esta marcada como default.

---

## Modelo do documento `wallets`

```typescript
{
  tenantId: string,
  name: string,             // unico por tenant
  type: string,             // "bank" | "cash" | "credit" | outros
  balance: number,          // saldo atual desnormalizado
  color: string,            // codigo de cor (#hex ou nome)
  icon: string | null,
  description: string | null,
  isDefault: boolean,       // apenas uma por tenant
  status: "active" | "inactive",
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## Modelo do documento `wallet_transactions`

```typescript
{
  tenantId: string,
  walletId: string,
  type: "deposit" | "withdrawal" | "transfer_in" | "transfer_out",
  amount: number,           // sempre positivo (Math.abs)
  description: string,
  balanceAfter: number,     // saldo da carteira apos a operacao
  relatedWalletId?: string, // somente para transfers
  createdAt: Timestamp,
  createdBy: string,        // userId
}
```

---

## Multi-tenancy

| Ponto de verificacao | Mecanismo |
|---------------------|-----------|
| Criacao | `tenantId` vem do token; super admin pode especificar `targetTenantId` |
| Edicao | `walletData.tenantId !== tenantId` → 403 |
| Delecao | `walletData.tenantId !== tenantId` → 403 |
| Transferencia | `fromData.tenantId !== tenantId || toData.tenantId !== tenantId` → erro |
| Ajuste | `walletData.tenantId !== tenantId` → erro |

**Isolamento em `wallet_transactions`:** o `tenantId` registrado e o da carteira, nao do usuario solicitante. Isso garante isolamento correto mesmo quando super admin opera em outro tenant.

---

## Edge cases e comportamentos especiais

### 1. Deletar carteira com saldo != 0 sem force

Resposta HTTP 412 (Precondition Failed):
```json
{ "message": "Nao e possivel excluir carteira com saldo (R$ 150.00)." }
```
Com `?force=true`: deleta mesmo com saldo. Saldo e perdido — nenhuma transacao compensatoria e criada.

### 2. Carteira padrao ausente

Se um tenant nao tem nenhuma carteira com `isDefault: true`, `resolveDefaultWalletNameForTenant()` (em `proposals.controller.ts`) busca qualquer carteira `status === "active"`. Se nao existir nenhuma, retorna `null` e as transacoes de proposta sao criadas sem `wallet`.

### 3. Ajuste de saldo negativo

```typescript
if (newBalance < 0) throw new Error("Saldo insuficiente para o ajuste.")
```
Nao e possivel criar saldo negativo via `adjustBalance`. No entanto, `transferValues` tambem verifica:
```typescript
if ((fromData?.balance || 0) < amount) throw new Error("Saldo insuficiente.")
```

### 4. Saldo inicial negativo na criacao

O `initialBalance` pode ser negativo (ex: divida/limite de credito). O saldo inicial e salvo diretamente. O `wallet_transactions` criado tera `type: "withdrawal"` com `amount: Math.abs(initialBalance)`.

### 5. wallet_transactions nao tem limit()

A query em `deleteWallet`:
```typescript
db.collection(WALLET_TRANSACTIONS_COLLECTION).where("walletId", "==", id).get()
```
Nao tem `limit()`. Para carteiras com muitos registros historicos, isso pode ser lento ou exceder limites do Firestore. Em pratica, `wallet_transactions` de uma carteira especifica raramente atingem volumes problematicos, mas e um ponto de atencao.

---

## Relacao com `resolveWalletRef()` (finance-helpers.ts)

Todo o `TransactionService` usa `resolveWalletRef()` para encontrar carteiras a partir do valor no campo `wallet` das transacoes. Esta funcao:

1. Tenta como Firestore Document ID diretamente.
2. Se nao encontrar (ou tenantId diferente), busca por `name`.

**Consequencia:** se uma carteira e renomeada, transacoes legadas com o nome antigo param de ser resolvidas. O campo `wallet` nas transacoes nao e automaticamente atualizado quando uma carteira e renomeada.

---

## Checklist ao modificar este controller

- [ ] Qualquer nova operacao que muda `balance` deve usar Firestore Transaction atomica
- [ ] Registrar sempre um documento em `wallet_transactions` para auditoria
- [ ] Nunca alterar `balance` diretamente em operacoes de transacoes financeiras — usar `TransactionService`
- [ ] Nomes devem ser validados por unicidade em creates E renames
- [ ] Verificar `tenantId` da carteira contra o token do usuario antes de qualquer escrita
- [ ] Super admin: usar `walletData.tenantId` (nao `tenantId` do token) em `wallet_transactions`
- [ ] Ao deletar carteira: considerar impacto em `transactions` que referenciam essa carteira
- [ ] Documentar no PR qualquer mudanca no schema de `wallets` — campo `balance` e especialmente critico
