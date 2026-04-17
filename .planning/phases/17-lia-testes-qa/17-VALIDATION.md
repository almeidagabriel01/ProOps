---
phase: 17
slug: lia-testes-qa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (already installed) |
| **Config file** | `playwright.config.ts` (root) |
| **Quick run command** | `npx playwright test e2e/ai/ --reporter=list` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~3 minutes (AI suite only); ~25 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test e2e/ai/ --reporter=list`
- **After every plan wave:** Run `npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~180 seconds (AI suite only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | AIQA-05 | seed | `npx tsx e2e/seed/run-seed.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | AIQA-05 | seed | `npx tsx e2e/seed/run-seed.ts` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | AIQA-01 | e2e | `npx playwright test e2e/ai/access-control.spec.ts` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | AIQA-01 | e2e | `npx playwright test e2e/ai/access-control.spec.ts` | ❌ W0 | ⬜ pending |
| 17-02-03 | 02 | 1 | AIQA-01 | e2e | `npx playwright test e2e/ai/access-control.spec.ts` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 1 | AIQA-02 | e2e | `npx playwright test e2e/ai/tool-execution.spec.ts` | ❌ W0 | ⬜ pending |
| 17-03-02 | 03 | 1 | AIQA-02 | e2e | `npx playwright test e2e/ai/tool-execution.spec.ts` | ❌ W0 | ⬜ pending |
| 17-04-01 | 04 | 2 | AIQA-03 | e2e | `npx playwright test e2e/ai/plan-limits.spec.ts` | ❌ W0 | ⬜ pending |
| 17-04-02 | 04 | 2 | AIQA-04 | e2e | `npx playwright test e2e/ai/plan-limits.spec.ts` | ❌ W0 | ⬜ pending |
| 17-05-01 | 05 | 2 | AIQA-04 | e2e | `npx playwright test e2e/ai/isolation.spec.ts` | ❌ W0 | ⬜ pending |
| 17-05-02 | 05 | 2 | AIQA-04 | e2e | `npx playwright test e2e/ai/isolation.spec.ts` | ❌ W0 | ⬜ pending |
| 17-05-03 | 05 | 2 | AIQA-04 | e2e | `npx playwright test e2e/ai/isolation.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Phase 17 test files are new — they must be created before any assertions can run:

- [ ] `e2e/seed/data/ai.ts` — TENANT_AI_TEST, USER_AI_ADMIN, USER_AI_MEMBER, USER_AI_STARTER constants + seedAiTenant()
- [ ] `e2e/pages/lia.page.ts` — LiaPage page object with selectors for trigger button, panel, badge, input, send button
- [ ] `e2e/ai/access-control.spec.ts` — stubs for AI-01, AI-02, AI-03
- [ ] `e2e/ai/tool-execution.spec.ts` — stubs for AI-04, AI-05, AI-07
- [ ] `e2e/ai/plan-limits.spec.ts` — stubs for AI-06, AI-08
- [ ] `e2e/ai/isolation.spec.ts` — stubs for AI-10, AI-11, AI-12
- [ ] Update `e2e/seed/seed-factory.ts` — add seedAiTenant() call + aiConversations/aiUsage to clearAll()
- [ ] Update `.github/workflows/push-checks.yml` — add GEMINI_API_KEY secret to e2e-push job env

*Existing Playwright infrastructure covers the runner — only new spec files and seed data needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI-04: Tool execution creates real Firestore data | AIQA-02 | Requires real GEMINI_API_KEY; skipped locally without it | In CI with GEMINI_API_KEY: `npx playwright test e2e/ai/tool-execution.spec.ts` — verify Firestore shows created document |
| AI-12: Delete confirmation dialog flow | AIQA-04 | Requires real AI response to trigger tool_call chunk | In CI with GEMINI_API_KEY: confirm dialog appears, clicking Cancel leaves data intact |

*If GEMINI_API_KEY unavailable locally, Group B tests (AI-04, AI-05, AI-07, AI-12) auto-skip via `test.skip()`.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
