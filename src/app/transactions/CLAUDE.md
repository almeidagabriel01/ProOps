# CLAUDE.md — src/app/transactions/ (Módulo Financeiro)

> Leia esta seção inteira antes de tocar em qualquer arquivo desta pasta.

## Arquivos principais (frontend)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `_hooks/useFinancialData.ts` | Estado central: transactions, wallets, filtros, optimistic updates |
| `_hooks/useEditTransaction.ts` | Carrega e submete edição de lançamento/grupo |
| `_hooks/useTransactionForm.ts` | Criação de lançamentos |
| `_components/transaction-card.tsx` | Exibe lançamentos em cards agrupados |
| `_components/transaction-filters.tsx` | Filtros da listagem |
| `src/components/features/wallet-select.tsx` | Seletor de carteira (usado em todos os forms) |

## Migração ID vs NAME (CRÍTICO)

O `WalletSelect` foi migrado em abril/2025 para usar **wallet.id** como value (antes usava wallet.name).

- **Dados novos:** `transaction.wallet` = ID do Firestore (ex: `"389pG63xVHekTTyaK7tY"`)
- **Dados antigos:** `transaction.wallet` = nome da carteira (ex: `"NuBank"`)

### Regras de uso

**Display (render):** sempre resolver para nome antes de exibir:
```tsx
wallets.find(w => w.id === tx.wallet || w.name === tx.wallet)?.name ?? tx.wallet
```

**Forms de edição:** sempre resolver NAME → ID antes de popular o WalletSelect:
```typescript
// resolveWalletId() em useEditTransaction.ts faz isso automaticamente
wallets.find(w => w.name === tx.wallet)?.id ?? tx.wallet
```

**Filtros:** `filterWallet` armazena wallet ID. Match deve verificar ambos:
```typescript
tx.wallet === filterWallet || walletObj?.name === tx.wallet
```

**Optimistic updates:** o mapa de impacts pode ser keyed por NAME (antigo) ou ID (novo):
```typescript
oldImpacts.get(w.name) || oldImpacts.get(w.id) || 0
```

## Estrutura de Parcelamentos

Cada parcela = documento Firestore separado em `transactions`, ligadas por `installmentGroupId`.

```
installmentNumber: 0 → entrada (isDownPayment: true)
installmentNumber: 1 → 1ª parcela (âncora do grupo)
installmentNumber: 2, 3... → parcelas seguintes
```

Campos de grupo:
- `installmentGroupId` — liga parcelas entre si (`gen_{timestamp}` ou `proposal_installments_{proposalId}`)
- `proposalGroupId` — liga entrada + parcelas de uma proposta (`proposal_{proposalId}`)
- `proposalId` — referência direta à proposta

Entrada pode ter wallet diferente das parcelas (`downPaymentWallet`).

## Race conditions e guards (frontend)

- `updatingIdsRef` (Set) em `useFinancialData.ts` previne cliques duplos nos handlers: `updateTransactionStatus`, `updateTransaction`, `updateGroupStatus`
- `syncExtraCostsStatus()` está implementada tanto no frontend (otimismo) quanto no backend (autoridade)

## Guard: Proposta aprovada

Transações pagas vinculadas a propostas aprovadas **não podem** ser revertidas para pendente via UI. O backend rejeita a operação com erro explícito. Para reverter: primeiro reverter a proposta para rascunho.
