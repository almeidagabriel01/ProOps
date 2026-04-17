---
phase: 14
slug: lia-tool-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (unit tests) — Firebase Emulator + curl for integration |
| **Config file** | none — no unit test runner configured in functions/ |
| **Quick run command** | `cd functions && npm run build` (TypeScript compile = fast feedback) |
| **Full suite command** | Firebase Emulators + curl per 12-PLAN.md Fase 3 criteria |
| **Estimated runtime** | ~15s (build); ~2min (emulator integration test) |

---

## Sampling Rate

- **After every task commit:** Run `cd functions && npm run build`
- **After every plan wave:** Firebase Emulator integration test (curl to `/v1/ai/chat`)
- **Before `/gsd:verify-work`:** Full suite must be green + Fase 3 success criteria met
- **Max feedback latency:** 15 seconds (build), 120 seconds (emulator integration)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| definitions.ts created | 01 | 1 | LIA-03 | build | `cd functions && npm run build` | ❌ W0 | ⬜ pending |
| schemas.ts created | 01 | 1 | LIA-03 | build | `cd functions && npm run build` | ❌ W0 | ⬜ pending |
| executor.ts created | 01 | 2 | LIA-03 | build + manual | build + curl create proposal | ❌ W0 | ⬜ pending |
| index.ts buildAvailableTools | 01 | 1 | LIA-03 | build + manual | build + curl check tools returned | ❌ W0 | ⬜ pending |
| chat.route.ts tool loop | 01 | 2 | LIA-03 | integration | curl + SSE stream end-to-end | existing | ⬜ pending |
| context-builder stub replaced | 01 | 1 | LIA-03 | build | `cd functions && npm run build` | existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `functions/src/ai/tools/definitions.ts` — all 29 FunctionDeclaration objects
- [ ] `functions/src/ai/tools/schemas.ts` — Zod schemas for mutating tools
- [ ] `functions/src/ai/tools/executor.ts` — executeToolCall() + handlers
- [ ] `functions/src/ai/tools/index.ts` — buildAvailableTools() real implementation

*No new test framework install required — TypeScript build is the primary fast-feedback loop. Integration verified manually with Firebase Emulators + curl.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Create proposal via Lia end-to-end | LIA-03 (SC4) | Requires Firebase Emulators + Gemini API key + SSE client | Start emulators, `curl -X POST /v1/ai/chat` with "Crie uma proposta para o cliente X" → verify proposal in Firestore |
| Module inactive → Lia refuses | LIA-03 (SC5) | Requires tenant with financial module inactive | Use tenant without financial access, ask Lia to create transaction → verify 403/refusal |
| Delete confirmation handshake | LIA-03 (SC3) | Two-turn flow via SSE | Ask Lia to delete contact → verify confirmation dialog data in SSE → resend with confirmed=true → verify deletion |
| planId gating | LIA-03 (SC1) | Requires different plan tenants | Log `buildAvailableTools()` output for starter vs pro tenant → verify financial tools absent for starter |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
