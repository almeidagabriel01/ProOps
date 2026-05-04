# Transaction Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `transaction.service.ts` (2010 lines) into 3 focused files without changing any behavior.

**Architecture:**
- `transaction-helpers.ts` — private utility functions shared internally (pure math, data coercion, wallet impact calculation). No Firestore dependency.
- `transaction.service.ts` — `TransactionService` class only (~1440 lines after extraction). Imports helpers.
- `transaction-ai.service.ts` — AI tool functions (listTransactionsForAi, createTransactionForAi, deleteTransactionForAi, payInstallmentForAi). Imports helpers.

**Tech Stack:** TypeScript, Firebase Admin SDK, Firestore

---

### File Map

| Status | File | Responsibility |
|--------|------|---------------|
| Create | `apps/functions/src/api/services/transaction-helpers.ts` | Pure utility functions |
| Modify | `apps/functions/src/api/services/transaction.service.ts` | TransactionService class only |
| Create | `apps/functions/src/api/services/transaction-ai.service.ts` | AI tool functions |
| Verify | Any file that imports `transaction.service.ts` AI exports | Update import paths |

---

### Task 1: Create `transaction-helpers.ts` with all private utility functions

**Files:**
- Create: `apps/functions/src/api/services/transaction-helpers.ts`

Extract lines 51–287 from `transaction.service.ts`. These are the `UPDATABLE_TRANSACTION_FIELDS` constant and all private functions used internally by the class and by the AI functions. They have no Firestore I/O.

- [ ] **Step 1: Create the file**

Create `apps/functions/src/api/services/transaction-helpers.ts` with this content:

```typescript
import { Timestamp } from "firebase-admin/firestore";

export const UPDATABLE_TRANSACTION_FIELDS = new Set([
  "type",
  "description",
  "amount",
  "date",
  "dueDate",
  "status",
  "clientId",
  "clientName",
  "proposalId",
  "proposalGroupId",
  "category",
  "wallet",
  "isDownPayment",
  "downPaymentType",
  "downPaymentPercentage",
  "isInstallment",
  "installmentCount",
  "installmentNumber",
  "installmentGroupId",
  "installmentInterval",
  "isRecurring",
  "recurringGroupId",
  "paymentMode",
  "notes",
  "extraCosts",
  "isPartialPayment",
  "parentTransactionId",
]);

export function sanitizeTransactionUpdateData(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (UPDATABLE_TRANSACTION_FIELDS.has(key) && value !== undefined) {
      safe[key] = value;
    }
  });
  return safe;
}

export function roundCurrency(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function toNumber(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function toDateOnly(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return fallback;
}

export function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const asObj = value as {
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
  };
  if (typeof asObj?.toMillis === "function") {
    return asObj.toMillis();
  }
  const sec =
    typeof asObj?.seconds === "number"
      ? asObj.seconds
      : typeof asObj?._seconds === "number"
        ? asObj._seconds
        : undefined;
  const nanos =
    typeof asObj?.nanoseconds === "number"
      ? asObj.nanoseconds
      : typeof asObj?._nanoseconds === "number"
        ? asObj._nanoseconds
        : 0;
  if (typeof sec === "number") {
    return sec * 1000 + Math.floor(nanos / 1_000_000);
  }
  return 0;
}

export function getWalletImpacts(data: Record<string, any>): Map<string, number> {
  const impacts = new Map<string, number>();
  if (!data) return impacts;

  const type = data.type;
  const sign = type === "income" ? 1 : -1;

  const addImpact = (wallet: string | null | undefined, amount: number) => {
    if (!wallet || amount === 0) return;
    impacts.set(wallet, (impacts.get(wallet) || 0) + amount);
  };

  if (data.status === "paid" && data.wallet) {
    addImpact(data.wallet, sign * (toNumber(data.amount, 0) || 0));
  }

  if (data.extraCosts && Array.isArray(data.extraCosts)) {
    for (const ec of data.extraCosts) {
      if (ec.status === "paid" && (ec.wallet || data.wallet)) {
        addImpact(
          ec.wallet || data.wallet,
          sign * (toNumber(ec.amount, 0) || 0),
        );
      }
    }
  }

  return impacts;
}

export function syncExtraCostsStatus(
  extraCosts: any[],
  oldParentStatus: string,
  newParentStatus: string,
): any[] {
  if (!extraCosts?.length) return extraCosts;
  return extraCosts.map((ec) => {
    if (ec.status === oldParentStatus) {
      return { ...ec, status: newParentStatus };
    }
    return ec;
  });
}

export function isDownPaymentLikeDoc(data: Record<string, any>): boolean {
  return !!data.isDownPayment || (data.installmentNumber ?? -1) === 0;
}

export function normalizeOptionalString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value === null || value === undefined || value === "") return null;
  return null;
}

export function addDateMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1 + months, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
```

> **Note:** The `syncExtraCostsStatus`, `isDownPaymentLikeDoc`, `normalizeOptionalString`, and `addDateMonths` functions are extracted from their original inline location. Read `transaction.service.ts` lines 181–287 to copy their exact implementation before creating this file — paste verbatim, then add `export`.

- [ ] **Step 2: Compile to verify no syntax errors**

```bash
cd apps/functions && npx tsc --noEmit 2>&1 | head -30
```

Expected at this point: errors about `sanitizeTransactionUpdateData` etc. being redeclared (we haven't updated the source file yet). That's OK — just confirm the new file itself has no parse errors.

- [ ] **Step 3: Commit the new file**

```bash
git add apps/functions/src/api/services/transaction-helpers.ts
git commit -m "refactor: extrair helpers internos do transaction.service para arquivo dedicado"
```

---

### Task 2: Update `transaction.service.ts` to import from helpers

**Files:**
- Modify: `apps/functions/src/api/services/transaction.service.ts`

Remove the private function declarations (lines 51–287) and add a single import from `transaction-helpers.ts`.

- [ ] **Step 1: Add the import at the top of `transaction.service.ts`**

After the existing imports (around line 10), add:

```typescript
import {
  UPDATABLE_TRANSACTION_FIELDS,
  sanitizeTransactionUpdateData,
  roundCurrency,
  toNumber,
  toDateOnly,
  timestampToMillis,
  getWalletImpacts,
  syncExtraCostsStatus,
  isDownPaymentLikeDoc,
  normalizeOptionalString,
  addDateMonths,
} from "./transaction-helpers";
```

- [ ] **Step 2: Delete the now-redundant private function declarations**

Delete everything from line 51 through line 287 (the `UPDATABLE_TRANSACTION_FIELDS` constant declaration through the last private function body). Be precise: keep line 1–50 (imports + DTOs) and line 289+ (the `TransactionService` class).

Also delete the `addDateMonths` function at the bottom (lines ~1997–2010 in the original file) — it's now in helpers.

- [ ] **Step 3: Compile to verify**

```bash
cd apps/functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. If there are errors about missing imports, add the missing name to the import list in Step 1.

- [ ] **Step 4: Commit**

```bash
git add apps/functions/src/api/services/transaction.service.ts
git commit -m "refactor: transaction.service.ts importa helpers do modulo dedicado"
```

---

### Task 3: Create `transaction-ai.service.ts` and move AI functions

**Files:**
- Create: `apps/functions/src/api/services/transaction-ai.service.ts`
- Modify: `apps/functions/src/api/services/transaction.service.ts` (delete AI section)

The AI tool functions (lines 1731–1996 in the original) are semantically separate from the CRUD class — they're used by the AI executor, not by Express controllers.

- [ ] **Step 1: Create `transaction-ai.service.ts`**

Create `apps/functions/src/api/services/transaction-ai.service.ts`:

```typescript
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { roundCurrency, addDateMonths } from "./transaction-helpers";

const COLLECTION_NAME = "transactions";

export interface TransactionListItem {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  wallet: string;
  category: string;
}

export interface CreateTransactionForAiParams {
  type: "income" | "expense";
  description: string;
  amount: number;
  walletId: string;
  date: string;
  category?: string;
  installments?: number;
  proposalId?: string;
}
```

Then copy the bodies of `listTransactionsForAi`, `createTransactionForAi`, `deleteTransactionForAi`, and `payInstallmentForAi` verbatim from `transaction.service.ts` lines 1759–1996.

- [ ] **Step 2: Delete the AI section from `transaction.service.ts`**

Delete everything from the comment `// === AI Tool Service Functions ===` (line 1731) to the end of the file (line 2010). The file should now end at line 1729 with the closing brace of the `TransactionService` class.

Also remove the `import { randomUUID } from "crypto"` that was mid-file (it moves to `transaction-ai.service.ts`).

- [ ] **Step 3: Compile**

```bash
cd apps/functions && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/functions/src/api/services/transaction-ai.service.ts apps/functions/src/api/services/transaction.service.ts
git commit -m "refactor: separar AI tool functions do TransactionService em modulo proprio"
```

---

### Task 4: Update importers of the moved AI exports

**Files:**
- Find and update all files that `import { listTransactionsForAi }` etc. from `transaction.service.ts`

- [ ] **Step 1: Find all importers**

```bash
grep -r "listTransactionsForAi\|createTransactionForAi\|deleteTransactionForAi\|payInstallmentForAi\|TransactionListItem\|CreateTransactionForAiParams" apps/functions/src/ --include="*.ts" -l
```

- [ ] **Step 2: For each file found, update the import path**

Change:
```typescript
import { listTransactionsForAi, ... } from "./transaction.service";
// or
import { listTransactionsForAi, ... } from "../services/transaction.service";
```
To:
```typescript
import { listTransactionsForAi, ... } from "./transaction-ai.service";
// or
import { listTransactionsForAi, ... } from "../services/transaction-ai.service";
```

(Adjust relative path based on where the importing file lives.)

- [ ] **Step 3: Final compile**

```bash
cd apps/functions && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "refactor: atualizar importadores para novo transaction-ai.service"
```

---

### Verification

After all tasks complete:

```bash
wc -l apps/functions/src/api/services/transaction.service.ts \
        apps/functions/src/api/services/transaction-helpers.ts \
        apps/functions/src/api/services/transaction-ai.service.ts
```

Expected:
- `transaction.service.ts` ≈ 1450 lines (class only)
- `transaction-helpers.ts` ≈ 130 lines
- `transaction-ai.service.ts` ≈ 280 lines

```bash
cd apps/functions && npm run build 2>&1 | tail -5
```

Expected: no errors, emits to `apps/functions/lib/`.

---

*Transaction Service Refactor Plan — 2026-05-04*
