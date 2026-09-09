# CLAUDE.md — src/app/ (Next.js App Router)

## Contexto
Rotas e layouts do App Router. Cada pasta é um segmento de URL.
Há ~38 segmentos de rota: proposals, contacts, products, transactions, calendar, crm, dashboard, team, settings, profile, admin, auth, subscription, além de rotas públicas/marketing (agendar, contato, automacao-residencial, decoracao, solutions, services) e legais (privacy, terms, cookies, data-deletion), etc.

## Regras desta pasta

- `layout.tsx` define o shell da rota — alterações afetam TODOS os filhos
- `page.tsx` é o componente principal — Server Component por padrão
- `loading.tsx` e `error.tsx` tratam estados automáticos do React 18+
- Grupos de rotas `(grupo)/` organizam sem afetar URL
- `_components/` dentro de cada rota = componentes locais daquela rota

## Padrões obrigatórios

- `export const metadata` em toda page pública
- Server Component sempre que possível (sem eventos, sem hooks, sem browser APIs)
- `'use client'` apenas quando necessário — justificar no código se não for óbvio
- Proteção de rotas via `middleware.ts` na raiz (cookie `__session`)

## Rotas existentes
```
403, actions, addon-success, admin, agendar, ambientes, aplicativo, api, auth,
automacao-residencial, automation, calendar, checkout-success, contacts,
contato, cookies, crm, dashboard, data-deletion, decoracao, forgot-password,
institucional, login, privacy, products, profile, proposals, register, reset,
services,
settings, share, solutions, spreadsheets, subscribe, subscription-blocked,
team, terms, transactions, verify, wallets
```

## Três superfícies num projeto só

`proops.com.br`, `erp.proops.com.br` e `app.proops.com.br` são servidos por este
mesmo App Router. O `proxy.ts` lê o `Host` e reescreve **apenas a raiz** para
`/institucional` ou `/aplicativo`; todo o resto da árvore é servido como está.

A limitação a `/` é load-bearing, não cautela: `providers.tsx` classifica a
página com `usePathname()`, que sob rewrite reporta o caminho do NAVEGADOR e não
o alvo. Reescrever uma subárvore faria o proxy liberar a página enquanto o
cliente a embrulharia em `<ProtectedRoute>` e a mandaria para o login.

A política vive em `@/lib/site/surfaces` e `@/lib/site/host-seo`. `sitemap.ts` e
`robots.ts` são dinâmicos por causa disso: lidos do `Host`, senão os três
domínios publicariam o mesmo sitemap.

`/institucional` e `/aplicativo` renderizam **fora do `AuthProvider`**
(`SESSIONLESS_MARKETING_ROUTES`), porque não leem usuário nenhum. Antes de pôr
uma rota nessa lista, confira que nada que ela renderiza chama `useAuth`,
`useTenant`, `usePlan` ou `usePagePermission`, nem via componente compartilhado.

## Rotas de API (`src/app/api/`)
Subdivisões: `admin/`, `auth/`, `backend/`, `dev/`, `internal/`, `members/`, `proposals/`

O proxy principal está em `src/app/api/backend/` — encaminha para Cloud Functions.
**Nunca** criar lógica de negócio sensível em Route Handlers — use Cloud Functions.

## O que NÃO fazer aqui

- Não colocar lógica de negócio pesada em `page.tsx` — delegue para `src/lib/` ou backend
- Não importar Firebase client SDK em Server Components
- Não usar `useState`/`useEffect` sem `'use client'`
- Não hardcodar textos de UI (use props ou constantes)
