---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: — AI Assistant
status: unknown
stopped_at: Completed 16-04-PLAN.md
last_updated: "2026-04-14T21:42:09.963Z"
progress:
  total_phases: 13
  completed_phases: 10
  total_plans: 38
  completed_plans: 34
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Propostas e gestão financeira funcionando com confiança — ciclo proposta → aprovação → cobrança não pode quebrar.
**Current focus:** Phase 16 — lia-seguranca-billing

## Current Position

Phase: 16 (lia-seguranca-billing) — EXECUTING
Plan: 2 of 4

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
| Phase 13-lia-backend-core P02 | 2 | 2 tasks | 2 files |
| Phase 13-lia-backend-core P03 | 20 | 2 tasks | 4 files |
| Phase 14-lia-tool-system P01 | 4 | 2 tasks | 5 files |
| Phase 14 P03 | 8 | 1 tasks | 1 files |
| Phase 14 P04 | 4 | 2 tasks | 3 files |
| Phase 15 P01 | 259 | 2 tasks | 6 files |
| Phase 15 P02 | 5 | 1 tasks | 1 files |
| Phase 15 P03 | 7 | 2 tasks | 2 files |
| Phase 15 P04 | 3 | 3 tasks | 3 files |
| Phase 15 P06 | 108 | 3 tasks | 3 files |
| Phase 15 P05 | 212 | 3 tasks | 3 files |
| Phase 15 P07 | 5 | 3 tasks | 2 files |
| Phase 15 P08 | 5 | 1 tasks | 2 files |
| Phase 15 P09 | 2 | 2 tasks | 2 files |
| Phase 15 P10 | 3 | 1 tasks | 1 files |
| Phase 16 P02 | 5 | 1 tasks | 1 files |
| Phase 16 P04 | 5 | 1 tasks | 1 files |

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
- [Phase 13-lia-backend-core]: Conversation store overwrites full document on save (no merge) — trimmed array always authoritative; createdAt preserved by pre-read
- [Phase 13-lia-backend-core]: buildAvailableTools returns [] stub — real tool definitions deferred to Phase 3 Tool System
- [Phase 13-lia-backend-core]: Promise<void> on async Express handler — use statement+return instead of return res.json() to satisfy TypeScript strict mode
- [Phase 13-lia-backend-core]: res.setTimeout(0) before SSE flushHeaders disables the 20s protected route timeout for streaming connections
- [Phase 13-lia-backend-core]: AI route mounted after notificationsRoutes at app.use('/v1/ai') — auth already enforced by global validateFirebaseIdToken middleware
- [Phase 14-lia-tool-system]: contacts.service.ts uses collection 'clients' (not 'contacts') matching existing controller convention
- [Phase 14-lia-tool-system]: createTransactionForAi always creates status 'pending' — avoids atomic wallet balance issues from AI-created paid transactions (carried from Phase 13 decision)
- [Phase 14-lia-tool-system P02]: format: "enum" required on EnumStringSchema in @google/generative-ai SDK v0.24.1 — plain enum array without format field fails TypeScript type check
- [Phase 14-lia-tool-system P02]: makeDeleteSchema() uses z.literal(true) with Zod v4 error callback syntax { error: () => "..." } not { errorMap: () => ({message: "..."}) }
- [Phase 14-lia-tool-system P02]: ADMIN_ROLES includes WK — WK is a functional-admin role needing admin-level tool access
- [Phase 14]: Proposal items mapped at executor boundary: AI schema uses productId+unitPrice, service uses name+price — resolveProposalItems() looks up product names from productsService.getProduct()
- [Phase 14]: FunctionResponsePart[] typed array satisfies sendMessageStream parameter in Gemini SDK v0.24+ — avoids discriminant union mismatch with plain object literals
- [Phase 15]: SSE passthrough: detect via upstream content-type header; SSE timeout 60s vs 30s standard; content-encoding added to SAFE_RESPONSE_HEADERS; sendChatMessage IIFE pattern returns AbortController immediately
    - [Phase 15 P02]: useAiChat isOpen captured in doSend closure to drive hasUnread — panel-closed on onDone sets hasUnread=true
    - [Phase 15 P02]: cancelAction injects synthetic model message client-side only — no backend round-trip for cancellation acknowledgement
    - [Phase 15 P02]: sendingRef (useRef boolean) prevents concurrent sends without triggering re-renders; AbortController ref enables clean stream cancellation
- [Phase 15]: user.id used instead of user.uid — project User type uses id field (not uid)
- [Phase 15]: isLoading in useLiaUsage derived from subscriptionKey comparison — required by react-hooks/set-state-in-effect lint rule; avoids synchronous setState in effect body
- [Phase 15]: getSummary tries object.message, then count, then array length before falling back to Concluido
- [Phase 15]: LiaToolConfirmDialog onOpenChange fires onCancel when Radix closes via Escape/backdrop
- [Phase 15]: react-markdown v10 does not accept className on ReactMarkdown component — wrap in div with prose classes
- [Phase 15]: Custom Tooltip API uses content prop (not Radix TooltipContent/TooltipTrigger) — adapted LiaInputBar accordingly
- [Phase 15]: [Phase 15-07]: PlanTier type is starter|pro|enterprise only — free tier does not exist in TypeScript; guard uses planTier !== undefined instead of planTier !== 'free'
- [Phase 15]: [Phase 15-07]: LiaContainer renders at root level in ProtectedAppShell as sibling to BottomDock — position:fixed components don't affect flex layout
- [Phase 15]: Free plan UI gating uses user?.role !== 'free' from useAuth — planTier maps free to starter so role is the only reliable free-plan signal
- [Phase 15]: clientName fallback placed after ...data spread in mapProposalDoc so it overrides any undefined value from Firestore
- [Phase 15]: [Phase 15-09]: Rendering layer uses ?? as avatar fallback and 'Cliente sem nome' as display fallback for undefined clientName
- [Phase 15]: user !== null explicit check before user.role access — optional chaining user?.role returns undefined when user is null, which !== 'free' evaluated to true (auth bypass); explicit null check closes this gap
- [Phase 16]: evaluateSubscriptionStatusAccess pure function — no telemetry inside check block; pastDueSince always passed from planProfile to preserve grace-period logic for past_due tenants
- [Phase 16]: Banner uses session-only useState so it reappears on page reload; only shown when isNearLimit=true AND isAtLimit=false to avoid double-warning at 100%

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-14T21:42:09.960Z
Stopped at: Completed 16-04-PLAN.md
Resume file: None
