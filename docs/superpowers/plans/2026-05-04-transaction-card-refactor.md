# TransactionCard Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `transaction-card.tsx` (2085 lines) into a logic hook + a view component without changing any behavior.

**Architecture:**
- `_hooks/useTransactionCard.ts` — all state, computed values, and event handlers. Receives `TransactionCardProps` minus rendering concerns, returns everything the view needs.
- `_components/transaction-card.tsx` — view only. Calls `useTransactionCard`, renders JSX. No `useState`/`useMemo`/event handler logic inside.

This is the React "separation of concerns" pattern: hook owns the "what happens", component owns the "how it looks".

**Tech Stack:** React 19, TypeScript, Next.js App Router

---

### File Map

| Status | File | Responsibility |
|--------|------|---------------|
| Create | `apps/web/src/app/transactions/_hooks/useTransactionCard.ts` | All state + computed values + handlers |
| Modify | `apps/web/src/app/transactions/_components/transaction-card.tsx` | View only — calls hook, renders JSX |

---

### Task 1: Understand the full state/handler surface area

**Files:**
- Read-only: `apps/web/src/app/transactions/_components/transaction-card.tsx`

Before extracting, catalogue every `useState`, `useCallback`, `useMemo`, and event handler in the component. This determines the hook's return type.

- [ ] **Step 1: Read the component's full state surface**

Read `transaction-card.tsx` lines 118–735 (from state declarations through the last event handler before the `return` statement).

List every `useState` call, every `useMemo`, and every named handler function. You will see:

**State declarations:**
- `isUpdating`, `setIsUpdating`
- `updatingIds`, `setUpdatingIds`
- `extraCostToDelete`, `setExtraCostToDelete`
- `localIsExpanded`, `setLocalIsExpanded`
- `showEditBlockDialog`, `setShowEditBlockDialog`
- `isEditingAmount`, `setIsEditingAmount`
- `editAmountValue`, `setEditAmountValue`
- `isSavingAmount`, `setIsSavingAmount`
- `showExtraCostDialog`, `setShowExtraCostDialog`
- `editingExtraCost`, `setEditingExtraCost`
- `showPartialPaymentDialog`, `setShowPartialPaymentDialog`
- `partialPaymentTransaction`, `setPartialPaymentTransaction`
- `shareModalOpen`, `setShareModalOpen`

**Computed values (useMemo):**
- `isProposalGroup`, `installments`, `visibleExtraCosts`
- `installmentStatusCounts`
- `displayWallet`
- `isExpanded` (derived from controlled + local)
- `hasExpandableContent`

**Event handlers:**
- `handleToggleExpand`
- `handleShare`
- `handleStatusChange`
- `handleIndividualStatusChange`
- `handleAmountClick`, `handleAmountSave`
- `handleAddExtraCost`, `handleEditExtraCost`, `handleDeleteExtraCost`
- `handlePartialPaymentOpen`, `handlePartialPaymentClose`
- (any others you find in lines 350–735)

Verify your list is complete by reading the source. Add any you find that aren't listed above.

- [ ] **Step 2: No code yet — just read and verify the list**

This task is read-only. Proceed to Task 2.

---

### Task 2: Create `useTransactionCard.ts`

**Files:**
- Create: `apps/web/src/app/transactions/_hooks/useTransactionCard.ts`

- [ ] **Step 1: Create the hook file**

Create `apps/web/src/app/transactions/_hooks/useTransactionCard.ts`:

```typescript
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Transaction, TransactionStatus, TransactionService } from "@/services/transaction-service";
import { Wallet } from "@/types";
import { useTransactionStatuses } from "./useTransactionStatuses";

export interface TransactionCardHandlers {
  // — state —
  isUpdating: boolean;
  updatingIds: Set<string>;
  extraCostToDelete: string | null;
  setExtraCostToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  localIsExpanded: boolean;
  showEditBlockDialog: boolean;
  setShowEditBlockDialog: React.Dispatch<React.SetStateAction<boolean>>;
  isEditingAmount: boolean;
  setIsEditingAmount: React.Dispatch<React.SetStateAction<boolean>>;
  editAmountValue: number;
  setEditAmountValue: React.Dispatch<React.SetStateAction<number>>;
  isSavingAmount: boolean;
  showExtraCostDialog: boolean;
  setShowExtraCostDialog: React.Dispatch<React.SetStateAction<boolean>>;
  editingExtraCost: {
    id?: string;
    amount: number;
    description: string;
    wallet?: string;
    parentTransactionId?: string;
  } | null;
  setEditingExtraCost: React.Dispatch<React.SetStateAction<TransactionCardHandlers["editingExtraCost"]>>;
  showPartialPaymentDialog: boolean;
  partialPaymentTransaction: Transaction | null;
  shareModalOpen: boolean;
  setShareModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // — computed —
  isProposalGroup: boolean;
  installments: Transaction[];
  visibleExtraCosts: any[];
  installmentStatusCounts: { paid: number; total: number } | null;
  displayWallet: string | undefined;
  isExpanded: boolean;
  hasExpandableContent: boolean;
  typeInfo: any;
  statusInfo: any;
  isProposalLinked: boolean;
  extraCostLabel: string;
  extraCostToDeleteParentId: string;
  extraCostToDeleteId: string | null;
  statusOptions: ReturnType<typeof useTransactionStatuses>["statuses"];
  // — handlers —
  handleToggleExpand: () => void;
  handleShare: (e: React.MouseEvent) => void;
  handleStatusChange: (newStatus: TransactionStatus) => Promise<void>;
  handleIndividualStatusChange: (tx: Transaction, newStatus: TransactionStatus) => Promise<void>;
  handleAmountClick: (e: React.MouseEvent) => void;
  handleAmountSave: () => Promise<void>;
  handleAddExtraCost: () => void;
  handleEditExtraCost: (ecId: string, parentTxId: string) => void;
  handleDeleteExtraCost: (ecId: string, parentTxId: string) => Promise<void>;
  handlePartialPaymentOpen: (tx: Transaction) => void;
  handlePartialPaymentClose: () => void;
  formatDate: (dateString: string) => string;
}
```

Then add the `useTransactionCard` function signature and paste all state, useMemo, and handler bodies verbatim from `transaction-card.tsx`:

```typescript
export function useTransactionCard(
  transaction: Transaction,
  relatedInstallments: Transaction[],
  proposalGroupTransactions: Transaction[],
  canEdit: boolean,
  wallets: Wallet[],
  onUpdate?: (...args: any[]) => Promise<any>,
  onUpdateBatch?: (...args: any[]) => Promise<any>,
  onStatusChange?: (...args: any[]) => Promise<boolean>,
  onDelete?: (transaction: Transaction) => void,
  onRegisterPartialPayment?: (...args: any[]) => Promise<any>,
  onUpdateExtraCostStatus?: (...args: any[]) => Promise<any>,
  onReload?: () => Promise<void>,
  defaultExpanded?: boolean,
  controlledIsExpanded?: boolean,
  onToggleExpand?: (expanded: boolean) => void,
): TransactionCardHandlers {
  const { statuses: statusOptions } = useTransactionStatuses();
  const router = useRouter();
  const extraCostLabel = transaction.type === "income" ? "Acréscimo" : "Custo Extra";

  // Paste all useState declarations verbatim from transaction-card.tsx lines 118–172
  // Paste all useMemo declarations verbatim from transaction-card.tsx lines 173–349
  // Paste all handler functions verbatim from transaction-card.tsx lines 350–735

  return {
    // state
    isUpdating, updatingIds,
    extraCostToDelete, setExtraCostToDelete,
    localIsExpanded,
    showEditBlockDialog, setShowEditBlockDialog,
    isEditingAmount, setIsEditingAmount,
    editAmountValue, setEditAmountValue,
    isSavingAmount,
    showExtraCostDialog, setShowExtraCostDialog,
    editingExtraCost, setEditingExtraCost,
    showPartialPaymentDialog,
    partialPaymentTransaction,
    shareModalOpen, setShareModalOpen,
    // computed
    isProposalGroup, installments, visibleExtraCosts,
    installmentStatusCounts, displayWallet,
    isExpanded, hasExpandableContent,
    typeInfo, statusInfo, isProposalLinked,
    extraCostLabel, extraCostToDeleteParentId, extraCostToDeleteId,
    statusOptions,
    // handlers
    handleToggleExpand, handleShare,
    handleStatusChange, handleIndividualStatusChange,
    handleAmountClick, handleAmountSave,
    handleAddExtraCost, handleEditExtraCost, handleDeleteExtraCost,
    handlePartialPaymentOpen, handlePartialPaymentClose,
    formatDate,
  };
}
```

> **Critical:** Read `transaction-card.tsx` lines 118–735 in full before writing this file. Paste exact implementations — do not rely on these signatures as substitutes for the real code. The placeholders above are structural guides only.

- [ ] **Step 2: Compile check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "useTransactionCard" | head -20
```

At this point the file should parse cleanly. There will be duplicate identifier errors in transaction-card.tsx (we haven't modified it yet) — those are expected.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/transactions/_hooks/useTransactionCard.ts
git commit -m "refactor: extrair state e handlers do TransactionCard em hook dedicado"
```

---

### Task 3: Slim down `transaction-card.tsx` to view-only

**Files:**
- Modify: `apps/web/src/app/transactions/_components/transaction-card.tsx`

- [ ] **Step 1: Add the import**

At the top of `transaction-card.tsx`, after existing imports, add:

```typescript
import { useTransactionCard } from "../_hooks/useTransactionCard";
```

- [ ] **Step 2: Replace the function body**

Inside the `TransactionCard` function body, replace all `useState`, `useMemo`, and handler declarations with a single hook call:

```typescript
export function TransactionCard({
  transaction,
  relatedInstallments = [],
  proposalGroupTransactions = [],
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
  onUpdate,
  onUpdateBatch,
  onRegisterPartialPayment,
  onUpdateExtraCostStatus,
  onReload,
  defaultExpanded = false,
  isSelected = false,
  onToggleSelection,
  onToggleGroupSelection,
  selectedIds,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
  wallets = [],
}: TransactionCardProps) {
  const {
    isUpdating, updatingIds,
    extraCostToDelete, setExtraCostToDelete,
    localIsExpanded,
    showEditBlockDialog, setShowEditBlockDialog,
    isEditingAmount, setIsEditingAmount,
    editAmountValue, setEditAmountValue,
    isSavingAmount,
    showExtraCostDialog, setShowExtraCostDialog,
    editingExtraCost, setEditingExtraCost,
    showPartialPaymentDialog,
    partialPaymentTransaction,
    shareModalOpen, setShareModalOpen,
    isProposalGroup, installments, visibleExtraCosts,
    installmentStatusCounts, displayWallet,
    isExpanded, hasExpandableContent,
    typeInfo, statusInfo, isProposalLinked,
    extraCostLabel, extraCostToDeleteParentId, extraCostToDeleteId,
    statusOptions,
    handleToggleExpand, handleShare,
    handleStatusChange, handleIndividualStatusChange,
    handleAmountClick, handleAmountSave,
    handleAddExtraCost, handleEditExtraCost, handleDeleteExtraCost,
    handlePartialPaymentOpen, handlePartialPaymentClose,
    formatDate,
  } = useTransactionCard(
    transaction, relatedInstallments, proposalGroupTransactions,
    canEdit, wallets,
    onUpdate, onUpdateBatch, onStatusChange, onDelete,
    onRegisterPartialPayment, onUpdateExtraCostStatus, onReload,
    defaultExpanded, controlledIsExpanded, onToggleExpand,
  );

  // The `return (...)` JSX starts here — unchanged
```

- [ ] **Step 3: Delete all declarations that moved to the hook**

Delete everything between the destructuring call and the `return (` statement — i.e., all the `useState`, `useMemo`, and handler declarations that were in the original component. Keep only the `return (` JSX and the closing `}` of the function.

The remaining file should contain only:
1. `"use client"` directive
2. All imports (add `useTransactionCard`)
3. `interface TransactionCardProps`
4. `export function TransactionCard(...)` with a single `useTransactionCard(...)` call followed directly by `return (...)`

- [ ] **Step 4: Compile**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. If there are errors about identifiers used in JSX but not returned by the hook, add them to the hook's return value.

- [ ] **Step 5: Remove now-unused imports from `transaction-card.tsx`**

After the extraction, some imports may no longer be used in `transaction-card.tsx` (e.g., `useTransactionStatuses`, `useRouter`, `toast`, `TransactionService` — these moved into the hook). Run:

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep "is declared but"
```

Remove each flagged unused import from `transaction-card.tsx`.

- [ ] **Step 6: Final compile**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: zero errors, zero warnings about unused variables.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/transactions/_components/transaction-card.tsx
git commit -m "refactor: TransactionCard usa useTransactionCard, componente e view-only"
```

---

### Verification

```bash
wc -l apps/web/src/app/transactions/_components/transaction-card.tsx \
       apps/web/src/app/transactions/_hooks/useTransactionCard.ts
```

Expected:
- `transaction-card.tsx` ≈ 1350 lines (JSX only + interface + imports)
- `useTransactionCard.ts` ≈ 600 lines (all logic)

The JSX reduction is modest because the component already had sub-components imported. The value here is that all logic is now testable in isolation via `useTransactionCard`.

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: zero errors.

---

*TransactionCard Refactor Plan — 2026-05-04*
