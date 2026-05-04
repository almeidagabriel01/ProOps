# CLAUDE.md — src/app/wallets/

## Propósito

Gerenciamento de carteiras financeiras do tenant. Uma carteira representa uma conta bancária, dinheiro em espécie, carteira digital ou cartão de crédito. Os saldos são **desnormalizados** no documento Firestore da carteira e atualizados atomicamente pelo backend sempre que uma transação financeira é paga ou revertida.

Este módulo está diretamente acoplado ao módulo de transações (`src/app/transactions/`). O campo `wallet` de uma transação referencia uma carteira por **ID** (dado novo, a partir de abril/2025) ou por **nome** (dado legado anterior à migração).

---

## Estrutura de Rotas

```
/wallets     → grid de carteiras com filtros, cards de resumo e todos os dialogs
```

Não existem sub-rotas de detalhe. Todas as operações (criar, editar, transferir, ajustar, arquivar, excluir, histórico) são realizadas via dialogs na mesma página.

---

## Arquivos principais

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Página | `src/app/wallets/page.tsx` | Orquestra carregamento, verifica plano, renderiza UI |
| Controller hook | `_hooks/use-wallets-ctrl.ts` | Estado de dialogs, filtros, ações — padrão ctrl/view |
| Data hook | `_hooks/useWalletsData.ts` | Fetch, cache `hasLoadedRef`, todas as mutações com `fetchData()` após cada ação |
| Service | `src/services/wallet-service.ts` | Leituras Firestore diretas + mutações via `callApi` |
| Índice de componentes | `_components/index.ts` | Re-exports dos componentes do módulo |
| Grid | `_components/wallets-grid.tsx` | Renderiza lista de `WalletCard` |
| Card | `_components/wallet-card.tsx` | Card individual com saldo, tipo, badge de status e menu de ações |
| Cards de resumo | `_components/wallets-summary-cards.tsx` | Total de carteiras ativas, saldo consolidado, atalho de transferência |
| Filtros | `_components/wallet-filters.tsx` | Busca por nome, filtro por tipo e por status |
| Dialogs (hub) | `_components/wallets-dialogs.tsx` | Monta todos os `Dialog*` em um único componente |
| Dialog de formulário | `_components/wallet-form-dialog.tsx` | Criar e editar carteira |
| Dialog de transferência | `_components/transfer-dialog.tsx` | Transferir saldo entre duas carteiras ativas |
| Dialog de ajuste | `_components/adjust-balance-dialog.tsx` | Adicionar ou remover saldo com descrição obrigatória |
| Dialog de exclusão | `_components/delete-wallet-dialog.tsx` | Confirmação de exclusão (com opção `force`) |
| Dialog de arquivamento | `_components/archive-wallet-dialog.tsx` | Arquivar / restaurar carteira |
| Dialog de histórico | `_components/wallet-history-dialog.tsx` | Tabela de `WalletTransaction` da carteira |
| Skeletons | `_components/wallets-skeleton.tsx` | Skeleton full-page e skeleton do grid |
| Estados vazios | `_components/wallets-empty-states.tsx` | `WalletsEmptyState` e `WalletsNoResults` |
| Componente global | `src/components/features/wallet-select.tsx` | Select reutilizável com criação inline; usado em forms de transação e proposta |
| Tipos | `src/types/index.ts` linha 288+ | `Wallet`, `WalletType`, `WalletTransaction`, `WalletTransactionType` |

---

## Modelo de dados

### Tipo `Wallet`

```typescript
type Wallet = {
  id: string;
  tenantId: string;
  name: string;           // Ex: "NuBank", "Caixa Físico" — único por tenant
  type: WalletType;       // "bank" | "cash" | "digital" | "credit_card" | "other"
  balance: number;        // Saldo atual em BRL — DESNORMALIZADO (ver seção crítica)
  color: string;          // Hex para UI (#3b82f6)
  icon?: string;          // Nome de ícone Lucide (opcional)
  description?: string;
  isDefault?: boolean;    // Carteira padrão para novas transações
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};
```

### Tipo `WalletTransaction` (histórico de movimentações)

```typescript
type WalletTransaction = {
  id: string;
  tenantId: string;
  walletId: string;
  type: WalletTransactionType; // "deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "adjustment"
  amount: number;              // Sempre positivo; tipo determina direção
  description: string;
  relatedWalletId?: string;    // Preenchido em transferências
  relatedTransactionId?: string;
  balanceAfter: number;        // Saldo da carteira após este evento
  createdAt: string;
  createdBy: string;
};
```

Coleção Firestore: `wallet_transactions`. Campos de movimentação são registrados pelo backend a cada operação que altera saldo.

---

## CRITICO: Arquitetura de saldo desnormalizado

**O campo `balance` no documento da carteira NAO é calculado on-the-fly.** Ele é mantido pelo backend usando `FieldValue.increment()` dentro de Firestore Transactions atômicas.

### Quando o saldo é alterado

| Operação | Backend responsável |
|----------|---------------------|
| Transação marcada como `paid` | `transaction.service.ts` — aplica `getWalletImpacts()` |
| Transação revertida para `pending` | `transaction.service.ts` — aplica delta reverso |
| Transferência entre carteiras | `wallets.controller.ts` — debita origem, credita destino |
| Ajuste manual | `wallets.controller.ts` — endpoint `POST /v1/wallets/adjust` |
| Criação de carteira com `initialBalance` | `wallets.controller.ts` — registra saldo inicial |

### Nunca calcular saldo no frontend

Não somar transações para obter saldo. O valor em `wallet.balance` é sempre autoritativo. O frontend só lê e exibe.

### Impacto nas transações

A lógica no `transaction.service.ts` calcula o delta entre `oldImpacts` e `newImpacts` usando a função `getWalletImpacts()`:

```
// Regra: só afeta saldo se status === "paid" E wallet está definido
impact = type === "income" ? +amount : -amount
```

---

## CRITICO: Migração ID vs NAME (abril/2025)

### O problema

O campo `wallet` nas transações financeiras (coleção `transactions`) pode ser:
- **Dado novo** (a partir de abril/2025): ID do documento Firestore da carteira (ex: `"389pG63xVHekTTyaK7tY"`)
- **Dado legado**: nome da carteira (ex: `"NuBank"`)

O backend resolve ambos via `resolveWalletRef()` em `functions/src/lib/finance-helpers.ts` — tenta match por ID primeiro, depois por nome.

### Impacto no frontend

**Exibir nome da carteira a partir do campo `transaction.wallet`:**
```typescript
// CORRETO
wallets.find(w => w.id === tx.wallet || w.name === tx.wallet)?.name ?? tx.wallet

// ERRADO — quebra para dados legados com nome
wallets.find(w => w.id === tx.wallet)?.name
```

**Popular WalletSelect em forms de edição (quando dado pode ser NAME):**
```typescript
// Resolver NAME → ID antes de passar ao WalletSelect
const resolvedWalletId = wallets.find(w => w.name === tx.wallet)?.id ?? tx.wallet;
```

**Filtros que usam ID de carteira:**
```typescript
// Comparar tanto por ID quanto por nome para suportar dados legados
tx.wallet === filterWallet || wallets.find(w => w.id === filterWallet)?.name === tx.wallet
```

**`WalletSelect` envia sempre `wallet.id` como value** desde a migração. Não reverter para `wallet.name`.

---

## `WalletSelect` — componente global

Localizado em `src/components/features/wallet-select.tsx`. Usado em:
- Forms de criação/edição de transações
- Forms de propostas (campo de carteira de parcelas e entrada)

### Props principais

```typescript
interface WalletSelectProps {
  label: string;
  value: string;           // wallet.id (nunca wallet.name)
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  error?: string;
  preSelectDefault?: boolean; // Auto-seleciona a carteira default no mount
  icon?: React.ReactNode;
}
```

### Comportamento

- Usa `useWalletsData()` internamente — faz seu próprio fetch
- Se não há carteiras cadastradas, exibe estado vazio com botão "Cadastrar Carteira"
- Se `preSelectDefault = true`, seleciona a carteira com `isDefault = true` no primeiro carregamento (ou a primeira da lista se não houver default)
- Emite um `WalletFormDialog` inline para criação rápida — ao criar, seleciona automaticamente a nova carteira pelo ID retornado

---

## Hook `useWalletsData`

Fornece estado e ações para toda a UI de carteiras.

### O que expõe

```typescript
interface UseWalletsDataReturn {
  wallets: Wallet[];
  summary: WalletSummary;   // { totalBalance, walletCount, activeWallets }
  isLoading: boolean;
  hasFinancial: boolean;    // Plano tem módulo financeiro?
  isPlanLoading: boolean;
  createWallet(data): Promise<string | null>;   // Retorna walletId ou null
  updateWallet(id, data): Promise<boolean>;
  deleteWallet(id, force?): Promise<boolean>;
  transferBalance(data): Promise<boolean>;
  adjustBalance(id, data): Promise<boolean>;
  setWalletAsDefault(id): Promise<boolean>;
  refreshData(): Promise<void>;
  getWalletTransactions(walletId): Promise<WalletTransaction[]>;
}
```

### Caching e anti-flickering

O hook usa `hasLoadedRef` (um `useRef<boolean>`) para não mostrar estado de carregamento em recarregamentos subsequentes (ex: ao voltar para a página). `isLoading = true` só na primeira carga.

```typescript
if (!hasLoadedRef.current) {
  setIsLoading(true);
}
// ... após fetch:
hasLoadedRef.current = true;
```

### Padrão de mutação

Toda ação que altera dados chama `fetchData()` após a operação para ressincronizar com o Firestore:

```typescript
const createWallet = async (data) => {
  const result = await WalletService.createWallet(data);
  await fetchData(); // Re-fetch sempre
  return result.walletId;
};
```

Não há atualização otimista no módulo de carteiras — o re-fetch é a fonte de verdade.

---

## Hook `useWalletsCtrl`

Camada de controle entre `useWalletsData` e a UI. Gerencia:

- **Estados de dialog**: `formDialogOpen`, `transferDialogOpen`, `adjustDialogOpen`, `deleteDialogOpen`, `archiveDialogOpen`, `historyDialogOpen`
- **`selectedWallet`**: carteira selecionada para a operação atual
- **Filtros**: `searchTerm`, `filterType` (`WalletType | "all"`), `filterStatus` (`"active" | "archived" | "all"`)
- **`filteredWallets`**: memo que aplica os 3 filtros sobre `wallets`
- **Estados de loading de ação**: `isDeleting`, `isArchiving`, `isTransferring`, `settingDefaultId`

### `showSkeleton`

```typescript
const showSkeleton =
  isLoading || isPlanLoading || isTransferring || settingDefaultId !== null;
```

Operações de transferência e troca de default mostram skeleton completo (re-fetch implícito após a ação).

---

## `WalletService` — resumo de endpoints

| Método | Endpoint backend | Firestore direto? |
|--------|-----------------|-------------------|
| `getWallets(tenantId)` | — | Sim (coleção `wallets`) |
| `getWalletById(id)` | — | Sim (doc único) |
| `getDefaultWallet(tenantId)` | — | Sim (query `isDefault == true`) |
| `createWallet(data)` | `POST v1/wallets` | Não |
| `updateWallet(id, data)` | `PUT v1/wallets/:id` | Não |
| `deleteWallet(id, force?)` | `DELETE v1/wallets/:id?force=true/false` | Não |
| `transferBalance(data)` | `POST v1/wallets/transfer` | Não |
| `adjustBalance(id, data)` | `POST v1/wallets/adjust` | Não |
| `getWalletTransactions(id, tenantId)` | — | Sim (coleção `wallet_transactions`) |
| `getSummary(tenantId)` | — | Sim (chama `getWallets` e agrega) |

Leituras Firestore são feitas diretamente do cliente por simplicidade (sem dados sensíveis). Mutações sempre passam pelo backend para garantir atomicidade com `FieldValue.increment()`.

---

## Acesso ao módulo (plano)

A página verifica `hasFinancial` via `usePlanLimits()`. Se o tenant não tem o módulo financeiro no plano, exibe `<UpgradeRequired />` em vez do conteúdo.

A verificação de plano acontece **após** o carregamento (para evitar flash de conteúdo). A ordem correta na `page.tsx` é:
1. `tenantLoading` → Skeleton
2. `!tenant && superadmin` → SelectTenantState
3. `showSkeleton` → Skeleton
4. `!hasFinancial` → UpgradeRequired
5. Conteúdo normal

---

## Conexão com o módulo de transações

- Transações referenciam carteiras pelo campo `wallet` (ID ou nome legado)
- `useFinancialData.ts` em `src/app/transactions/_hooks/` lê as carteiras para:
  - Exibir nome no card (resolver ID → nome)
  - Popular seletor nos forms de edição (resolver nome → ID)
  - Filtrar transações por carteira
  - Calcular saldo otimista local (para feedback imediato)
- Ao aprovar uma proposta, `syncApprovedProposalTransactions()` usa a carteira padrão do tenant como fallback quando `installmentsWallet` não está preenchida

---

## O que NÃO fazer

- **Nunca** calcular `balance` somando transações no frontend — usar sempre `wallet.balance` do documento Firestore
- **Nunca** usar `wallet.name` como identificador para referenciar carteiras em dados novos — usar `wallet.id`
- **Nunca** exibir `transaction.wallet` diretamente como nome — pode ser um ID; sempre resolver com `wallets.find(w => w.id === v || w.name === v)?.name ?? v`
- **Nunca** passar `wallet.name` para o `value` do `WalletSelect` — o componente espera `wallet.id`
- **Nunca** fazer mutações de saldo diretamente no Firestore do frontend — toda alteração de saldo deve passar pelo backend para manter atomicidade
- **Não** criar carteira diretamente no Firestore — usar `WalletService.createWallet()` que chama o backend (que registra o `WalletTransaction` de saldo inicial)
- **Não** deletar `wallet_transactions` manualmente — são o log de auditoria do saldo
- **Não** importar Firebase Admin SDK em componentes client-side
- **Não** usar nomes de carteiras como chave em maps de impacto de saldo — usar sempre IDs para dados novos, com fallback por nome para dados legados:
  ```typescript
  oldImpacts.get(w.name) || oldImpacts.get(w.id) || 0
  ```
