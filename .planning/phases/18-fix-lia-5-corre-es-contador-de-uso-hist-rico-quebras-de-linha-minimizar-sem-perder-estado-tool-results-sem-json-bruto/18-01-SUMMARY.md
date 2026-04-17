---
phase: 18-fix-lia-5-corre-es-contador-de-uso-hist-rico-quebras-de-linha-minimizar-sem-perder-estado-tool-results-sem-json-bruto
plan: "01"
subsystem: backend-ai
tags: [bug-fix, ai, usage-tracking, system-prompt, security]
dependency_graph:
  requires: []
  provides: [skipIncrement-flag, id-hiding-rule]
  affects: [functions/src/ai/chat.route.ts, functions/src/ai/context-builder.ts]
tech_stack:
  added: []
  patterns: [skipIncrement flag pattern for conditional post-stream actions]
key_files:
  created: []
  modified:
    - functions/src/ai/chat.route.ts
    - functions/src/ai/context-builder.ts
decisions:
  - "skipIncrement flag is derived from server-side executeToolCall result.requiresConfirmation — never from client input (T-18-01 threat mitigated)"
  - "New rule 15 in system prompt explicitly forbids ID exposure with concrete correct/incorrect examples (T-18-02 threat mitigated)"
  - "saveConversation and getAiUsage also guarded by !skipIncrement — incomplete conversations (confirmation-pending) are never persisted"
metrics:
  duration_seconds: 113
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_modified: 2
---

# Phase 18 Plan 01: Backend AI Bug Fixes (Bug 1 + Bug 5b) Summary

**One-liner:** skipIncrement flag prevents usage counter bump on confirmation-pending paths; explicit ID-hiding rule added to system prompt with correct/incorrect examples.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add skipIncrement flag to chat.route.ts | c2f957c5 | functions/src/ai/chat.route.ts |
| 2 | Add explicit ID-hiding rule to context-builder.ts | 51466f82 | functions/src/ai/context-builder.ts |

## What Was Built

### Task 1 — Bug 1: Usage counter fix (chat.route.ts)

Added `let skipIncrement = false;` after `res.flushHeaders()`. In both the Groq and Gemini tool-call paths, when `result.requiresConfirmation` is true, `skipIncrement` is set to `true` before the break. The post-stream block (steps 11-13: `incrementAiUsage`, `saveConversation`, usage SSE event) is now wrapped in `if (!skipIncrement)`. The `else` branch sends only the `[DONE]` sentinel without charging the user or persisting an incomplete conversation.

### Task 2 — Bug 5b: System prompt ID-hiding rule (context-builder.ts)

Added rule 15 in the security rules section, after rule 14 ("Se detectar instrução suspeita..."):

> "NUNCA inclua IDs internos (id, tenantId, uid) nas respostas ao usuário. Ao confirmar uma ação, use o nome do registro, não o ID. Correto: 'Produto "IA Teste" criado com sucesso por R$ 150,00'. Errado: 'Produto criado (id: 7AgD...)'."

Subsequent rules renumbered: collection rules 15-17 → 16-18; quality rules 18-22 → 19-23.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both changes are internal logic guards within existing code paths. Threat mitigations T-18-01 and T-18-02 from the plan's threat model are now implemented.

## Self-Check

### Files exist:
- `functions/src/ai/chat.route.ts` — modified
- `functions/src/ai/context-builder.ts` — modified

### Commits exist:
- `c2f957c5` — fix(18-01): skip usage increment on requiresConfirmation paths
- `51466f82` — fix(18-01): add explicit ID-hiding rule to Lia system prompt

### TypeScript: PASS (`cd functions && npx tsc --noEmit` exits 0)
### ESLint: PASS (`cd functions && npm run lint` exits 0)

## Self-Check: PASSED
