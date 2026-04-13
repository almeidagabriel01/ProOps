---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: — AI Assistant
status: executing
stopped_at: Completed 13-01-PLAN.md
last_updated: "2026-04-13T16:53:38.425Z"
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 20
  completed_plans: 16
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: — E2E Coverage Expansion
status: Executing Phase 12
stopped_at: Completed 10-01-PLAN.md
last_updated: "2026-04-09T14:22:14.488Z"
last_activity: 2026-04-09 -- Phase 10 execution started
progress:
  total_phases: 11
  completed_phases: 7
  total_plans: 21
  completed_plans: 16
  percent: 76
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Propostas e gestão financeira funcionando com confiança — ciclo proposta → aprovação → cobrança não pode quebrar.
**Current focus:** Phase 13 — lia-backend-core

## Current Position

Phase: 13 (lia-backend-core) — EXECUTING
Plan: 1 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| 8     | 2     | -     | -        |
| 9     | 1     | -     | -        |

**Recent Trend:**

- Last 5 plans: Phase 8 plan 1, Phase 8 plan 2, Phase 9 plan 1
- Trend: —

_Updated after each plan completion_
| Phase 12-lia P1 | 45 | 9 tasks | 2 files |
| Phase 13-lia-backend-core P01 | 2 | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Carry-forward decisions from v1.0 relevant to v2.0 work:

- Playwright for E2E (App Router compatibility), Firebase Emulators for test isolation
- Seed data uses Admin SDK emulator mode: initialize without cert() when FIREBASE_AUTH_EMULATOR_HOST is set
- CurrencyInput requires pressSequentially with cent digits — onChange is noop, keyboard-only input
- Radix DropdownMenuItem: use text filter not getByRole(menuitem) — items render as generic divs in Playwright
- Custom DropdownMenu portal pattern — body > div[style*='position: fixed'] with waitForFunction detection
- DatePicker Hoje uses dispatchEvent — fixed portal positioning requires non-viewport click bypass
- FIN-06 pattern: complex multi-step wizard creation via API (D-04) to avoid UI wizard complexity
- Registration form: inputs use readOnly to prevent autofill — must click() before fill() to unlock
- Step 2 StepNavigation uses default nextLabel="Próximo" (not "Continuar" like step 1)
- waitForURL must use URL predicate `(url) => url.pathname === "/"` not regex — regex matches full URL string not just path
- Email domain for registration tests: use gmail.com (has valid MX records); test.com is a parked domain with no MX records and fails backend DNS validation
- [Phase 12-lia]: Hard delete across all domains — Lia always uses request_confirmation for DELETE
- [Phase 12-lia]: Plan limits enforced in controllers — Lia tool executor handles 402/403, no duplication
- [Phase 12-lia]: aiChat as Express route /v1/ai/chat in existing monolith — reuses all middleware
- [Phase 13-lia-backend-core]: AI_LIMITS excludes free tier via TypeScript Exclude — free tier blocked at route level with 403 before usage tracking
- [Phase 13-lia-backend-core]: Enterprise complexity routing: keyword match in user message routes to gemini-2.5-pro-preview-05-06 (~20% of requests)
- [Phase 13-lia-backend-core]: Monthly AI usage auto-resets by design via new YYYY-MM document each month (merge:true) — no cron needed

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-13T16:53:38.422Z
Stopped at: Completed 13-01-PLAN.md
Resume file: None
