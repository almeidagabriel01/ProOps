# Phase 15: Lia Frontend Chat UI - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete Lia chat interface: LiaPanel, all sub-components, and the `useAiChat` hook with SSE streaming. The backend is fully implemented (Phases 13–14) — this phase is purely frontend work.

Includes:
- Patching the generic proxy to support SSE passthrough
- `useAiChat.ts` hook (SSE parsing, streaming state, confirmation handshake)
- All 8 Lia UI components (LiaPanel, LiaChatWindow, LiaMessageBubble, LiaInputBar, LiaToolConfirmDialog, LiaToolResultCard, LiaUsageBadge, LiaTriggerButton)
- Session continuity for Pro/Enterprise via Firestore load on open

Does NOT include: security middleware, billing page AI section, or E2E tests (Phases 16–17).

</domain>

<decisions>
## Implementation Decisions

### SSE Proxy Streaming

- **Approach:** Patch the generic proxy at `src/app/api/backend/[...path]/route.ts`. When the upstream response has `Content-Type: text/event-stream`, skip `arrayBuffer()` and return `new NextResponse(upstreamResponse.body, ...)` as a direct passthrough.
- **Timeout:** Override the 30s `REQUEST_TIMEOUT_MS` for SSE responses — use 60 seconds to match the backend fallback timeout.
- **Stream failure handling:** On network error or stream abort mid-response, keep whatever partial tokens arrived and append a red error indicator to the bubble: `[resposta interrompida]`. Do not discard partial content.

### Trigger Button

- **Placement:** Standalone `position: fixed` button at `bottom-6 right-6` — always visible, independent of the BottomDock which auto-hides on scroll. Never inside the dock.
- **Open state:** When the panel is open, the trigger button transforms from a chat/sparkle icon to an ×. Clicking × closes the panel. No separate close button needed in the panel header.
- **Notification indicator:** When the panel is closed and Lia finishes a response, show a small pulse/dot indicator on the trigger button to draw attention.

### Conversation History UX

- **Pro/Enterprise — open behavior:** Auto-resume last session. The panel opens with the most recent conversation already loaded. A "New Chat" button in the header starts a fresh session.
- **Session boundary:** New session auto-starts after 4 hours of idle time. User can also manually start a new session via "New Chat" button at any time.
- **Starter tenants:** Panel opens with an empty chat showing a greeting bubble + 2–3 contextual quick-action chips based on `usePathname()` (e.g., on `/proposals`: "Listar propostas abertas", "Criar nova proposta").
- **Free tenants:** Trigger button and panel not rendered at all.

### Markdown Rendering

- **Library:** Add `react-markdown` as a dependency. Full markdown support, integrates cleanly with Tailwind prose classes.
- **Streaming behavior:** While streaming, display raw text token by token (no markdown parsing). On receipt of the `done` SSE event, re-render the bubble with full markdown. Avoids flicker from half-parsed syntax.

### Carried Forward (locked in Phases 12–14)

- Panel: `<aside>` fixed right, width 420px, slide in/out with Tailwind transitions
- Free plan: trigger button + panel not rendered (check `planId !== 'free'`)
- SSE via `fetch` + `ReadableStream` (not `EventSource` — needs POST with body)
- Lia avatar: initials "LI" with tenant primary color (from TenantContext)
- Usage badge in panel header: `messagesUsed / messagesLimit`; turns warning color at ≥ 80%
- Input disabled with reset date tooltip when `messagesUsed >= messagesLimit`
- Delete confirmation: Lia calls `request_confirmation` → frontend shows `LiaToolConfirmDialog` → user confirms → hook resends with `confirmed: true`
- Starter: history in `useState` only (no Firestore). Pro/Enterprise: load from `aiConversations/{sessionId}`.

### Claude's Discretion

- Exact animation timing for panel slide and trigger button icon transition
- Trigger button icon (sparkle, chat bubble, or wand — pick what looks good with Tailwind)
- Dot-bounce vs CSS pulse animation for "Lia está digitando..." indicator
- Exact Tailwind prose config for react-markdown rendering
- How to display `LiaToolResultCard` expand/collapse state (disclosure vs Radix Collapsible)
- Quick-action chip suggestions per route (Claude can define sensible defaults per path)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Lia Design Decisions (source of truth)
- `.planning/phases/12-lia/12-CONTEXT.md` — Decisions #1–11: identity, streaming, panel positioning, confirmation flow, plan gating, session history, usage notification
- `.planning/phases/12-lia/12-PLAN.md` §Fase 4 — Component file list, implementation checklist, completion criteria
- `.planning/phases/12-lia/12-LIA-PROMPT.md` — System prompt structure (context for what Lia sends/receives)

### Tool Confirmation Flow
- `.planning/phases/14-lia-tool-system/14-CONTEXT.md` — `decisions > Confirmation Gate`: exact handshake flow (`request_confirmation` → modal → `confirmed: true` resend)

### Files to Patch / Integration Points
- `src/app/api/backend/[...path]/route.ts` — Proxy to patch for SSE passthrough (add `text/event-stream` detection before `arrayBuffer()`)
- `src/components/layout/protected-app-shell.tsx` — Where to mount `<LiaPanel />` and `<LiaTriggerButton />` (outside the scrollable `<main>`)
- `src/providers/tenant-provider.tsx` — Source of `planId`, `tenant.primaryColor`, `usePathname()` (already imported)

### Types & Auth
- `src/types/index.ts` — `Tenant` type with `planId`, `subscriptionStatus` fields
- `src/providers/auth-provider.tsx` — `useAuth()` for `user.uid` (needed for Firestore `aiConversations` path)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/dialog.tsx` — Radix Dialog, use for `LiaToolConfirmDialog`
- `src/components/ui/avatar.tsx` — Likely exists (check); use for Lia "LI" avatar bubble
- `src/components/ui/badge.tsx` — Use for `LiaUsageBadge`
- `src/components/ui/button.tsx` — Use for all buttons in the panel
- `cn()` from `src/lib/utils.ts` — Available for conditional Tailwind class merging
- `usePlanLimits()` from `src/hooks/usePlanLimits.ts` — May already expose `messagesUsed`/`messagesLimit` or a pattern to follow for AI usage
- `useThemePrimaryColor()` from `src/hooks/useThemePrimaryColor.ts` — For Lia avatar color

### Established Patterns
- `TenantContext` via `useTenant()` provides `planId`, `tenant.primaryColor`, already uses `usePathname()`
- `useAuth()` provides `user.uid`, `user.tenantId`
- All backend calls go through `/api/backend/*` — `useAiChat` should POST to `/api/backend/v1/ai/chat`
- Services layer (`src/services/`) for API calls — consider creating `src/services/ai-service.ts` following existing pattern

### Integration Points
- `ProtectedAppShell` (`src/components/layout/protected-app-shell.tsx`): mount `<LiaPanel>` and `<LiaTriggerButton>` here as siblings to `<main>`, inside the outer `div.flex.h-screen`
- The panel is `position: fixed` so it doesn't affect flex layout — can be placed anywhere in the tree
- `BottomDock` is already a sibling in the shell — Lia trigger must NOT be inside it

</code_context>

<specifics>
## Specific Ideas

- Panel header layout: `[LI avatar] Lia — Assistente ProOps  [usage badge] [••• menu with "New Chat"]`
- The `•••` menu (or "New Chat" as a direct icon button) handles session reset for Pro/Enterprise
- Greeting message for Starter: dynamic based on `usePathname()` — e.g., on `/proposals` → "Olá! Posso te ajudar com suas propostas hoje." + chips ["Ver propostas abertas", "Criar nova proposta"]
- For the pulse notification indicator on the trigger button: small absolute-positioned dot (red or primary color) that fades in on `done` event and disappears when panel is opened
- Error indicator on partial response: small inline badge at end of bubble, red background, text "Resposta interrompida" — not a toast, stays in the chat history

</specifics>

<deferred>
## Deferred Ideas

- Security middleware (`ai-auth.middleware.ts`) — Phase 16
- AI usage section on billing page — Phase 16
- Firestore rules for `aiUsage` and `aiConversations` — Phase 16
- E2E tests for all AI flows — Phase 17
- Session history browser (list of past sessions) — not in scope, could be Phase 17 or backlog
- Export conversation as CSV/JSON — deferred to v3.1 per Phase 12 decision
- Email notification at 80% usage — deferred to future phase (Phase 12 decision #10)

</deferred>

---

*Phase: 15-lia-frontend-chat-ui*
*Context gathered: 2026-04-13*
