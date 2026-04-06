# Phase 1: Test Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 01-test-infrastructure
**Mode:** discuss
**Areas discussed:** Emulator lifecycle, Seed data strategy, OWASP ZAP locally, CI suite triggers

## Gray Areas Presented

| Area | Description | User selected? |
|------|-------------|----------------|
| Emulator lifecycle | Auto-start vs manual vs compound script | Yes |
| Seed data strategy | Once/globalSetup vs per-file reset vs hybrid/snapshots | Yes |
| OWASP ZAP locally | Docker ZAP vs lightweight local vs CI-only | Yes |
| CI suite triggers | Parallel every PR vs E2E-only on PR vs staged | Yes |

## Decisions Made

### Emulator Lifecycle
- **Decision:** Auto-start via Playwright `globalSetup`
- **Rationale:** Satisfies INFRA-01 "single command, no manual setup". Slightly longer startup but zero friction for developers.

### Seed Data Strategy
- **Decision:** Once per test run via `globalSetup`
- **Rationale:** Fastest approach. Tests that mutate data use create-then-delete fixtures within the test to avoid polluting shared seed state.

### OWASP ZAP Locally
- **Decision:** Full ZAP in CI only — lightweight local scanner for `npm run test:security`
- **Rationale:** ZAP is heavy (Java/Docker). Keeping full ZAP CI-only avoids Docker Desktop dependency for all developers. Local command still satisfies INFRA-03 spirit with a lighter tool.

### CI Suite Triggers
- **Decision:** Parallel jobs on every PR (E2E + Lighthouse + ZAP simultaneously)
- **Rationale:** Maximum coverage on every PR. Parallel jobs keep total wall time within <15 min constraint. All reports uploaded as downloadable artifacts.

## Corrections Made

No corrections — all first options accepted.
