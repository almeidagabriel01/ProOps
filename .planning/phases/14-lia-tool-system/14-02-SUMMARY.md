---
phase: 14-lia-tool-system
plan: "02"
subsystem: backend/ai/tools
tags: [ai, tools, gemini, zod, validation, multi-tenant]
dependency_graph:
  requires:
    - functions/src/lib/tenant-plan-policy.ts
    - "@google/generative-ai SDK (v0.24.1)"
    - functions/src/api/services/*.service.ts (from Plan 01)
  provides:
    - functions/src/ai/tools/definitions.ts
    - functions/src/ai/tools/schemas.ts
    - functions/src/ai/tools/index.ts
  affects:
    - functions/src/ai/context-builder.ts (buildAvailableTools stub — still in place; Plan 03 will wire to this)
tech_stack:
  added: []
  patterns:
    - SchemaType enum values from @google/generative-ai — never string literals
    - makeDeleteSchema() factory with z.literal(true) — confirmation gate cannot be bypassed
    - PLAN_RANK numeric comparison for plan tier gating
    - ADMIN_ROLES Set for O(1) role lookup
    - Module gating: only whatsapp uses runtime tenantData flag; all others are plan+role only
key_files:
  created:
    - functions/src/ai/tools/definitions.ts
    - functions/src/ai/tools/schemas.ts
    - functions/src/ai/tools/index.ts
  modified: []
decisions:
  - "format: \"enum\" required on EnumStringSchema in @google/generative-ai SDK v0.24.1 — plain enum array without format field fails type check"
  - "z.ZodType (not z.ZodTypeAny) is the correct export from zod v4 for ToolSchemas Record type"
  - "ADMIN_ROLES includes WK role — WK is a functional-admin role in this codebase that needs admin-level tool access"
  - "contacts module and products module gated only by plan+role (no activeModules field exists on tenant docs per 14-RESEARCH.md)"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 14 Plan 02: Tool Definitions, Schemas, and buildAvailableTools() Summary

All 29 FunctionDeclaration objects implemented using SchemaType enum, Zod validation schemas for 19 mutating tools with a confirmation-gate factory, and a TOOL_REGISTRY filter that enforces planTier x role x module gating before any tool definition reaches the Gemini model.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create definitions.ts with all 29 FunctionDeclaration objects | 243b47af | definitions.ts |
| 2 | Create schemas.ts with Zod schemas and index.ts with buildAvailableTools() | 31ec496c | schemas.ts, index.ts |

## What Was Built

### definitions.ts — 29 FunctionDeclaration objects

All tool definitions keyed in the `TOOL_DEFINITIONS` record:
- **3 utility tools**: get_tenant_summary, search_help, request_confirmation
- **7 proposal tools**: list, get, create, update, update_status, delete
- **5 contact tools**: list, get, create, update, delete
- **5 product tools**: list, get, create, update, delete
- **7 financial tools**: list_transactions, create_transaction, list_wallets, create_wallet, transfer_between_wallets, delete_transaction, pay_installment
- **2 CRM tools**: list_crm_leads (pipeline), update_crm_status (kanban move)
- **1 WhatsApp tool**: send_whatsapp_message (Enterprise only)

All enum fields use `format: "enum"` per the EnumStringSchema type constraint in SDK v0.24.1.

### schemas.ts — Zod validation schemas for 19 mutating tools

- `makeDeleteSchema(idField)` factory — produces `z.literal(true)` on `confirmed` field, blocking bypass
- dd/MM/yyyy regex for date fields in transaction and installment schemas
- `ToolSchemas` record maps tool names to their schemas for executor double-validation
- Read-only tools (list_*, get_*) intentionally omitted — they are permissive by design

### index.ts — TOOL_REGISTRY + buildAvailableTools()

- `TOOL_REGISTRY` — 29 entries with `{ declaration, minPlan, minRole, module }`
- `PLAN_RANK` — `{ starter: 1, pro: 2, enterprise: 3 }` for numeric comparison
- `ADMIN_ROLES` Set — `{ MASTER, ADMIN, WK, SUPERADMIN }` for O(1) lookup
- `buildAvailableTools(planTier, userRole, tenantData)` — filters registry, returns `FunctionDeclarationsTool[]`
- WhatsApp module only included when `tenantData.whatsappEnabled === true`
- Empty array returned immediately if no tools pass the filter

## Deviations from Plan

### Minor Adjustments

1. **`format: "enum"` on enum fields** — The plan showed plain `enum` array in definitions, but the `@google/generative-ai` SDK v0.24.1 types require `EnumStringSchema` which mandates `format: "enum"`. Added accordingly; without it TypeScript compilation would fail.

2. **`ToolSchemas` type annotation** — Plan specified `Record<string, z.ZodType>`. Zod v4 exports `ZodType` (not `ZodTypeAny`) from `zod/v4/classic/schemas.d.ts`. Used `z.ZodType` which compiles correctly.

3. **`makeDeleteSchema` error callback** — Plan showed `{ errorMap: () => ({ message: "..." }) }`. Zod v4 uses `{ error: () => "..." }` syntax. Updated to match v4 API.

## Verification Results

```
cd functions && npx tsc --noEmit  → Exit 0 (zero errors)

Top-level tool entries in definitions.ts: 29
TOOL_REGISTRY entries in index.ts: 29
SchemaType enum usages in definitions.ts: 146
ToolSchemas entries (mutating tools): 19
```

## Known Stubs

The `buildAvailableTools` function in `context-builder.ts` still returns `[]` (it's the Phase 13 stub). Plan 03 (executor.ts) will update `chat.route.ts` to import `buildAvailableTools` from `./tools/index` instead. This stub does not affect the correctness of the new files — they are ready for consumption.

## Threat Flags

No new network endpoints introduced. The files are pure server-side logic called from the existing `/v1/ai/chat` route. Security surface analysis:

- T-14-04 (Elevation of Privilege): MITIGATED — `buildAvailableTools()` filters by planTier/role/module; model never receives forbidden tool declarations
- T-14-05 (Information Disclosure): MITIGATED — `whatsapp` module excluded unless `tenantData.whatsappEnabled === true`; financial tools excluded for starter plan
- T-14-06 (Tampering): MITIGATED — `z.literal(true)` on `confirmed` field in `makeDeleteSchema()` — passing `false` or omitting the field fails Zod parse

## Self-Check: PASSED

Files exist:
- `functions/src/ai/tools/definitions.ts` FOUND
- `functions/src/ai/tools/schemas.ts` FOUND
- `functions/src/ai/tools/index.ts` FOUND

Commits exist:
- `243b47af` FOUND
- `31ec496c` FOUND
