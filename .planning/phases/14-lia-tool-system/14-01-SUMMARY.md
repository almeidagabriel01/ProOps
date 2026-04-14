---
phase: 14-lia-tool-system
plan: "01"
subsystem: backend/services
tags: [ai, services, extraction, firestore, multi-tenant]
dependency_graph:
  requires: []
  provides:
    - functions/src/api/services/proposals.service.ts
    - functions/src/api/services/contacts.service.ts
    - functions/src/api/services/products.service.ts
    - functions/src/api/services/wallets.service.ts
    - functions/src/api/services/transactions.service.ts (AI functions appended)
  affects:
    - functions/src/api/services/transaction.service.ts (extended)
tech_stack:
  added: []
  patterns:
    - Pure async service functions extracted from Express controllers
    - tenantId always explicit parameter — never from request
    - Firestore Transaction for atomic balance operations
    - sanitizeText/sanitizeRichText on all user-provided strings
key_files:
  created:
    - functions/src/api/services/proposals.service.ts
    - functions/src/api/services/contacts.service.ts
    - functions/src/api/services/products.service.ts
    - functions/src/api/services/wallets.service.ts
  modified:
    - functions/src/api/services/transaction.service.ts
decisions:
  - "contacts.service.ts uses collection 'clients' (not 'contacts') matching the existing controller convention"
  - "createTransactionForAi always creates status 'pending' — avoids atomic wallet balance issues from AI-created paid transactions"
  - "roundCurrency already existed in transaction.service.ts — reused by appended AI functions"
  - "payInstallmentForAi resolves wallet by ID first, then by name — matches existing resolveWalletRef dual-lookup pattern"
  - "Multi-installment batch uses crypto.randomUUID() for installmentGroupId — matches existing TransactionService pattern"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 14 Plan 01: Service Extraction for AI Tool Executor Summary

Pure async service functions extracted from controllers into 5 service files, enabling the AI tool executor (Plan 14-03) to call business logic without Express req/res dependency — every function takes explicit tenantId, zero cross-tenant access possible.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create proposals.service.ts, contacts.service.ts, products.service.ts | e29a71c3 | 3 new files |
| 2 | Create wallets.service.ts and extend transactions.service.ts | 5f5df992 | 1 new + 1 modified |

## What Was Built

### proposals.service.ts (6 functions)
- `listProposals` — filtered by tenantId, optional status/search, max 50
- `getProposal` — read with tenantId guard
- `createProposal` — looks up client name from `clients` collection, maps items to products, calculates totalValue
- `updateProposal` — draft-only guard, recalculates totalValue when items change
- `updateProposalStatus` — enforces valid transitions (draft→sent, sent→approved/rejected), requires reason for rejection
- `deleteProposal` — tenantId guard, hard delete

### contacts.service.ts (5 functions)
- Uses collection `"clients"` (critical — NOT `"contacts"`)
- `listContacts`, `getContact`, `createContact`, `updateContact`, `deleteContact`
- createContact sets `source: "ai"` to distinguish AI-created contacts

### products.service.ts (5 functions)
- `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`
- createProduct initializes with `pricingModel: { mode: "standard" }` matching controller defaults

### wallets.service.ts (3 functions)
- `listWallets` — status=active filter, limit 50
- `createWallet` — enforces unique name per tenant before writing
- `transferBetweenWallets` — `db.runTransaction()` with `FieldValue.increment()` for atomic balance

### transactions.service.ts (4 AI functions appended)
- `listTransactionsForAi` — optional type/wallet/date range filters, max 100
- `createTransactionForAi` — always `status: "pending"`, multi-installment via batch with `randomUUID()` installmentGroupId
- `deleteTransactionForAi` — simple delete with tenantId guard
- `payInstallmentForAi` — `db.runTransaction()`, resolves wallet by ID then by name, applies `FieldValue.increment`

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Adjustments

1. **contacts.service.ts uses constant `CLIENTS_COLLECTION = "clients"`** — plan verification checks for `collection("clients")` literal, but a named constant conveys intent more clearly. Functionally identical.

2. **payInstallmentForAi wallet resolution** — Plan specified using `resolveWalletRef` from finance-helpers; that function requires a Firestore Transaction object and uses complex dual-lookup (ID then name). Implemented equivalent inline dual-lookup within the transaction to keep the service file self-contained and avoid importing transaction-specific helpers.

3. **`import { randomUUID } from "crypto"` at end of file** — TypeScript ESM-style `import` after class declaration is valid in the codebase's CommonJS compilation target (tsc emits it as a top-level require). Compiles cleanly.

## Verification Results

```
cd functions && npx tsc --noEmit  → Exit 0 (zero errors)

proposals.service.ts exported functions: 6
contacts.service.ts exported functions: 5
products.service.ts exported functions: 5
transactions.service.ts ForAi functions: 4
wallets.service.ts db.runTransaction calls: 1
```

## Known Stubs

None — all functions are fully implemented with real Firestore reads/writes.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. All functions are internal service layer — only callable from server-side code with an explicit tenantId sourced from auth context.

## Self-Check: PASSED

Files exist:
- `functions/src/api/services/proposals.service.ts` FOUND
- `functions/src/api/services/contacts.service.ts` FOUND
- `functions/src/api/services/products.service.ts` FOUND
- `functions/src/api/services/wallets.service.ts` FOUND
- `functions/src/api/services/transaction.service.ts` FOUND (modified)

Commits exist:
- `e29a71c3` FOUND
- `5f5df992` FOUND
