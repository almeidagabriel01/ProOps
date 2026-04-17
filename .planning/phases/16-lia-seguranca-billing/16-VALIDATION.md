---
phase: 16
slug: lia-seguranca-billing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (frontend) + TypeScript compiler |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run lint && npx tsc --noEmit && cd functions && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run lint && npx tsc --noEmit && cd functions && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | AIBI-04 | install | `npx shadcn@latest add progress` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | AIBI-02 | compile | `cd functions && npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 1 | AIBI-04 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-04-01 | 04 | 2 | AIBI-05 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest add progress` — install Shadcn Progress component (required by AIBI-04 AiUsageCard)

*Wave 0 is needed because the Progress component is not currently installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Free-tier 403 before stream starts | AIBI-01 | No automated test harness for streaming SSE | Call chat endpoint as free-tier tenant, confirm 403 before any bytes arrive |
| Inactive subscription 403 | AIBI-02 | Requires Stripe test data | Set subscription status to inactive, call chat endpoint, expect 403 |
| 429 with resetAt timestamp | AIBI-03 | Requires usage doc at limit | Manually set aiUsage count to limit in Firestore emulator, call endpoint, check response |
| Input bar disabled at limit | AIBI-03 | Browser testing needed | Observe UI when isAtLimit = true in useLiaUsage |
| Billing page AI usage section | AIBI-04 | Visual verification needed | Navigate to billing page, confirm AiUsageCard appears with progress bar and reset date |
| 80% warning banner dismissal | AIBI-05 | Browser interaction needed | Set usage to 80% of limit, confirm amber banner appears and can be dismissed |
| Firestore rules enforcement | AIBI-06 | Emulator test needed | Run `npm run test:rules` to confirm aiUsage read-only and aiConversations scoped to owner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
