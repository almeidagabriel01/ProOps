# Phase 14: Lia — Tool System - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Source:** Confirmed decisions from /gsd:plan-phase invocation + 12-PLAN.md (Fase 3) + 12-TOOLS.md + 12-CONTEXT.md

<domain>
## Phase Boundary

This phase implements the complete tool execution layer for Lia.
The backend (Phase 13) already handles SSE streaming, usage tracking, conversation persistence, and the Express route `/v1/ai/chat`.
Phase 14 adds the **Tool System** so the Lia can take real actions in ProOps:

- `functions/src/ai/tools/definitions.ts` — All ToolDefinition objects (full schemas from 12-TOOLS.md)
- `functions/src/ai/tools/schemas.ts` — Zod validation schemas per tool
- `functions/src/ai/tools/executor.ts` — `executeToolCall()` dispatcher with double-validation + confirmation gate
- `functions/src/ai/tools/index.ts` — `buildAvailableTools()` filter logic (planId × role × active module)

Phase 14 does NOT cover: frontend Chat UI (Phase 15/Fase 4), security middleware (Phase 15/Fase 5), E2E tests (Phase 16/Fase 6).

</domain>

<decisions>
## Implementation Decisions

### Gating Logic (CONFIRMED)

- **Filter dimension: planId, role, active module** — `buildAvailableTools()` must filter by all three.
- **planId gating, not modules[]** — Tool availability is keyed on `planId` (starter / pro / enterprise), not on a `modules[]` array. The availability matrix in 12-TOOLS.md uses "Plano mínimo" column.
- The model never receives definitions for tools it isn't allowed to call — filtering happens server-side before sending to Gemini.
- Double-validation in executor: even if the model somehow calls a forbidden tool, `executeToolCall()` re-validates module + role before executing.

### Delete Behavior (CONFIRMED)

- **Hard delete in all services** — all delete operations are permanent (no soft-delete / archive).
- **All deletes are `severity: high`** — every `request_confirmation` call for a delete must pass `severity: "high"`.
- This applies to: `delete_proposal`, `delete_contact`, `delete_product`, `delete_transaction`, and any future delete tool.

### Service Layer Contract (UPDATED — 2026-04-13)

- **Tools call extracted service functions, never Firestore directly.**
- **Why updated:** Existing controllers are Express `(req, res)` handlers — they cannot be called as plain functions from the AI executor. Resolution: extract business logic from each controller into a pure service function (no req/res), then call that from both the controller and the executor.
- **Pattern:** For each affected controller, extract a `createXxx(params, tenantId)` / `deleteXxx(id, tenantId)` etc. pure async function. The controller becomes a thin wrapper.
- **Files to create/update:**
  - `functions/src/api/services/proposals.service.ts` — extract from `proposals.controller.ts`
  - `functions/src/api/services/contacts.service.ts` — extract from `clients.controller.ts`
  - `functions/src/api/services/products.service.ts` — extract from `products.controller.ts`
  - `functions/src/api/services/transactions.service.ts` — extract/extend from `transaction.service.ts` (may already exist in part)
  - `functions/src/api/services/wallets.service.ts` — extract from `wallets.controller.ts`
- **Scope limit:** Only extract the operations actually called by the AI tools (list, get, create, update, delete per domain). Do NOT refactor the entire controller — just the subset needed.
- `tenantId` is never accepted as a tool parameter — always injected from auth context.

### Confirmation Gate (CONFIRMED)

- `request_confirmation` is mandatory before ANY delete tool.
- Flow: Lia calls `request_confirmation` → frontend shows modal → user confirms → frontend resends with `confirmed: true` → handler executes.
- Handler signature for delete tools: check `confirmed === true` before executing. If `confirmed` is missing or false, return error.
- System prompt must instruct the model: "NUNCA execute delete sem chamar request_confirmation primeiro."

### Tool Definitions Source

- All tool definitions and availability matrix come from `12-TOOLS.md`.
- The full definitions are already specified there — executor.ts handlers map each tool name to the correct service call.

### Claude's Discretion

- Exact Zod schema strictness (e.g., whether `limit` has `.max()` enforcement at schema level or service level)
- Error message format returned from `executeToolCall()` on validation failure
- Whether `get_contact` / `get_product` tools should be added (not in 12-TOOLS.md currently, but logical counterparts to `get_proposal`)
- Log format for tool call audit trail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tool System Design
- `.planning/phases/12-lia/12-TOOLS.md` — All ToolDefinition schemas + availability matrix (source of truth)
- `.planning/phases/12-lia/12-CONTEXT.md` — Decisions #4 (confirmation flow), #7 (security/tool filtering), #8 (cost model)
- `.planning/phases/12-lia/12-PLAN.md` — Fase 3 section: file list, checklist, completion criteria

### Backend Core (already implemented — do not duplicate)
- `functions/src/ai/index.ts` — AI module barrel
- `functions/src/ai/context-builder.ts` — `buildSystemPrompt()`, `buildAvailableTools()` stub (to complete here)
- `functions/src/ai/model-router.ts` — `selectModel()` (already done in Phase 13)
- `functions/src/ai/usage-tracker.ts` — `checkAiLimit()`, `incrementAiUsage()` (already done)
- `functions/src/ai/conversation-store.ts` — `saveConversation()`, `loadConversation()` (already done)

### Services to call from tool handlers (existing — read before implementing handlers)
- `functions/src/api/controllers/proposals.controller.ts` — existing proposal CRUD
- `functions/src/api/controllers/contacts.controller.ts` — existing contact CRUD
- `functions/src/api/controllers/products.controller.ts` — existing product CRUD
- `functions/src/api/controllers/transactions.controller.ts` — existing transaction CRUD
- `functions/src/api/controllers/wallets.controller.ts` — existing wallet CRUD + transfers
- `functions/src/api/routes/` — to understand existing service signatures

### Types & Auth
- `functions/src/lib/auth-context.ts` — `AuthContext` type (tenantId, role, planId)
- `functions/src/shared/` — shared types used across controllers

</canonical_refs>

<specifics>
## Specific Ideas

### Files to create
```
functions/src/ai/tools/
├── index.ts        # buildAvailableTools() complete implementation
├── definitions.ts  # all ToolDefinition objects from 12-TOOLS.md
├── schemas.ts      # Zod schemas per tool
└── executor.ts     # executeToolCall() + per-tool handlers
```

### `buildAvailableTools()` filter logic
Filter inputs: `planId: 'starter' | 'pro' | 'enterprise'`, `role: 'admin' | 'member'`, `activeModules: string[]` (from tenant doc)

For each tool in the registry:
1. Check `planId >= tool.minPlan` (starter < pro < enterprise)
2. Check `role >= tool.minRole` (member < admin)
3. Check `tool.module === null || activeModules.includes(tool.module)`
Return only matching tools as Gemini-compatible function declarations.

### Availability matrix (from 12-TOOLS.md)

| Tool | Module | Min Role | Min Plan |
|------|--------|----------|----------|
| `get_tenant_summary` | — | member | starter |
| `search_help` | — | member | starter |
| `request_confirmation` | — | member | starter |
| `list_proposals` | proposals | member | starter |
| `get_proposal` | proposals | member | starter |
| `create_proposal` | proposals | member | starter |
| `update_proposal` | proposals | admin | starter |
| `update_proposal_status` | proposals | member | starter |
| `delete_proposal` | proposals | admin | starter |
| `list_contacts` | contacts | member | starter |
| `get_contact` | contacts | member | starter |
| `create_contact` | contacts | member | starter |
| `update_contact` | contacts | admin | starter |
| `delete_contact` | contacts | admin | starter |
| `list_products` | products | member | starter |
| `get_product` | products | member | starter |
| `create_product` | products | member | starter |
| `update_product` | products | admin | starter |
| `delete_product` | products | admin | starter |
| `list_transactions` | financial | member | pro |
| `create_transaction` | financial | member | pro |
| `list_wallets` | financial | member | pro |
| `create_wallet` | financial | admin | pro |
| `transfer_between_wallets` | financial | admin | pro |
| `delete_transaction` | financial | admin | pro |
| `pay_installment` | financial | admin | pro |
| `list_crm_leads` | crm | member | pro |
| `update_crm_status` | crm | member | pro |
| `send_whatsapp_message` | whatsapp | admin | enterprise |

### Confirmation handshake (decision #4 from 12-CONTEXT.md)
1. Model calls `request_confirmation` with `{ action, affectedRecords, severity: "high" }`
2. `executeToolCall()` returns `{ requiresConfirmation: true, confirmationData: {...} }` to the SSE stream
3. Frontend shows modal, user clicks "Confirmar"
4. Frontend resends the message with `confirmed: true` in the tool params
5. `executeToolCall()` checks `confirmed === true` and proceeds

</specifics>

<deferred>
## Deferred Ideas

- Frontend Chat UI components (LiaPanel, LiaChatWindow, etc.) — Phase 15 (Fase 4)
- Security middleware `ai-auth.middleware.ts` — Phase 15 (Fase 5)
- E2E tests for tool flows — Phase 16 (Fase 6)
- WhatsApp bulk message confirmation flow — out of scope for this phase
- `get_contact` / `get_product` individual lookup tools — not in 12-TOOLS.md, defer to discuss with user

</deferred>

---

*Phase: 14-lia-tool-system*
*Context gathered: 2026-04-13 from confirmed decisions + 12-PLAN.md + 12-TOOLS.md + 12-CONTEXT.md*
