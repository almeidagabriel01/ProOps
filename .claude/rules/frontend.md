# Frontend Rules

## Component Structure
- Use kebab-case for file names (`proposal-form.tsx`), PascalCase for component names (`ProposalForm`)
- Always define props with `interface [Component]Props {}`
- Use named exports (not default exports) for tree-shaking
- `src/components/ui/` is auto-generated Shadcn/ui — never edit manually
- Route-specific components go in local `_components/` folders inside the route segment
- Truly generic components go in `src/components/shared/`

## API Calls
- Never call Firebase SDK or Cloud Functions URLs directly from components
- All backend calls must go through `src/services/` layer
- Services call `/api/backend/*` Next.js proxy routes — never raw Cloud Functions URLs
- Services propagate errors up to hooks — no silent `catch` blocks that swallow errors

## Hooks
- Data-fetching hooks live in `src/hooks/` and consume from `src/services/`
- Hooks encapsulate: API calls, loading/error state, and derived logic
- For race-condition-prone updates, use a `Set` ref (e.g., `updatingIdsRef`) to track in-flight IDs
- Optimistic updates must have a server-side validation fallback — never trust only the local state

## State Management
- Use React Context (Auth, Tenant, Theme, Permissions from `src/providers/`) — no Redux/Zustand
- Always call `useTenant()` to get `tenantId` — never hardcode or read from URL params
- Validate that `tenantId` is defined before making any backend call

## Styling
- Tailwind v4 — configured via CSS, no `tailwind.config.ts`
- Use `cn()` utility to merge class names with Shadcn/ui components
- Theme (dark/light) is managed by ThemeContext — not CSS `prefers-color-scheme`

## Multi-Niche
- Never hardcode niche-specific logic in generic components
- Use `useCurrentNicheConfig()` for niche-specific configuration
- Supported niches: `automacao_residencial` | `cortinas`
- Niche logic lives in `src/lib/niches/`

## Next.js App Router
- Don't call Firebase client SDK from Server Components
- Add `'use client'` directive to any component using `useState`, `useEffect`, or browser APIs
- Protect routes via `middleware.ts` which reads `__session` cookie — don't re-implement auth checks in page components
