# Phase 15: Lia Frontend Chat UI — Research

## Summary

Phase 15 is a **pure frontend phase**. The backend (Phases 12–14) is fully implemented and deployed. This phase builds the Lia chat UI: 8 React components, a streaming SSE hook, a Firestore session hook, and a one-line patch to the Next.js API proxy.

---

## 1. Integration Point: ProtectedAppShell

**File:** `src/components/layout/protected-app-shell.tsx`

```tsx
export function ProtectedAppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-card">
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        <Header sidebarWidth={0} />
        <SubscriptionGuard>
          <main id="main-content" className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </SubscriptionGuard>
        <AppOnboarding />
      </div>
      <BottomDock />
    </div>
  );
}
```

**Decision:** `LiaTriggerButton` and `LiaPanel` mount as siblings inside the outer `div.flex.h-screen`, alongside the existing content column and `BottomDock`. They must NOT be inserted inside `<main>` or `<SubscriptionGuard>`.

---

## 2. BottomDock — Why the Trigger Must Be Independent

**File:** `src/components/layout/bottom-dock.tsx`

The `BottomDock` uses `position: fixed left-1/2 bottom-4` and auto-hides on scroll (`translate-y-[calc(100%+24px)]`). It disappears when the user scrolls down. The Lia trigger button must always be visible regardless of scroll, so it must be a separate `position: fixed` element (`bottom-6 right-6 z-50`) mounted directly in `ProtectedAppShell`, not inside `BottomDock`.

`BottomDock` uses `z-40`; `LiaTriggerButton` uses `z-50`; `LiaPanel` uses `z-40` (slides in from the right, same layer as dock, below trigger).

---

## 3. SSE Proxy Patch Required

**File:** `src/app/api/backend/[...path]/route.ts`

**Problem:** Line 143 buffers all non-bodyless responses via `await upstreamResponse.arrayBuffer()`. This consumes the entire SSE stream before responding, breaking Lia streaming.

**Current code (line 138–146):**
```ts
const response = BODYLESS_RESPONSE_STATUSES.has(upstreamResponse.status)
  ? new NextResponse(null, { status: upstreamResponse.status, headers: responseHeaders })
  : new NextResponse(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
```

**Fix:** Detect `text/event-stream` content-type and bypass `arrayBuffer()`:
```ts
const contentType = upstreamResponse.headers.get("content-type") ?? "";
const isSSE = contentType.includes("text/event-stream");

const response = BODYLESS_RESPONSE_STATUSES.has(upstreamResponse.status)
  ? new NextResponse(null, { status: upstreamResponse.status, headers: responseHeaders })
  : isSSE
    ? new NextResponse(upstreamResponse.body, { status: upstreamResponse.status, headers: responseHeaders })
    : new NextResponse(await upstreamResponse.arrayBuffer(), {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
```

**Timeout:** `REQUEST_TIMEOUT_MS` is `30_000` (line 4). For SSE requests, the `AbortController` timeout must be conditionally raised to `60_000`. Detect SSE by checking the request's `Accept` header (`text/event-stream`) before creating the controller.

**Other proxy facts:**
- `buildForwardHeaders()` already forwards `content-type`, `accept`, `authorization`.
- The frontend must send `Accept: text/event-stream` in the fetch call so the proxy can detect and route correctly.
- Emulator cold-start retry logic (lines 112–135) applies only to local target — does not affect SSE passthrough.

---

## 4. Backend API Contract

**Route:** `POST /api/ai/chat` → proxied to Cloud Functions via `/api/backend/ai/chat`

**Request body (`AiChatRequest`):**
```ts
{
  message: string;        // required, max 4000 chars
  sessionId?: string;     // for Pro/Enterprise history continuity
  currentPath?: string;   // current frontend pathname for context
  confirmed?: boolean;    // second-round handshake after confirmation dialog
}
```

**SSE event stream format:**
Each event: `data: <JSON>\n\n`
Terminal event: `data: [DONE]\n\n`

**Chunk types (`AiChatChunk`):**
| `type` | Key fields | When |
|--------|-----------|------|
| `"text"` | `content: string` | Streaming text tokens |
| `"tool_call"` | `toolCall: { name, args }` | Tool being invoked |
| `"tool_result"` | `toolResult: { name, result, requiresConfirmation?, confirmationData? }` | Tool result returned |
| `"usage"` | `usage: { messagesUsed, messagesLimit, totalTokensUsed }` | Sent just before `[DONE]` |
| `"error"` | `error: string` | Stream-level error |

**Error responses (before SSE headers flushed):**
- `401` — not authenticated
- `400` — missing/invalid message
- `403` + `code: "AI_FREE_TIER_BLOCKED"` — free plan
- `429` + `code: "AI_LIMIT_EXCEEDED"` + `{ messagesUsed, messagesLimit, resetAt }` — monthly limit hit

**Delete confirmation handshake:**
1. User requests a destructive action.
2. Backend calls `request_confirmation` tool → sends `tool_result` chunk with `requiresConfirmation: true` and `confirmationData: { action, affectedRecords, severity }`, then ends the stream.
3. Frontend shows `LiaToolConfirmDialog`.
4. User confirms → frontend resends the original message with `confirmed: true` added to the request body.
5. Backend executes the delete on the second round (checks `ctx.confirmed === true`).

---

## 5. Plan Gating

**Free tier:** `POST /api/ai/chat` returns `403` with `code: "AI_FREE_TIER_BLOCKED"`. The `LiaTriggerButton` must not render for free-tier users. Use `planTier` from `usePlanLimits()`.

**AI Limits per tier (from `functions/src/ai/ai.types.ts`):**
| Tier | Messages/month | History persisted |
|------|---------------|------------------|
| starter | 80 | No (in-memory only) |
| pro | 400 | Yes (Firestore) |
| enterprise | 2000 | Yes (Firestore) |

**`usePlanLimits()` returns `planTier: PlanTier`** where `PlanTier = "starter" | "pro" | "enterprise"`. The hook already resolves master/sub-account delegation. Gate: render `LiaTriggerButton` only when `planTier !== "free"` and `!isLoading`.

**Usage badge states:**
- Below 80%: `variant="secondary"` (neutral)
- ≥80%: `variant="warning"` (amber)
- At limit (`messagesUsed >= messagesLimit`): `variant="destructive"`, input disabled

---

## 6. Session Management

**Starter:** No Firestore. `sessionId` is a `crypto.randomUUID()` generated on component mount, stored in `useState`. History lives in the `messages` state array only. New session = page reload or "New Chat" button.

**Pro/Enterprise:** `sessionId` persists in `localStorage` (key: `lia_session_id_{tenantId}`). On mount, read from localStorage to auto-resume the last session. A new session is started when:
- User clicks "New Chat" from the panel header menu.
- Last message was >4 hours ago (compare `updatedAt` from Firestore doc to `Date.now()`).

**Loading history (Pro/Enterprise):** Read from Firestore `tenants/{tenantId}/aiConversations/{sessionId}`.

Firestore rules:
```
match /tenants/{tenantId}/aiConversations/{sessionId} {
  allow read: if isAuthenticated() && belongsToTenant(tenantId)
              && resource.data.uid == request.auth.uid;
  allow write: if false; // backend-only via Admin SDK
}
```

For the `LiaUsageBadge`, read `tenants/{tenantId}/aiUsage/{YYYY-MM}`:
```
match /tenants/{tenantId}/aiUsage/{month} {
  allow read: if isAuthenticated() && belongsToTenant(tenantId);
  allow write: if false;
}
```

**`AiConversationMessage` shape:**
```ts
{ role: "user" | "model"; content: string; timestamp: Timestamp }
```
Backend trims to last 20 messages (10 exchanges). Frontend maps `role: "model"` → Lia bubble, `role: "user"` → user bubble.

---

## 7. Streaming Implementation

**Use `fetch` + `ReadableStream`, NOT `EventSource`** — EventSource does not support POST with a body.

```ts
const response = await fetch("/api/backend/ai/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
    Authorization: `Bearer ${idToken}`,
  },
  body: JSON.stringify({ message, sessionId, currentPath, confirmed }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
// SSE parsing: accumulate buffer, split on \n\n, parse "data: " prefix
```

**SSE parsing pattern:**
```ts
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const events = buffer.split("\n\n");
  buffer = events.pop() ?? "";
  for (const event of events) {
    const line = event.trim();
    if (!line.startsWith("data: ")) continue;
    const raw = line.slice(6);
    if (raw === "[DONE]") { onDone(); return; }
    const chunk: AiChatChunk = JSON.parse(raw);
    onChunk(chunk);
  }
}
```

**Two-phase markdown rendering:**
- During stream: append `chunk.content` directly as raw text to a `streamingText` state string.
- On `[DONE]`: set `isStreaming = false`, render bubble content with `<ReactMarkdown>` using the final accumulated text.
- This avoids mid-parse markdown flicker (e.g., partial `**bold**` showing as `**bol`).

**Partial stream failure:** If the fetch or stream throws before `[DONE]`, keep all tokens received so far and append an inline error badge (`"Resposta interrompida — tente enviar novamente."`) to the last bubble. Do NOT use a toast — the error persists in chat history.

---

## 8. Components to Build

All files go in `src/components/features/lia/`.

| File | Description |
|------|-------------|
| `lia-trigger-button.tsx` | Fixed `bottom-6 right-6 z-50` button. Sparkles icon → X icon when open. Notification dot when panel closed and unread SSE received. |
| `lia-panel.tsx` | `aside` slide-in panel. `fixed inset-y-0 right-0 w-[420px] z-40`. Header with avatar, title, usage badge, `...` menu (New Chat). |
| `lia-chat-window.tsx` | Scrollable message list. Typing indicator (3 bouncing dots, staggered animation). Auto-scrolls to bottom on new messages. |
| `lia-message-bubble.tsx` | Renders one message. Lia: `bg-muted rounded-tl-sm self-start`. User: `bg-card border self-end rounded-tr-sm`. Both `max-w-[85%]`. Streaming: raw text. Done: `<ReactMarkdown>`. |
| `lia-input-bar.tsx` | `textarea` (max 5 lines, resize-none). Send button 44×44px, `SendHorizontal` icon. `Cmd+Enter`/`Ctrl+Enter` submits. Disabled when at limit. |
| `lia-tool-confirm-dialog.tsx` | Modal shown when `requiresConfirmation: true` in tool_result. Displays `action`, `affectedRecords`, `severity`. "Confirmar" resends with `confirmed: true`. "Cancelar" dismisses. |
| `lia-tool-result-card.tsx` | Collapsible card shown for `tool_call` / `tool_result` SSE events. Shows tool name and summary of result. |
| `lia-usage-badge.tsx` | Badge: `{messagesUsed}/{messagesLimit}`. Variant switches at 80% and at limit. Shows reset date tooltip at limit. |

---

## 9. Hooks to Build

**`src/hooks/useLiaChat.ts`**
Manages: streaming state, messages array, `sessionId`, `isStreaming`, `isOpen`, `currentUsage`. Exposes `sendMessage(text: string)`, `startNewSession()`, `openPanel()`, `closePanel()`. Uses `useAuth()` for ID token, `useTenant()` for `tenantId`, `usePathname()` for `currentPath`.

**`src/hooks/useLiaSession.ts`** (Pro/Enterprise only)
Manages localStorage-based `sessionId` persistence and Firestore conversation load on mount. Returns `{ sessionId, messages: AiConversationMessage[], startNewSession }`.

**`src/hooks/useLiaUsage.ts`**
Reads `tenants/{tenantId}/aiUsage/{YYYY-MM}` via Firestore snapshot. Returns `{ messagesUsed, messagesLimit, resetAt, isNearLimit, isAtLimit }`.

---

## 10. New Dependencies

| Package | Install command | Purpose |
|---------|----------------|---------|
| `react-markdown` | `npm install react-markdown` | Render markdown in Lia message bubbles |
| `@tailwindcss/typography` | `npm install -D @tailwindcss/typography` | `prose` classes for markdown rendering |

**Shadcn component:**
```bash
npx shadcn add collapsible
```
Used for `LiaToolResultCard` expand/collapse.

No other new registry dependencies. All animations use existing Tailwind v4 utilities (`animate-bounce`, `animate-pulse`, `transition-transform`).

---

## 11. File Locations

| File | Path |
|------|------|
| Proxy to patch | `src/app/api/backend/[...path]/route.ts` |
| ProtectedAppShell | `src/components/layout/protected-app-shell.tsx` |
| New Lia components | `src/components/features/lia/` (create directory) |
| New Lia hooks | `src/hooks/useLiaChat.ts`, `useLiaSession.ts`, `useLiaUsage.ts` |
| AI types (backend reference) | `functions/src/ai/ai.types.ts` |
| Backend route (reference) | `functions/src/ai/chat.route.ts` |

---

## 12. Key Gotchas

1. **SSE via POST requires `fetch`, not `EventSource`.** EventSource is GET-only.
2. **Proxy `arrayBuffer()` blocks streaming.** Must be patched before any SSE works.
3. **Timeout must be raised to 60s for SSE.** The default `REQUEST_TIMEOUT_MS = 30_000` will kill long AI responses. Detect SSE by `Accept: text/event-stream` header on the request.
4. **Trigger button must not be inside BottomDock.** BottomDock auto-hides on scroll.
5. **Free tier (`planTier === "free"` or role `"free"`):** Do not render `LiaTriggerButton` at all. The backend also enforces a 403, but the UI must gate it before the first render.
6. **Delete confirmation is a two-round-trip flow.** The first request ends after `tool_result` with `requiresConfirmation: true`. The second request sends `confirmed: true` in the body — the frontend must preserve the original `message` text for the resend.
7. **Markdown rendering during stream causes flicker.** Accumulate raw tokens, switch to `<ReactMarkdown>` only on `[DONE]`.
8. **`sessionId` must be a UUID v4 generated client-side** (`crypto.randomUUID()`). Backend uses it as the Firestore document ID.
9. **Firestore conversation history is read-only from the client.** Writes are backend-only (`allow write: if false`). The frontend reads on session load for Pro/Enterprise.
10. **`role: "model"` in `AiConversationMessage`** maps to Lia's bubbles on the left side. Map to display name "Lia" when rendering.
