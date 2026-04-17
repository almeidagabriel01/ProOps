---
phase: 14-lia-tool-system
verified: 2026-04-13T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Create a proposal via Lia end-to-end with Firebase emulators"
    expected: "Send a message to the /v1/ai/chat endpoint with emulators running, asking Lia to create a proposal for an existing contact. Lia should call create_proposal, the executor should write to Firestore, and the SSE stream should return the tool_result chunk with the new proposal ID."
    why_human: "End-to-end integration requires running Firebase emulators, seeding data, and observing SSE streaming behavior — cannot be verified with static code analysis alone."
---

# Phase 14: Lia Tool System Verification Report

**Phase Goal:** Lia can execute actions using a tool system wired into the Gemini multi-turn function calling loop
**Verified:** 2026-04-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `buildAvailableTools()` filters tools by planId, role, and active module before sending to the model | VERIFIED | `TOOL_REGISTRY` has 29 entries each with `minPlan`, `minRole`, `module`. `buildAvailableTools()` in `tools/index.ts` applies `PLAN_RANK` numeric comparison, `ADMIN_ROLES` set lookup, and `whatsappEnabled` flag check. Filter is wired into `chat.route.ts` line 111. |
| 2 | `executeToolCall()` validates module + role before executing and calls extracted service functions (never Firestore directly) | VERIFIED | Double-validation at lines 527-543 of `executor.ts`: plan rank check + admin role check before dispatch. All 5 service namespaces imported (`proposalsService`, `contactsService`, `productsService`, `walletsService`, named transaction functions). No `db.collection("proposals")`, `db.collection("clients")`, `db.collection("products")`, `db.collection("transactions")`, or `db.collection("wallets")` in `executor.ts`. |
| 3 | Every delete tool requires `confirmed === true` (preceded by `request_confirmation`) | VERIFIED | All 4 delete handlers (`delete_proposal`, `delete_contact`, `delete_product`, `delete_transaction`) gate on `ctx.confirmed !== true` — reads from `ToolCallContext.confirmed` which is populated from `body.confirmed` (request body, not model args). `request_confirmation` tool returns `requiresConfirmation: true` to prompt frontend modal. |
| 4 | Creating a proposal via Lia with emulators works end-to-end | NEEDS HUMAN | Cannot verify without running Firebase emulators with seeded data and observing SSE stream. Static code shows the full path is wired: `chat.route.ts` → `buildAvailableTools` → Gemini tool calling loop → `executeToolCall` → `proposalsService.createProposal` → Firestore write. |
| 5 | Attempting to create a transaction with financial module inactive → Lia refuses without executing | VERIFIED | Financial tools (`list_transactions`, `create_transaction`, etc.) have `minPlan: "pro"` in `TOOL_REGISTRY`. For a starter-plan tenant: (a) `buildAvailableTools()` excludes them from the model entirely — model never offers them; (b) if somehow invoked, `executeToolCall()` double-validates plan rank and returns error message at line 530. Per `14-RESEARCH.md`, `activeModules` field does not exist on tenant docs — plan tier is the gate. |

**Score:** 4/5 truths verified (SC4 needs human)

### Deferred Items

None — all 5 success criteria are addressed by Phase 14.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/api/services/proposals.service.ts` | 6 pure async functions (list, get, create, update, updateStatus, delete) | VERIFIED | 6 exported async functions confirmed. Imports `db` from `../../init`. All functions take explicit `tenantId` parameter. |
| `functions/src/api/services/contacts.service.ts` | 5 pure async functions (list, get, create, update, delete) | VERIFIED | 5 exported async functions confirmed. Uses `CLIENTS_COLLECTION = "clients"` constant — correct collection name. |
| `functions/src/api/services/products.service.ts` | 5 pure async functions (list, get, create, update, delete) | VERIFIED | 5 exported async functions confirmed. |
| `functions/src/api/services/wallets.service.ts` | 3 functions (list, create, transfer) | VERIFIED | 3 exported async functions. `transferBetweenWallets` uses `db.runTransaction()` with `FieldValue.increment()` for atomic balance at lines 107/145/149. |
| `functions/src/api/services/transactions.service.ts` | 4 AI-specific functions appended | VERIFIED | `listTransactionsForAi`, `createTransactionForAi`, `deleteTransactionForAi`, `payInstallmentForAi` found at lines 1896+ (appended after existing TransactionService class). |
| `functions/src/ai/tools/definitions.ts` | 29 FunctionDeclaration objects using SchemaType enum | VERIFIED | `TOOL_DEFINITIONS` record exported. 34 `name:` occurrences (29 tool names + nested parameter names). 146 `SchemaType.` usages — no raw string type literals. |
| `functions/src/ai/tools/schemas.ts` | Zod schemas for all mutating tools | VERIFIED | `ToolSchemas` record exported with `z.ZodType` annotation. `makeDeleteSchema()` factory confirmed using `z.literal(true)`. dd/MM/yyyy regex in `CreateTransactionArgsSchema`. |
| `functions/src/ai/tools/index.ts` | `buildAvailableTools()`, `TOOL_REGISTRY`, `ToolRegistryEntry` | VERIFIED | All three exports confirmed. `PLAN_RANK = { starter:1, pro:2, enterprise:3 }`, `ADMIN_ROLES = Set(MASTER, ADMIN, WK, SUPERADMIN)`. 29 TOOL_REGISTRY entries. |
| `functions/src/ai/tools/executor.ts` | `executeToolCall()`, `ToolCallContext`, `ToolCallResult`, all 29 handlers | VERIFIED | All three exports confirmed. `parseBrDate()` helper present. `HANDLERS` record defined. `ctx.confirmed !== true` gate on all 4 delete handlers. |
| `functions/src/ai/chat.route.ts` | Tool calling loop wired, stub removed | VERIFIED | Imports `buildAvailableTools` from `./tools/index` and `executeToolCall` from `./tools/executor`. `tools: tools.length > 0 ? tools : undefined` passed to `getGenerativeModel`. `MAX_TOOL_ROUNDS = 5` outer loop. `chat.sendMessageStream(functionResponseParts)` for multi-turn. `confirmed: body.confirmed` in `toolCtx`. No Phase 13 stub references. |
| `functions/src/ai/context-builder.ts` | Stub removed, system prompt updated | VERIFIED | `export function buildAvailableTools` is absent (stub removed). System prompt includes "Você tem acesso a tools" and `severity: "high"` delete instruction. |
| `functions/src/ai/index.ts` | Barrel exports tool system components | VERIFIED | Exports `buildAvailableTools`, `executeToolCall`, `ToolCallContext`, `ToolCallResult`, `ToolRegistryEntry` in addition to existing `aiRouter`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tools/index.ts` | `tools/definitions.ts` | `import TOOL_DEFINITIONS` | WIRED | Import confirmed on first lines of index.ts |
| `tools/index.ts` | `@google/generative-ai` | `FunctionDeclarationsTool` return type | WIRED | Return type `FunctionDeclarationsTool[]` confirmed |
| `tools/executor.ts` | `tools/index.ts` | `import TOOL_REGISTRY` | WIRED | `import { TOOL_REGISTRY } from "./index"` confirmed |
| `tools/executor.ts` | `tools/schemas.ts` | `import ToolSchemas` | WIRED | `import { ToolSchemas } from "./schemas"` confirmed |
| `tools/executor.ts` | `services/proposals.service.ts` | `import * as proposalsService` | WIRED | Confirmed in executor imports |
| `tools/executor.ts` | `services/contacts.service.ts` | `import * as contactsService` | WIRED | Confirmed in executor imports |
| `tools/executor.ts` | `services/products.service.ts` | `import * as productsService` | WIRED | Confirmed in executor imports |
| `tools/executor.ts` | `services/transactions.service.ts` | named AI-function imports | WIRED | `listTransactionsForAi`, `createTransactionForAi` imports confirmed |
| `tools/executor.ts` | `services/wallets.service.ts` | `import * as walletsService` | WIRED | Confirmed in executor imports |
| `chat.route.ts` | `tools/index.ts` | `import { buildAvailableTools }` | WIRED | Import confirmed, called at line 111 |
| `chat.route.ts` | `tools/executor.ts` | `import { executeToolCall }` | WIRED | Import confirmed, called inside tool loop |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `proposals.service.ts createProposal` | Firestore write | `db.collection("proposals")` | Yes — real document write | FLOWING |
| `contacts.service.ts` | Firestore queries | `db.collection("clients")` | Yes — real reads/writes | FLOWING |
| `wallets.service.ts transferBetweenWallets` | `balance` | `db.runTransaction()` + `FieldValue.increment()` | Yes — atomic Firestore transaction | FLOWING |
| `executor.ts create_transaction handler` | Delegates to `createTransactionForAi` | `transactions.service.ts` | Yes — always `status: "pending"`, real Firestore write | FLOWING |
| `chat.route.ts tool loop` | `result.data` | `executeToolCall()` → service → Firestore | Yes — real data returned via SSE `tool_result` chunk | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `cd functions && npx tsc --noEmit` | Exit 0, no errors | PASS |
| proposals.service.ts has 6 functions | `grep -c "export async function" proposals.service.ts` | 6 | PASS |
| contacts.service.ts has 5 functions | `grep -c "export async function" contacts.service.ts` | 5 | PASS |
| products.service.ts has 5 functions | `grep -c "export async function" products.service.ts` | 5 | PASS |
| transactions.service.ts has 4 AI functions | `grep -c "export async function.*ForAi"` | 4 | PASS |
| TOOL_REGISTRY has 29 entries | `grep -c "declaration: TOOL_DEFINITIONS"` | 29 | PASS |
| All delete handlers gate on ctx.confirmed | `grep -c "ctx.confirmed !== true"` | 4 | PASS |
| SSE text chunks use correct `content` field | `grep "content:" chat.route.ts` | `{ type: "text", content: text }` | PASS |
| End-to-end proposal creation via emulators | Requires running emulators + seed + curl | Not runnable statically | SKIP — needs human |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIA-03 | 14-01, 14-02, 14-03, 14-04 | Tool system for Lia AI assistant (from ROADMAP.md Phase 14) | SATISFIED | All 4 plans complete. 9 artifacts created/modified. TypeScript compiles. Tool loop wired end-to-end. |

**Note on LIA-03:** This requirement ID is not listed in `.planning/REQUIREMENTS.md` (which covers the Testing Suite milestone only). LIA-03 belongs to the Lia AI milestone tracked exclusively in ROADMAP.md. The requirement is satisfied by the implementation evidence above.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `executor.ts` — `search_help` handler | Returns static help message | Info | Intentional per plan — real help search explicitly deferred. The handler returns a useful response, not an empty stub. |
| `executor.ts` — `send_whatsapp_message` handler | Returns `success: false` with deferred message | Info | Intentional per plan — WhatsApp integration via Lia deferred to future phase. Tool is Enterprise-only so no starter/pro users affected. |

No blockers. No unintentional stubs. No empty implementations in data paths.

### Human Verification Required

#### 1. End-to-End Proposal Creation via Lia (SC4)

**Test:** Start Firebase emulators (`firebase emulators:start`). Seed at least one tenant with `planId: "pro"` or `"starter"`, one contact, and one product. Send a POST to `/api/v1/ai/chat` with a valid Firebase ID token and message: "Cria uma proposta para o contato [name] com o produto [name]". Observe the SSE stream.

**Expected:**
- SSE stream emits a `tool_call` chunk with `name: "create_proposal"` and populated args
- SSE stream emits a `tool_result` chunk with `success: true` and a new proposal ID
- Firestore emulator shows a new document in `proposals` collection under the tenant
- Lia's final text response confirms the proposal was created

**Why human:** Requires running Firebase emulators with live Firestore, a valid ID token, SSE stream consumption, and observation of both the network response and emulator state. Cannot be verified with static code analysis.

### Gaps Summary

No blocking gaps found. All 4 programmatically-verifiable success criteria pass. SC4 (end-to-end with emulators) requires human testing but the static code path is fully wired.

The two intentional stubs (`search_help` and `send_whatsapp_message`) are documented in plan design and do not block the phase goal.

---

_Verified: 2026-04-13_
_Verifier: Claude (gsd-verifier)_
