# CLAUDE.md — src/app/ (Next.js App Router)

## Contexto
Rotas e layouts do App Router. Cada pasta é um segmento de URL.
Há 25+ segmentos de rota: proposals, contacts, products, transactions, calendar, crm, dashboard, team, settings, profile, admin, auth, subscription, etc.

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
403, actions, addon-success, admin, ambientes, api, auth, automation,
calendar, checkout-success, contacts, crm, dashboard, forgot-password,
login, products, profile, proposals, register, services, settings,
share, solutions, spreadsheets, subscribe, subscription-blocked, team,
transactions, wallets
```

## Rotas de API (`src/app/api/`)
Subdivisões: `admin/`, `auth/`, `backend/`, `dev/`, `internal/`, `members/`, `proposals/`

O proxy principal está em `src/app/api/backend/` — encaminha para Cloud Functions.
**Nunca** criar lógica de negócio sensível em Route Handlers — use Cloud Functions.

## O que NÃO fazer aqui

- Não colocar lógica de negócio pesada em `page.tsx` — delegue para `src/lib/` ou backend
- Não importar Firebase client SDK em Server Components
- Não usar `useState`/`useEffect` sem `'use client'`
- Não hardcodar textos de UI (use props ou constantes)
