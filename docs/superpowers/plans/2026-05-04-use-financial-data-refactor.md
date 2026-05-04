# useFinancialData Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `useFinancialData.ts` (1454 lines) into 4 focused files without changing any behavior.

**Architecture:**
- `_lib/financial-utils.ts` — module-level pure helpers (type aliases, pure functions for grouping/sorting/display). No React, no hooks.
- `_hooks/useOptimisticWallets.ts` — wallet optimistic-update logic as a standalone hook. Receives wallets state setter, returns `calculateWalletImpacts`, `applyOptimisticWalletUpdate`, `applyOptimisticWalletUpdateBatch`.
- `_hooks/useFinancialFilters.ts` — all filter/sort state + derived `filteredTransactions` + `sortedTransactions` + `walletTotalBalance`. Receives raw transactions + wallets, returns filter state + setters + derived values.
- `_hooks/useFinancialData.ts` — orchestrator: data fetching, mutation handlers, composes the other three hooks. Exposes the same public interface as today.

**Tech Stack:** React 19, TypeScript, Firebase client SDK, Next.js App Router

---

### File Map

| Status | File | Responsibility |
|--------|------|---------------|
| Create | `apps/web/src/app/transactions/_lib/financial-utils.ts` | Pure helpers |
| Create | `apps/web/src/app/transactions/_hooks/useOptimisticWallets.ts` | Wallet optimism hook |
| Create | `apps/web/src/app/transactions/_hooks/useFinancialFilters.ts` | Filter/sort hook |
| Modify | `apps/web/src/app/transactions/_hooks/useFinancialData.ts` | Orchestrator (slimmed down) |

---

### Task 1: Create `_lib/financial-utils.ts`

**Files:**
- Create: `apps/web/src/app/transactions/_lib/financial-utils.ts`

This file gets all the module-level pure functions that live above the `useFinancialData` function declaration in the current file (lines 21–283).

- [ ] **Step 1: Read the current top of the file**

Read `apps/web/src/app/transactions/_hooks/useFinancialData.ts` lines 21–283 to identify all module-level declarations before the hook. You should find:
- `type DateLike`
- `const isDownPaymentLike`
- `const dateOnly`
- `const sameClient`
- `const baseDesc`
- `type AggregatedExtraCost`
- `const getTransactionExtraCosts`
- `const aggregateExtraCosts`
- `const getGroupedTransactionKey`
- `function getDateString`
- ... and any others between those lines

- [ ] **Step 2: Create the file**

Create `apps/web/src/app/transactions/_lib/financial-utils.ts`. Start with the necessary type imports and paste all those declarations verbatim, adding `export` in front of each:

```typescript
import type { Transaction, ExtraCost } from "@/services/transaction-service";

export type DateLike =
  | string
  | Date
  | { toDate: () => Date }
  | { toMillis: () => number }
  | { seconds: number }
  | null
  | undefined;

export type AggregatedExtraCost = ExtraCost & {
  parentTransactionId: string;
};

export const isDownPaymentLike = (t: Transaction): boolean =>
  !!t.isDownPayment || (t.installmentNumber || 0) === 0;

export const dateOnly = (value?: string): string => {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
};

// ... paste the remaining functions verbatim from the source file, each with export
```

Copy `sameClient`, `baseDesc`, `getTransactionExtraCosts`, `aggregateExtraCosts`, `getGroupedTransactionKey`, and `getDateString` verbatim from the source file.

- [ ] **Step 3: Compile check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors about duplicate identifiers (we haven't updated the source yet). The new file itself should parse cleanly — look for syntax errors only in `financial-utils.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/transactions/_lib/financial-utils.ts
git commit -m "refactor: extrair pure helpers do useFinancialData para financial-utils"
```

---

### Task 2: Create `useOptimisticWallets.ts`

**Files:**
- Create: `apps/web/src/app/transactions/_hooks/useOptimisticWallets.ts`

Extract `calculateWalletImpacts`, `applyOptimisticWalletUpdate`, `applyOptimisticWalletUpdateBatch` from `useFinancialData.ts` (lines ~891–968).

- [ ] **Step 1: Create the hook**

Create `apps/web/src/app/transactions/_hooks/useOptimisticWallets.ts`:

```typescript
"use client";

import * as React from "react";
import type { Transaction } from "@/services/transaction-service";
import type { Wallet } from "@/types";

export function useOptimisticWallets(
  setWallets: React.Dispatch<React.SetStateAction<Wallet[]>>,
) {
  const calculateWalletImpacts = React.useCallback(
    (tx: Partial<Transaction>) => {
      const impacts = new Map<string, number>();
      const addImpact = (
        wallet: string | null | undefined,
        amount: number,
        isIncome: boolean,
      ) => {
        if (!wallet) return;
        const delta = (isIncome ? 1 : -1) * (amount || 0);
        impacts.set(wallet, (impacts.get(wallet) || 0) + delta);
      };

      if (tx?.status === "paid" && tx?.wallet) {
        addImpact(tx.wallet, tx.amount || 0, tx.type === "income");
      }

      if (tx?.extraCosts && Array.isArray(tx.extraCosts)) {
        for (const ec of tx.extraCosts) {
          if (ec.status === "paid" && (ec.wallet || tx.wallet)) {
            addImpact(
              ec.wallet || tx.wallet,
              ec.amount || 0,
              tx.type === "income",
            );
          }
        }
      }
      return impacts;
    },
    [],
  );

  const applyOptimisticWalletUpdate = React.useCallback(
    (oldTx: Transaction | undefined, newTx: Transaction | undefined) => {
      setWallets((prev) => {
        const oldImpacts = oldTx ? calculateWalletImpacts(oldTx) : new Map();
        const newImpacts = newTx ? calculateWalletImpacts(newTx) : new Map();
        return prev.map((w) => {
          const oldVal = oldImpacts.get(w.name) || oldImpacts.get(w.id) || 0;
          const newVal = newImpacts.get(w.name) || newImpacts.get(w.id) || 0;
          const diff = newVal - oldVal;
          if (diff === 0) return w;
          return { ...w, balance: w.balance + diff };
        });
      });
    },
    [calculateWalletImpacts, setWallets],
  );

  const applyOptimisticWalletUpdateBatch = React.useCallback(
    (updates: { oldTx: Transaction; newTx: Transaction }[]) => {
      setWallets((prev) => {
        const netDeltas = new Map<string, number>();
        updates.forEach(({ oldTx, newTx }) => {
          const oldImpacts = calculateWalletImpacts(oldTx);
          const newImpacts = calculateWalletImpacts(newTx);
          for (const [wId, val] of oldImpacts.entries()) {
            netDeltas.set(wId, (netDeltas.get(wId) || 0) - val);
          }
          for (const [wId, val] of newImpacts.entries()) {
            netDeltas.set(wId, (netDeltas.get(wId) || 0) + val);
          }
        });
        return prev.map((w) => {
          const diff = netDeltas.get(w.id) ?? netDeltas.get(w.name) ?? 0;
          if (diff === 0) return w;
          return { ...w, balance: w.balance + diff };
        });
      });
    },
    [calculateWalletImpacts, setWallets],
  );

  return {
    calculateWalletImpacts,
    applyOptimisticWalletUpdate,
    applyOptimisticWalletUpdateBatch,
  };
}
```

> **Note:** Read lines 891–968 of `useFinancialData.ts` and paste the exact implementations — do not rely on the snippet above as a substitute if the real code differs.

- [ ] **Step 2: Compile check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "useOptimisticWallets" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/transactions/_hooks/useOptimisticWallets.ts
git commit -m "refactor: extrair logica optimista de carteiras em useOptimisticWallets"
```

---

### Task 3: Create `useFinancialFilters.ts`

**Files:**
- Create: `apps/web/src/app/transactions/_hooks/useFinancialFilters.ts`

Extract all filter/sort state and derived computed values from `useFinancialData`. This includes: `searchTerm`, `filterType`, `filterStatus`, `filterWallet`, `filterStartDate`, `filterEndDate`, `filterDateType`, `sortBy`, `viewMode` state declarations and their setters, plus `filteredTransactions`, `sortedTransactions`, `walletTotalBalance` derived values.

- [ ] **Step 1: Read the filter/sort section**

Read `useFinancialData.ts` from line 284 looking for all `useState` declarations for filters, and the `useMemo` blocks that compute `filteredTransactions`, `sortedTransactions`, `walletTotalBalance`.

- [ ] **Step 2: Create the hook**

Create `apps/web/src/app/transactions/_hooks/useFinancialFilters.ts`:

```typescript
"use client";

import * as React from "react";
import type { Transaction, TransactionType, TransactionStatus } from "@/services/transaction-service";
import type { Wallet } from "@/types";
import { normalize } from "@/utils/text";
import { dateOnly, getDateString, isDownPaymentLike, AggregatedExtraCost, aggregateExtraCosts, getGroupedTransactionKey } from "../_lib/financial-utils";
import { statusConfig } from "../_constants/config";
import { getProposalTransactionDisplayName } from "../_lib/proposal-transaction";

export function useFinancialFilters(
  transactions: Transaction[],
  wallets: Wallet[],
) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<TransactionType | "all">("all");
  const [filterStatus, setFilterStatus] = React.useState<TransactionStatus[]>(["pending"]);
  const [filterWallet, setFilterWallet] = React.useState<string>("");
  const [filterStartDate, setFilterStartDate] = React.useState<string>("");
  const [filterEndDate, setFilterEndDate] = React.useState<string>("");
  const [filterDateType, setFilterDateType] = React.useState<"date" | "dueDate">("dueDate");
  const [sortBy, setSortBy] = React.useState<"date" | "created">("created");
  const [viewMode, setViewMode] = React.useState<"grouped" | "byDueDate">("byDueDate");

  // Paste filteredTransactions useMemo verbatim from useFinancialData.ts
  const filteredTransactions = React.useMemo(() => {
    // ... copy verbatim from source
    return transactions; // placeholder — replace with exact source
  }, [transactions, searchTerm, filterType, filterStatus, filterWallet, filterStartDate, filterEndDate, filterDateType, wallets]);

  // Paste sortedTransactions useMemo verbatim from useFinancialData.ts
  const sortedTransactions = React.useMemo(() => {
    // ... copy verbatim from source
    return filteredTransactions; // placeholder — replace with exact source
  }, [filteredTransactions, sortBy, viewMode]);

  // Paste walletTotalBalance useMemo verbatim from useFinancialData.ts
  const walletTotalBalance = React.useMemo(() => {
    return wallets
      .filter((w) => {
        const isActive = w.isActive !== false;
        const matchesFilter = filterWallet ? (w.id === filterWallet || w.name === filterWallet) : true;
        return isActive && matchesFilter;
      })
      .reduce((sum, w) => sum + w.balance, 0);
  }, [wallets, filterWallet]);

  return {
    searchTerm, setSearchTerm,
    filterType, setFilterType,
    filterStatus, setFilterStatus,
    filterWallet, setFilterWallet,
    filterStartDate, setFilterStartDate,
    filterEndDate, setFilterEndDate,
    filterDateType, setFilterDateType,
    sortBy, setSortBy,
    viewMode, setViewMode,
    filteredTransactions,
    sortedTransactions,
    walletTotalBalance,
  };
}
```

> **Critical:** Replace the `// ... copy verbatim` placeholders with the exact `useMemo` bodies from `useFinancialData.ts`. Read the file and find the full implementations.

- [ ] **Step 3: Compile check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "useFinancialFilters" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/transactions/_hooks/useFinancialFilters.ts
git commit -m "refactor: extrair estado de filtros em useFinancialFilters"
```

---

### Task 4: Slim down `useFinancialData.ts` to orchestrator only

**Files:**
- Modify: `apps/web/src/app/transactions/_hooks/useFinancialData.ts`

Replace the inlined filter state, optimistic updaters, and pure helpers with calls to the three new hooks/modules. The public return value must be identical.

- [ ] **Step 1: Add imports for the new modules**

At the top of `useFinancialData.ts`, add:

```typescript
import { useOptimisticWallets } from "./useOptimisticWallets";
import { useFinancialFilters } from "./useFinancialFilters";
import {
  DateLike,
  AggregatedExtraCost,
  isDownPaymentLike,
  dateOnly,
  sameClient,
  baseDesc,
  getTransactionExtraCosts,
  aggregateExtraCosts,
  getGroupedTransactionKey,
  getDateString,
} from "../_lib/financial-utils";
```

- [ ] **Step 2: Replace inline state with hook calls**

Inside `useFinancialData`, remove the filter state declarations and replace with:

```typescript
const [wallets, setWallets] = React.useState<Wallet[]>([]);
const {
  searchTerm, setSearchTerm,
  filterType, setFilterType,
  filterStatus, setFilterStatus,
  filterWallet, setFilterWallet,
  filterStartDate, setFilterStartDate,
  filterEndDate, setFilterEndDate,
  filterDateType, setFilterDateType,
  sortBy, setSortBy,
  viewMode, setViewMode,
  filteredTransactions,
  sortedTransactions,
  walletTotalBalance,
} = useFinancialFilters(transactions, wallets);

const {
  calculateWalletImpacts,
  applyOptimisticWalletUpdate,
  applyOptimisticWalletUpdateBatch,
} = useOptimisticWallets(setWallets);
```

- [ ] **Step 3: Delete the now-redundant declarations**

Remove from `useFinancialData.ts`:
- All `useState` declarations for filters (searchTerm, filterType, etc.)
- All `useMemo` blocks for `filteredTransactions`, `sortedTransactions`, `walletTotalBalance`
- The `calculateWalletImpacts`, `applyOptimisticWalletUpdate`, `applyOptimisticWalletUpdateBatch` useCallback blocks
- All module-level pure function declarations (lines 21–283 in the original file)

- [ ] **Step 4: Full compile**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 5: Verify the return shape hasn't changed**

The return statement of `useFinancialData` must still return the same keys as before. Read the return statement and confirm no keys were removed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/transactions/_hooks/useFinancialData.ts
git commit -m "refactor: useFinancialData usa hooks compostos (filtros, optimistic, utils)"
```

---

### Verification

```bash
wc -l apps/web/src/app/transactions/_hooks/useFinancialData.ts \
       apps/web/src/app/transactions/_hooks/useOptimisticWallets.ts \
       apps/web/src/app/transactions/_hooks/useFinancialFilters.ts \
       apps/web/src/app/transactions/_lib/financial-utils.ts
```

Expected:
- `useFinancialData.ts` ≈ 700 lines (was 1454)
- `useOptimisticWallets.ts` ≈ 80 lines
- `useFinancialFilters.ts` ≈ 200 lines
- `financial-utils.ts` ≈ 150 lines

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: zero errors.

---

*useFinancialData Refactor Plan — 2026-05-04*
