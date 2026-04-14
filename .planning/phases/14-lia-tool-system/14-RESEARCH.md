# Phase 14: Lia — Tool System - Research

**Researched:** 2026-04-13
**Domain:** Gemini function calling, tool dispatcher, service integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Gating logic:** `buildAvailableTools()` filters by planId × role × active module. Three dimensions, all required.
- **planId gating, not modules[]:** Tool availability keyed on `planId` (`starter` / `pro` / `enterprise`). No `modules[]` array exists on tenant docs — `whatsappEnabled` boolean is the WhatsApp gate.
- **Model never receives forbidden tool definitions** — filtering happens server-side before sending to Gemini.
- **Double-validation in executor:** `executeToolCall()` re-validates module + role before executing even if model calls a forbidden tool.
- **Hard delete in all services** — all deletes are permanent. No soft-delete.
- **All deletes are `severity: high`** — every `request_confirmation` for a delete passes `severity: "high"`.
- **Tools call existing services/controllers directly, never Firestore directly.**
- **Service map:** `delete_proposal` → `proposals.controller`, `create_contact` → `clients.controller`, `create_transaction` → `transactions.controller`, etc.
- **`tenantId` is never a tool parameter** — always injected from auth context.
- **`request_confirmation` is mandatory before ANY delete tool.**
- **Confirmation flow:** Lia calls `request_confirmation` → frontend shows modal → user confirms → frontend resends with `confirmed: true` → handler executes.
- **Delete handler check:** `confirmed === true` required before executing. Missing or false → return error.
- **System prompt rule:** "NUNCA execute delete sem chamar request_confirmation primeiro."
- **Tool definitions source:** All tool definitions and availability matrix come from `12-TOOLS.md`.

### Claude's Discretion

- Exact Zod schema strictness (e.g., whether `limit` has `.max()` at schema level or service level)
- Error message format returned from `executeToolCall()` on validation failure
- Whether `get_contact` / `get_product` tools should be added (not in 12-TOOLS.md)
- Log format for tool call audit trail

### Deferred Ideas (OUT OF SCOPE)

- Frontend Chat UI components (LiaPanel, LiaChatWindow, etc.) — Phase 15
- Security middleware `ai-auth.middleware.ts` — Phase 15
- E2E tests for tool flows — Phase 16
- WhatsApp bulk message confirmation flow
- `get_contact` / `get_product` individual lookup tools
</user_constraints>

---

## Summary

Phase 14 implements four files under `functions/src/ai/tools/`: `definitions.ts`, `schemas.ts`, `executor.ts`, and `index.ts`. The backend (Phase 13) is fully operational — SSE streaming, usage tracking, conversation persistence, and the Express route at `/v1/ai/chat` all exist. The `buildAvailableTools()` function in `context-builder.ts` currently returns an empty array stub, and the tool call branch in `chat.route.ts` logs but does not execute.

The Gemini SDK (`@google/generative-ai` v0.24.1, installed) uses `FunctionDeclarationsTool` with `functionDeclarations: FunctionDeclaration[]`. The `SchemaType` enum provides `OBJECT`, `STRING`, `NUMBER`, `BOOLEAN`, `ARRAY`, `INTEGER`. Tool definitions from `12-TOOLS.md` map directly to `FunctionDeclaration` objects — no translation layer required beyond using `SchemaType` enum values instead of string literals.

The existing service layer (controllers and `TransactionService`) uses Express `Request`/`Response` objects, not plain function calls. The tool executor cannot call controllers directly as Express handlers. It must replicate the Firestore operations inline or extract the shared business logic. The canonical approach for this codebase is to write direct Firestore calls inside executor handlers following the same patterns as the controllers, always with `tenantId` from auth context and `.limit()` on every query.

**Primary recommendation:** Implement `executor.ts` handlers as direct Firestore operations (not controller invocations), mirroring controller patterns exactly — same field names, same validation logic, same collection names.

---

## Project Constraints (from CLAUDE.md)

- No `Co-Authored-By` in commit messages
- Never call Firestore without `tenantId` filter — every query must scope to tenant
- New code uses `logger` from `../lib/logger` (GCP-structured JSON)
- Never log tokens, passwords, CPF, phone numbers, full emails
- TypeScript strict mode — no implicit `any`
- Files: kebab-case. Variables/functions: camelCase. Constants: UPPER_SNAKE_CASE
- `interface` for props/data shapes; `type` for unions/literals
- Import types with `import type {}` when possible
- `functions/src/ai/` follows the same build-to-CommonJS constraint — run `npm run build` before emulators
- All new Firestore collections need explicit security rules (DENY-by-default)
- Firestore queries need `.limit()` on every listing

---

## Standard Stack

### Core
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@google/generative-ai` | `^0.24.1` | Gemini SDK — `FunctionDeclarationsTool`, `FunctionDeclaration`, `SchemaType` | [VERIFIED: functions/package.json] |
| `zod` | `^4.3.6` | Parameter validation schemas per tool | [VERIFIED: functions/package.json] |
| `firebase-admin/firestore` | (via firebase-admin) | Firestore reads in executor handlers | [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `../lib/logger` | internal | Structured audit logging of tool calls | Every tool execution |
| `../lib/tenant-plan-policy` | internal | `TenantPlanTier` type, tier ordering | `buildAvailableTools()` plan comparison |
| `../../init` | internal | `db` Firestore instance | All executor handlers |

**No new npm installs required.** All dependencies are already installed.

---

## Architecture Patterns

### File Structure to Create
```
functions/src/ai/tools/
├── definitions.ts   # FunctionDeclaration objects for all 29 tools
├── schemas.ts       # Zod validation schemas for mutating tools
├── executor.ts      # executeToolCall() dispatcher + per-tool handlers
└── index.ts         # buildAvailableTools() — replaces stub in context-builder.ts
```

### Pattern 1: FunctionDeclaration Shape (Gemini SDK)

The SDK's `FunctionDeclaration` uses `FunctionDeclarationSchema` (not raw JSON Schema). Use `SchemaType` enum.

```typescript
// Source: functions/node_modules/@google/generative-ai/dist/generative-ai.d.ts
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

export const list_proposals: FunctionDeclaration = {
  name: "list_proposals",
  description: "Lista as propostas do tenant. Suporta filtro por status e busca por texto.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      status: {
        type: SchemaType.STRING,
        description: "Filtrar por status: draft, sent, approved, rejected (opcional)",
        enum: ["draft", "sent", "approved", "rejected"],
      },
      search: {
        type: SchemaType.STRING,
        description: "Busca por texto no título ou nome do cliente (opcional)",
      },
      limit: {
        type: SchemaType.NUMBER,
        description: "Número máximo de resultados. Default: 10. Máximo: 50.",
      },
    },
    required: [],
  },
};
```

### Pattern 2: `buildAvailableTools()` — Filter Logic

`context-builder.ts` has a stub that returns `[]`. Phase 14 replaces this by calling the real implementation from `tools/index.ts`. The filter compares plan tiers using a numeric rank map.

```typescript
// Source: 14-CONTEXT.md + ai.types.ts (planTier type)
import type { FunctionDeclarationsTool } from "@google/generative-ai";
import type { TenantPlanTier } from "../ai.types";

const PLAN_RANK: Record<Exclude<TenantPlanTier, "free">, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

interface ToolRegistryEntry {
  declaration: FunctionDeclaration;
  minPlan: Exclude<TenantPlanTier, "free">;
  minRole: "member" | "admin";
  module: string | null; // null = always available
}

export function buildAvailableTools(
  planTier: Exclude<TenantPlanTier, "free">,
  userRole: string,
  tenantData: { whatsappEnabled?: boolean },
): FunctionDeclarationsTool[] {
  const normalizedRole = userRole.toUpperCase();
  const isAdmin = ["MASTER", "ADMIN", "WK", "SUPERADMIN"].includes(normalizedRole);
  const rank = PLAN_RANK[planTier];

  const filtered = TOOL_REGISTRY.filter((entry) => {
    // Plan check
    if (PLAN_RANK[entry.minPlan] > rank) return false;
    // Role check
    if (entry.minRole === "admin" && !isAdmin) return false;
    // Module check — whatsapp uses boolean flag, others always active
    if (entry.module === "whatsapp" && !tenantData.whatsappEnabled) return false;
    return true;
  });

  if (filtered.length === 0) return [];
  return [{ functionDeclarations: filtered.map((e) => e.declaration) }];
}
```

**Key insight:** `activeModules` does not exist on tenant docs [VERIFIED: grep found no `activeModules` field]. Module gating for the 29 tools uses only `whatsappEnabled` as the boolean gate. All other modules (proposals, contacts, products, financial, CRM/kanban) are available to any tenant — they are gated only by `planId` and `role`, consistent with the availability matrix in `12-TOOLS.md`.

### Pattern 3: `executeToolCall()` Dispatcher

```typescript
// Source: 14-CONTEXT.md decisions, chat.route.ts stub
export interface ToolCallContext {
  tenantId: string;
  uid: string;
  role: string;
  planTier: Exclude<TenantPlanTier, "free">;
  confirmed?: boolean;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    action: string;
    affectedRecords: string[];
    severity: "low" | "high";
  };
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolCallContext,
): Promise<ToolCallResult> {
  // Double-validation: re-check access before executing
  const entry = TOOL_REGISTRY.find((e) => e.declaration.name === toolName);
  if (!entry) {
    return { success: false, error: `Tool desconhecida: ${toolName}` };
  }
  // ... plan/role validation ...

  // Dispatch to handler
  const handler = HANDLERS[toolName];
  if (!handler) {
    return { success: false, error: `Handler não implementado: ${toolName}` };
  }
  return handler(args, ctx);
}
```

### Pattern 4: How `chat.route.ts` Must Be Updated

The existing streaming loop in `chat.route.ts` detects `functionCall` parts but only logs them (Phase 13 stub). Phase 14 must replace this with actual execution. The Gemini function-calling protocol requires sending `functionResponse` parts back in the next turn.

```typescript
// Existing stub in chat.route.ts (lines 150-174) — Phase 14 replaces this
// The correct pattern per Gemini SDK: after receiving functionCall, send
// functionResponse as a new turn with chat.sendMessageStream([...parts])
```

**Important:** The Gemini SDK multi-turn function calling loop:
1. Stream detects `part.functionCall`
2. Call `executeToolCall(name, args, ctx)` → get result
3. If `requiresConfirmation === true` → send SSE chunk and end stream (wait for client resend with `confirmed: true`)
4. Otherwise → continue chat with `{ functionResponse: { name, response: result.data } }`

### Pattern 5: Service Signatures in This Codebase

Controllers are Express handlers — they cannot be called from the executor. The executor must replicate operations directly. Key patterns from the codebase:

**Proposals collection:** `"proposals"` with fields `tenantId`, `status`, `title`, `clientId`, `clientName`
**Clients collection:** `"clients"` (not `"contacts"`) — verified from `core.routes.ts` → `clients.controller.ts`
**Products collection:** `"products"` — from `products.controller.ts`
**Transactions collection:** `"transactions"` — from `transaction.service.ts`
**Wallets collection:** `"wallets"` — from `wallets.controller.ts`
**Kanban/CRM:** `"kanban_statuses"` — from `kanban.controller.ts` (columns only). Client CRM status is a field on `clients` docs — no separate CRM collection exists.

**Transaction create requires date as `YYYY-MM-DD`** (not `dd/MM/yyyy`) per `CreateTransactionSchema`:
```typescript
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD).")
```
The tool definition uses `dd/MM/yyyy` for user-facing input — **executor must convert format before writing to Firestore.**

**Wallet transfer** uses `transferValues` controller via `POST /wallets/transfer` with fields `fromWalletId`, `toWalletId`, `amount`. Balances are desnormalized with `FieldValue.increment()` inside a `db.runTransaction()` — the executor must replicate this atomically.

### Pattern 6: CRM Tools Mapping

`list_crm_leads` and `update_crm_status` from `12-TOOLS.md` operate on the `proposals` collection as a kanban/CRM pipeline view. They do NOT operate on `clients` documents. The kanban controller manages *column definitions* only (`kanban_statuses` collection). CRM "leads" in this context are proposals at various pipeline stages — `list_crm_leads` lists proposals filtered by status column, and `update_crm_status` moves a proposal to a different pipeline column by updating its `status` field.

[RESOLVED: A1] CRM tools operate on `proposals` collection (status field), not on client documents. No client-level CRM field is needed.

### Anti-Patterns to Avoid

- **Calling Express controllers as functions** — they expect `(req, res)` and call `res.json()`. The executor cannot use them. Use direct Firestore operations.
- **Accepting `tenantId` from model args** — always use `ctx.tenantId` from auth. The Zod schemas must NOT include a `tenantId` field.
- **Using string type literals** in `FunctionDeclaration` — use `SchemaType.OBJECT` etc., not `"object"`. The SDK type system enforces this.
- **Sending all 29 tools to Gemini when only a few apply** — this wastes context tokens and increases cost.
- **Executing delete without `confirmed === true` check** — must check even if model sends `confirmed: false` or omits it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod validation | Custom type guards | `z.safeParse()` | Already in the codebase everywhere |
| Firestore atomicity for wallet transfer | Manual read-then-write | `db.runTransaction()` | Race conditions on concurrent requests |
| Plan tier comparison | String comparison | `PLAN_RANK` number map | Avoids `"pro" > "starter"` string trap |
| Input sanitization | Custom trimmer | `sanitizeText()` from `../../utils/sanitize` | Already exists, strips XSS |

---

## Runtime State Inventory

Not applicable — this is a greenfield phase creating new files, not a rename/refactor.

---

## Common Pitfalls

### Pitfall 1: `clients` vs `contacts` Collection Name
**What goes wrong:** `12-TOOLS.md` uses "contacts" as the module name and `list_contacts` as tool names, but the Firestore collection is `"clients"` and the controller file is `clients.controller.ts`.
**Why it happens:** The tool names are user-facing ("contacts" sounds friendlier) but the DB was built with "clients".
**How to avoid:** In all executor handlers for contact tools, query `db.collection("clients")`.
**Warning signs:** Empty results or 404s when listing contacts.

### Pitfall 2: Date Format Mismatch
**What goes wrong:** Tool definitions use `dd/MM/yyyy` for dates (user-facing Brazilian format). Firestore/TransactionService expects `YYYY-MM-DD`.
**Why it happens:** The tool description is optimized for what the model should tell the user, not what Firestore stores.
**How to avoid:** Executor handlers for `create_transaction`, `list_transactions` must parse `dd/MM/yyyy` → `YYYY-MM-DD` before writing. Add a `parseBrDate(s: string): string` helper.
**Warning signs:** Invalid date errors from Zod in `transactions.controller.ts` schema.

### Pitfall 3: Wallet Balance Not Updated Atomically
**What goes wrong:** Creating a transaction with `status: "paid"` affects wallet balance. If executor writes transaction and updates wallet balance separately (non-atomically), a crash between the two leaves the DB inconsistent.
**Why it happens:** `TransactionService` (~1350 lines) handles this atomically but executor can't call it directly.
**How to avoid:** For `create_transaction` with `status: "paid"`, either (a) use `db.runTransaction()` for both writes, or (b) only allow `status: "pending"` via AI and require the user to mark as paid manually. The simpler safe approach: the `create_transaction` tool always creates with `status: "pending"` (simplest correct behavior for the AI use case).
**Warning signs:** Wallet `balance` field diverges from sum of paid transactions.

### Pitfall 4: `confirmed` Flag Not Checked on Resend
**What goes wrong:** Frontend resends the message with `confirmed: true` in the request body (`AiChatRequest.confirmed`). The executor receives the tool args, not the request body. The `confirmed` flag must be threaded from the request body into the `ToolCallContext`.
**Why it happens:** `AiChatRequest` has `confirmed?: boolean` at the top level, but `executeToolCall()` receives `args` from the model's function call. These are different objects.
**How to avoid:** Pass `body.confirmed` into `ToolCallContext.confirmed`. In delete handlers, check `ctx.confirmed === true`, not `args.confirmed`.
**Warning signs:** Delete always requires two rounds of confirmation even when user already confirmed.

### Pitfall 5: `buildAvailableTools()` Stub Not Replaced in `context-builder.ts`
**What goes wrong:** `context-builder.ts` still exports its own stub `buildAvailableTools()` returning `[]`. If `chat.route.ts` imports from `context-builder.ts`, tools never get sent to Gemini even after Phase 14 is complete.
**Why it happens:** The stub was intentionally placed in `context-builder.ts` for Phase 2 — Phase 14 must update `chat.route.ts` to import `buildAvailableTools` from `./tools/index` instead, and also update `context-builder.ts` to either remove its stub or delegate.
**How to avoid:** Update the import in `chat.route.ts`. Remove the stub from `context-builder.ts` or have it re-export from `./tools/index`.

### Pitfall 6: Tool Calling Loop Not Implemented in `chat.route.ts`
**What goes wrong:** The existing streaming loop in `chat.route.ts` (lines 150–174) detects `functionCall` parts but doesn't send `functionResponse` back. Without the response turn, Gemini doesn't produce a final text answer.
**Why it happens:** Phase 13 intentionally left this as a stub.
**How to avoid:** After calling `executeToolCall()`, if no confirmation is needed, send a second `chat.sendMessageStream()` with `{ functionResponse: { name, response } }` parts. This is a multi-turn loop — repeat until no more `functionCall` parts appear.
**Warning signs:** Gemini generates a function call but then the SSE stream ends with no text response.

---

## Code Examples

### Gemini function calling multi-turn loop (verified pattern)
```typescript
// Source: @google/generative-ai SDK types + Gemini documentation pattern
// After receiving functionCall in stream, send functionResponse:
const functionResponsePart = {
  functionResponse: {
    name: toolName,
    response: { result: toolResult },
  },
};
// Re-enter the stream with the function response
const followupStream = await chat.sendMessageStream([functionResponsePart]);
for await (const chunk of followupStream.stream) {
  // continue streaming text to SSE client
}
```

### Zod schema for a mutating tool (executor pattern)
```typescript
// Source: existing zod usage in controllers + 12-TOOLS.md schemas
import { z } from "zod";

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional().or(z.literal("")),
  document: z.string().max(20).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).trim().optional().or(z.literal("")),
});

// In executor handler:
const parse = CreateContactSchema.safeParse(args);
if (!parse.success) {
  return { success: false, error: parse.error.issues[0]?.message ?? "Dados inválidos." };
}
```

### Role normalization (matches existing pattern)
```typescript
// Source: auth-context.ts line 11 — same normalization used everywhere
const ADMIN_ROLES = new Set(["MASTER", "ADMIN", "WK", "SUPERADMIN"]);
const isAdmin = (role: string) => ADMIN_ROLES.has(role.toUpperCase());
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `buildAvailableTools()` stub returns `[]` | Phase 14 returns real `FunctionDeclarationsTool[]` | Model gains tool access |
| Tool calls logged but not executed (lines 150-174 chat.route.ts) | Executor dispatches to Firestore handlers | Lia can take real actions |
| `buildSystemPrompt()` says "Nenhuma tool está disponível" | Updated to reflect available tools | Model knows its capabilities |

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `@google/generative-ai` ^0.24.1 | Tool declarations (SchemaType, FunctionDeclaration) | Yes | Installed in functions/node_modules |
| `zod` ^4.3.6 | Schemas per tool | Yes | Installed in functions/node_modules |
| Firebase Emulators | Local testing | [ASSUMED: A2] | Required for integration test per 12-PLAN.md Fase 3 criteria |
| `GEMINI_API_KEY` | chat.route.ts (already checks) | [ASSUMED: A3] | Must exist in functions/.env.erp-softcode |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ~~The field name for CRM status on client documents~~ **(RESOLVED)** CRM tools operate on `proposals` collection as kanban pipeline view, not client docs. `update_crm_status` updates proposal `status` field. | Architecture Patterns — Pattern 6 | N/A — resolved by design |
| A2 | Firebase Emulators are functional on the dev machine for integration testing | Environment Availability | Cannot run Phase 3 completion criteria without emulators |
| A3 | `GEMINI_API_KEY` is set in `functions/.env.erp-softcode` | Environment Availability | Executor cannot be tested without a valid key |

**A1 resolved:** CRM tools (`list_crm_leads`, `update_crm_status`) operate on the `proposals` collection as a kanban pipeline view. No client-level CRM field is needed.

---

## Open Questions (RESOLVED)

1. **CRM field name on client documents** (RESOLVED)
   - What we know: `kanban.controller.ts` manages column definitions in `kanban_statuses`. Individual client CRM status must be a field on client docs.
   - **Resolution:** CRM tools (`list_crm_leads`, `update_crm_status`) operate on the `proposals` collection as a kanban pipeline view, not on client documents. `update_crm_status` updates the proposal `status` field. No client-level CRM field name is needed.


2. **`pay_installment` tool — installment data structure** (RESOLVED)
   - What we know: `TransactionService` handles installments. `pay_installment` marks a specific installment number as paid.
   - **Resolution:** Plan 14-02 implements `pay_installment` assuming each installment is a separate transaction document with `isInstallment: true`, `installmentNumber`, and `installmentGroupId` fields. The handler reads the transaction doc, verifies `isInstallment === true` and matches `installmentNumber`, then uses `db.runTransaction()` to mark as paid and update wallet balance. Requires emulator verification during execution to confirm the actual installment data structure matches.


---

## Validation Architecture

Config has `workflow._auto_chain_active: false` and no `nyquist_validation` key — treating as enabled (key absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in functions/ for unit tests (E2E via Playwright is in root) |
| Config file | None — Wave 0 gap |
| Quick run | Firebase Emulator + curl per 12-PLAN.md Fase 3 criteria |
| Full suite | `npm run test:e2e` (Phase 16 scope) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| Tool registry | `buildAvailableTools()` returns correct tools for each plan/role combo | unit | manual curl with emulator | No — Wave 0 |
| Gating | Pro tenant cannot call `list_transactions` without financial module | integration | curl to `/v1/ai/chat` | No — Wave 0 |
| Confirmation | Delete without `confirmed` returns confirmation request | integration | curl to `/v1/ai/chat` | No — Wave 0 |
| Execute create | Create proposal via Lia appears in Firestore | integration | curl + Firestore read | No — Wave 0 |

### Wave 0 Gaps
- [ ] No unit test file for `buildAvailableTools()` filter logic
- [ ] No unit test file for `executeToolCall()` dispatching
- Integration tests use Firebase Emulator per 12-PLAN.md Fase 3 success criteria — no automated command, manual verification

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | YES | Double-validation in executor: plan + role checked before every tool execution |
| V5 Input Validation | YES | Zod `safeParse()` on all tool args before any Firestore write |
| V2 Authentication | Inherited | Phase 13 middleware already validates Firebase ID token |
| V3 Session Management | Inherited | Phase 13 handles session/history |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Model calls forbidden tool (prompt injection bypasses tool filter) | Elevation of Privilege | Double-validation in `executeToolCall()` — re-check plan/role even for tools not in the filtered set |
| `tenantId` supplied as tool arg to access other tenant's data | Information Disclosure | `tenantId` never in tool params; always injected from `ctx.tenantId` (auth context) |
| Delete without confirmation (user manipulates model to skip `request_confirmation`) | Tampering | Executor checks `ctx.confirmed === true` regardless of model's `confirmed` arg |
| Mass data exfiltration via list tools | Information Disclosure | `.limit()` enforced on all list queries; max 100 for transactions, 50 for others |

---

## Sources

### Primary (HIGH confidence)
- `functions/node_modules/@google/generative-ai/dist/generative-ai.d.ts` — `FunctionDeclaration`, `FunctionDeclarationsTool`, `SchemaType` types
- `functions/src/ai/chat.route.ts` — existing SSE streaming loop and stub tool call branch
- `functions/src/ai/context-builder.ts` — `buildAvailableTools()` stub to replace
- `functions/src/ai/ai.types.ts` — `AiChatRequest.confirmed`, `AiChatChunk.toolResult`, `TenantPlanTier`
- `functions/src/api/routes/core.routes.ts` — confirms collection is `"clients"` not `"contacts"`
- `functions/src/api/controllers/clients.controller.ts` — `CreateClientSchema`, Firestore write pattern
- `functions/src/api/controllers/transactions.controller.ts` — `CreateTransactionSchema` with YYYY-MM-DD date
- `functions/src/api/controllers/wallets.controller.ts` — wallet CRUD patterns
- `.planning/phases/14-lia-tool-system/14-CONTEXT.md` — all locked decisions
- `.planning/phases/12-lia/12-TOOLS.md` — full tool definitions and availability matrix

### Secondary (MEDIUM confidence)
- `functions/src/lib/auth-context.ts` — `AuthContext` shape, role normalization to UPPERCASE
- `functions/src/lib/CLAUDE.md` — `tenant-plan-policy.ts` architecture, plan tier resolution

### Tertiary (LOW confidence)
- A1: CRM field name on client documents — not verified (clients.controller.ts list handler not read)
- A2/A3: Environment assumptions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in node_modules/package.json
- Architecture: HIGH — SDK types read directly from installed module; service patterns read from actual controllers
- Pitfalls: HIGH — identified from direct code inspection of stubs and service schemas
- CRM tool mapping: LOW — field name on client docs not verified

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain — Gemini SDK and Firestore patterns are stable)
