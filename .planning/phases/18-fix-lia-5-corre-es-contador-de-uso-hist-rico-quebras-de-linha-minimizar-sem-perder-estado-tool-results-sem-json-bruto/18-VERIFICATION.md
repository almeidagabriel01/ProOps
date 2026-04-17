---
phase: 18-fix-lia-5-corre-es-contador-de-uso-hist-rico-quebras-de-linha-minimizar-sem-perder-estado-tool-results-sem-json-bruto
verified: 2026-04-15T20:00:00Z
status: human_needed
score: 11/11
overrides_applied: 0
human_verification:
  - test: "BUG-1: Trigger a tool call that sets requiresConfirmation=true (e.g. delete action) and observe the usage counter"
    expected: "Counter does NOT increment when the confirmation dialog appears; only increments after the user confirms and the action completes with a full stream"
    why_human: "requiresConfirmation path requires a running AI backend with a real tool call — cannot be verified by static analysis alone"
  - test: "BUG-2: Log in as a Pro/Enterprise user who has a previous session, then hard-refresh the page and open the Lia panel"
    expected: "Lia restores the previous conversation history from the stored session without starting a fresh session"
    why_human: "Race condition between tenantId availability and sessionId initialization — requires real auth context loading sequence in browser"
  - test: "BUG-3: Send a multi-line user message (press Shift+Enter to add newlines) and observe the displayed message"
    expected: "Line breaks are preserved visually in the sent message bubble; Lia responses with newlines also display with visible line breaks"
    why_human: "whitespace-pre-wrap and remark-breaks effects are only observable at render time in a real browser"
  - test: "BUG-4: Open the Lia panel, send a message, then close the panel by clicking the trigger button, then reopen it"
    expected: "All previous messages are still visible; no greeting bubble appears again; scroll position is preserved"
    why_human: "DOM preservation across open/close requires browser rendering — cannot verify React tree persistence statically"
  - test: "BUG-5A: Trigger a tool call and observe the tool result display in the chat"
    expected: "Tool result appears as a compact inline chip showing tool name and summary text; raw JSON is NOT visible until clicking 'Ver detalhes'"
    why_human: "Collapsed/expanded visual state requires browser interaction"
  - test: "BUG-5B: Ask Lia to create a product and observe the confirmation message"
    expected: "Lia confirms with human-readable text like 'Produto criado com sucesso' — no Firestore IDs (long alphanumeric strings) appear in the response"
    why_human: "LLM response content requires a live AI inference — cannot be verified statically"
---

# Phase 18: Lia Bug Fixes (5 Corrections) — Verification Report

**Phase Goal:** Fix 5 Lia bugs: (1) usage counter increments before stream completes, (2) history not restored on first session (race condition), (3) newlines lost in messages, (4) minimize panel resets state, (5a) tool results show raw JSON, (5b) system prompt exposes internal IDs.
**Verified:** 2026-04-15T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AI usage counter only increments after a complete successful stream (not on requiresConfirmation) | VERIFIED | `let skipIncrement = false` at chat.route.ts:178; set to `true` in Groq path (line 280) and Gemini path (line 376); `if (!skipIncrement)` guards all of `incrementAiUsage`, `saveConversation`, and the usage SSE event at line 407 |
| 2 | System prompt explicitly forbids exposing internal IDs in responses | VERIFIED | Rule 15 in context-builder.ts:96: "NUNCA inclua IDs internos (id, tenantId, uid) nas respostas ao usuário" with concrete correct/incorrect examples |
| 3 | User messages with newlines display with preserved line breaks | VERIFIED | `<span className="whitespace-pre-wrap">{message.content}</span>` at lia-message-bubble.tsx:44; conditional applies to `isUser || message.isStreaming` |
| 4 | Streaming Lia messages with newlines display with preserved line breaks | VERIFIED | Same `whitespace-pre-wrap` span at line 44 covers streaming messages (same conditional branch: `isUser \|\| message.isStreaming`) |
| 5 | Post-stream Lia messages render single newlines as br tags via remark-breaks | VERIFIED | `import remarkBreaks from "remark-breaks"` at line 4; `<ReactMarkdown remarkPlugins={[remarkBreaks]}>` at line 48; `"remark-breaks": "^4.0.0"` in package.json:68 |
| 6 | Tool results show as inline chip badges by default, not as bordered cards | VERIFIED | lia-tool-result-card.tsx:44: `inline-flex ... rounded-full border border-border bg-muted/40`; no `rounded-xl` card shape present; no `ChevronDown` import |
| 7 | Tool result JSON is only visible after clicking Ver detalhes | VERIFIED | `{formatResult(result)}` inside `<CollapsibleContent>` (lines 59-63); default `isOpen=false`; trigger text "Ver detalhes" / "Recolher" |
| 8 | Closing and reopening the panel preserves scroll position, messages, and streaming state | VERIFIED | lia-container.tsx renders `<LiaTriggerButton>` unconditionally (no `{!chat.isOpen && ...}` wrapper); panel component is always mounted |
| 9 | LiaTriggerButton is always mounted in the DOM (never conditionally rendered) | VERIFIED | lia-container.tsx:167-172: `<LiaTriggerButton isOpen={chat.isOpen} .../>` directly inside JSX fragment — no conditional wrapper |
| 10 | LiaTriggerButton fades out when panel is open, fades in when panel is closed | VERIFIED | lia-trigger-button.tsx:32-33: `isOpen ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100 hover:scale-105"` with `transition-all duration-300` |
| 11 | Pro/Enterprise session ID is restored from localStorage once tenantId and persistHistory are available; Starter never restores | VERIFIED | useLiaSession.ts:78: `useState<string>(generateSessionId)` (no localStorage); restoration useEffect at lines 85-93 with `isRestoredRef` guard; persist useEffect guards with `!isRestoredRef.current` at line 97 |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/ai/chat.route.ts` | skipIncrement flag prevents counter bump on confirmation-pending and error paths | VERIFIED | Contains `if (!skipIncrement)` at line 407; `skipIncrement = true` in both Groq (280) and Gemini (376) requiresConfirmation branches |
| `functions/src/ai/context-builder.ts` | Explicit rule about not exposing IDs in responses | VERIFIED | Contains `NUNCA inclua IDs internos (id, tenantId, uid)` at line 96 with correct/incorrect examples |
| `src/components/lia/lia-message-bubble.tsx` | whitespace-pre-wrap on user/streaming spans, remarkBreaks on ReactMarkdown | VERIFIED | Line 44: `whitespace-pre-wrap` on span; line 4: `import remarkBreaks`; line 48: `remarkPlugins={[remarkBreaks]}` |
| `src/components/lia/lia-tool-result-card.tsx` | Inline chip design for collapsed state | VERIFIED | `rounded-full` chip at line 44; `CollapsibleContent` wraps `<pre>` at lines 59-63 |
| `package.json` | remark-breaks dependency installed | VERIFIED | Line 68: `"remark-breaks": "^4.0.0"` |
| `src/components/lia/lia-container.tsx` | Always-rendered trigger button without conditional `{!chat.isOpen && ...}` | VERIFIED | No conditional wrapper found; `isOpen={chat.isOpen}` at line 168 |
| `src/components/lia/lia-trigger-button.tsx` | CSS transition for hide/show based on isOpen | VERIFIED | `"opacity-0 scale-75 pointer-events-none"` / `"opacity-100 scale-100 hover:scale-105"` at lines 32-33; `transition-all duration-300` at line 29 |
| `src/components/lia/lia-panel.tsx` | data-state attribute on aside element | VERIFIED | `data-state={isOpen ? "open" : "closed"}` at line 54 |
| `src/hooks/useLiaSession.ts` | isRestoredRef and useEffect-based restoration | VERIFIED | `useRef` imported at line 3; `isRestoredRef = useRef(false)` at line 79; restoration useEffect at lines 85-93; persist guard at line 97 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `functions/src/ai/chat.route.ts` | `usage-tracker.incrementAiUsage` | `if (!skipIncrement)` conditional | WIRED | Line 407: `if (!skipIncrement) { await incrementAiUsage(...)` — both Groq and Gemini confirmation paths set `skipIncrement = true` before break |
| `src/components/lia/lia-message-bubble.tsx` | `remark-breaks` | `remarkPlugins={[remarkBreaks]}` on ReactMarkdown | WIRED | Line 48: `<ReactMarkdown remarkPlugins={[remarkBreaks]}>` — plugin imported and applied |
| `src/components/lia/lia-container.tsx` | `src/components/lia/lia-trigger-button.tsx` | `isOpen={chat.isOpen}` prop controls visibility CSS, not conditional render | WIRED | Line 168: `isOpen={chat.isOpen}` — trigger always in DOM; visibility driven by CSS classes inside LiaTriggerButton |
| `src/hooks/useLiaSession.ts` | `localStorage` | `useEffect` restoration with `isRestoredRef` guard | WIRED | Lines 85-93: restoration useEffect reads localStorage only after `persistHistory && tenantId` are both defined; `isRestoredRef.current = true` ensures single execution |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `useLiaSession.ts` | `sessionId` | `generateSessionId()` initial + `localStorage` restoration useEffect | Yes — restoration useEffect reads actual localStorage key; no hardcoded session ID | FLOWING |
| `chat.route.ts` | `skipIncrement` | `result.requiresConfirmation` from `executeToolCall()` server-side | Yes — derived from actual tool execution result, not client input | FLOWING |
| `lia-message-bubble.tsx` | `message.content` | Props from parent (messages state in useAiChat) | Not applicable — rendering pipe; content comes from upstream SSE stream | FLOWING |
| `lia-tool-result-card.tsx` | `result` | Props passed from LiaMessageBubble via message.toolResults | Not applicable — rendering component; data sourced from SSE tool_result events | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for static artifacts (context-builder.ts, message-bubble.tsx, tool-result-card.tsx, trigger-button.tsx, panel.tsx) — rendering and AI behavior requires a live browser/backend session.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `remark-breaks` package installed | `grep "remark-breaks" package.json` | `"remark-breaks": "^4.0.0"` | PASS |
| `skipIncrement` guards usage increment | `grep "if (!skipIncrement)" chat.route.ts` | Line 407 found | PASS |
| No localStorage in useState initializer | `grep "localStorage.*useState" useLiaSession.ts` | No match | PASS |
| No conditional trigger render | `grep "!chat.isOpen &&" lia-container.tsx` | No match | PASS |
| All 6 phase commits exist in git | `git log --oneline --no-walk c2f957c5 51466f82 129b2caa c48f5b54 731d4bd2 b14621bf` | All 6 hashes resolved | PASS |

### Requirements Coverage

The PLAN frontmatter declares requirement IDs `BUG-1` through `BUG-5B`. These IDs are **internal phase identifiers** — they do not appear in `.planning/REQUIREMENTS.md` traceability table, which tracks CHAT-*, AIBI-*, AIQA-* IDs. The REQUIREMENTS.md traceability does not map any entry to Phase 18, and its coverage note states "Last updated: 2026-04-13 — v3.0 requirements added (phases 15–17)". Phase 18 is a bug-fix phase without formally tracked requirements in the requirements document.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-1 | 18-01-PLAN.md | Usage counter increments before stream completes | SATISFIED | `skipIncrement` flag guards `incrementAiUsage` call in both Groq and Gemini paths |
| BUG-2 | 18-03-PLAN.md | History not restored on first session (race condition) | SATISFIED | `useState(generateSessionId)` + deferred restoration `useEffect` with `isRestoredRef` |
| BUG-3 | 18-02-PLAN.md | Newlines lost in messages | SATISFIED | `whitespace-pre-wrap` span + `remark-breaks` plugin on ReactMarkdown |
| BUG-4 | 18-03-PLAN.md | Minimize panel resets state | SATISFIED | LiaTriggerButton always mounted; CSS opacity/scale/pointer-events transitions |
| BUG-5A | 18-02-PLAN.md | Tool results show raw JSON | SATISFIED | Chip design with `CollapsibleContent` hiding `<pre>` by default |
| BUG-5B | 18-01-PLAN.md | System prompt exposes internal IDs | SATISFIED | Rule 15 in context-builder.ts with explicit ID-hiding instruction |

Note: BUG-* IDs are not in REQUIREMENTS.md. No orphaned entries from REQUIREMENTS.md are mapped to Phase 18 in the traceability table — this is expected for a bug-fix phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `functions/src/ai/context-builder.ts` | 99 | Contains "NUNCA" — flagged by grep but it is legitimate system prompt instruction text, not a code anti-pattern | Info | No impact — not a stub or implementation gap |

No stubs, placeholders, empty handlers, or hardcoded empty data found across any of the 9 modified files.

### Human Verification Required

The automated verification confirms all code paths are correctly implemented. The following behaviors require a live application session to confirm end-to-end correctness:

#### 1. BUG-1: Usage counter not incremented on confirmation-pending

**Test:** Open the Lia panel, ask it to delete a contact or product. When the confirmation dialog appears, check the usage counter in the panel header.
**Expected:** Usage counter has NOT changed from before the request. Counter only increments AFTER confirming the action and receiving a complete response.
**Why human:** Requires a running AI backend, a real tool call with `requiresConfirmation=true`, and observing the SSE stream behavior at the confirmation branch.

#### 2. BUG-2: Session history restored correctly on first page load

**Test:** Log in as a Pro or Enterprise user who has a prior Lia conversation. Open a new browser tab (or hard-refresh). Open the Lia panel.
**Expected:** Previous conversation messages appear in the chat immediately upon opening. No "fresh session" greeting appears for an existing session.
**Why human:** Race condition between `tenantId` availability and `sessionId` initialization — the fix depends on the async auth context loading sequence, only observable in a real browser environment.

#### 3. BUG-3: Newline preservation in messages

**Test:** In the Lia input, type "Line 1", press Shift+Enter, type "Line 2", press Shift+Enter, type "Line 3", then send. Observe the message bubble.
**Expected:** Three lines displayed with visible line breaks between them. Also confirm that a Lia response containing newlines (e.g., a list) displays correctly.
**Why human:** `whitespace-pre-wrap` and `remark-breaks` effects are only observable in a rendered browser context.

#### 4. BUG-4: Panel state preserved on close/reopen

**Test:** Open the Lia panel, send a message and wait for a response. Click the close button (or the floating trigger). Then click the trigger again to reopen.
**Expected:** All messages from before are still visible, in the same scroll position. No new greeting bubble injected. Streaming state not reset.
**Why human:** React DOM tree preservation across open/close cycles is not statically verifiable — requires observing component lifecycle in a browser.

#### 5. BUG-5A: Tool result chip design

**Test:** Ask Lia to list your proposals or contacts (triggers a tool call). Observe the tool result display in the response.
**Expected:** A compact inline chip appears showing the tool name (e.g., "list_proposals") and a summary (e.g., "3 registro(s)"). No JSON is visible. Clicking "Ver detalhes" expands to show the formatted JSON.
**Why human:** Visual chip layout and Collapsible interaction require browser rendering.

#### 6. BUG-5B: No internal IDs in Lia responses

**Test:** Ask Lia to create a new product with name "Test Product" and price R$100,00. Observe the success message.
**Expected:** Lia responds with something like "Produto 'Test Product' criado com sucesso por R$ 100,00" — no Firestore document ID (long alphanumeric string) appears in the response.
**Why human:** LLM response content requires a live AI inference — system prompt instructions are probabilistic and must be validated against actual model output.

### Gaps Summary

No gaps found. All 11 must-have truths are verified. All 9 required artifacts exist, are substantive, and are correctly wired. All 6 commits from the 3 plans exist in git history. No stubs or placeholders detected.

The `status: human_needed` reflects that 6 bug behaviors (the phase's core goals) require end-to-end browser testing to confirm real-world correctness. The code changes are complete and correct; what remains is manual smoke-testing of each fix.

---

_Verified: 2026-04-15T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
