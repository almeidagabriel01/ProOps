# Capturas do ERP

Os prints de verdade usados nas páginas de venda (`/funcionalidades`, a página
de cada funcionalidade e as landings de nicho). Não é teste: é o jeito
reproduzível de refazer as imagens quando uma tela do ERP muda. Nunca retoque
um print à mão; refaça pelo roteiro.

```bash
npx tsx tests/capturas-do-erp/preparar.ts        # emuladores + empresas de exemplo
npm -w proops-web run dev:capturas               # o Next das capturas, na 3005
npx playwright test --config=tests/capturas-do-erp/playwright.config.ts   # todas
npx playwright test --config=tests/capturas-do-erp/playwright.config.ts --grep "financeiro"
npx tsx tests/capturas-do-erp/encerrar.ts
```

As imagens saem em `apps/web/public/capturas/` (WebP, 1600px de largura no
desktop e 780px no celular, mais as larguras menores do `srcset`, geradas por
`variantes.ts`) e são declaradas em
`apps/web/src/lib/landing/capturas.ts`, com o texto alternativo de cada uma. O
teste `lib/landing/__tests__/capturas.test.ts` reprova arquivo que falte ou que
tenha dimensão diferente da declarada.

## O que o preparo monta

- **Emuladores próprios** (`firebase.capturas.json`), no projeto
  `demo-proops-test`, com o Functions na **5011** e o hub na 4410. As portas do
  dia a dia (5001, 4000, 4400, 4500) ficam livres de propósito, porque o
  `npm run dev:backend` costuma estar nelas; `encerrar.ts` só derruba as portas
  das capturas. Firestore, Auth e Storage ficam nas padrão porque o front as
  tem fixas (`lib/firebase.ts`).
- **As demonstrações de cada nicho** (`apps/functions/src/scripts/demo`), cada
  uma virando uma empresa Enterprise ativa, com uma dona (Carla Mendes) e o
  tutorial dispensado. É o que tira a tela do modo demonstração.
- **Quatro notas fiscais** na empresa de automação: as demonstrações não têm
  nota, e a tela sairia vazia.

Tudo é fictício e local. As senhas de `ambiente.ts` só existem no Auth
emulado.

## Armadilhas já pagas

- **As páginas não usam `next/image` nesses prints.** No Next 16.3.4, quando
  dois pedidos iguais chegam juntos ao otimizador e o primeiro desiste no meio,
  o outro fica pendurado e aquela imagem trava para sempre no `next dev` e no
  `next start` (o servidor do E2E e do Lighthouse do CI). Reproduzido com dois
  `fetch` da mesma URL nova, um deles abortado em 5ms. Por isso as larguras
  são pré-geradas e servidas como arquivo estático (`ImagemDaCaptura`), o que
  também não gasta otimização de imagem na Vercel. Rodou o roteiro? As
  variantes saem junto; para refazê-las sem recapturar, `npx tsx
  tests/capturas-do-erp/variantes.ts`.

- **O Functions não sobe ("User code failed to load. Timeout after 10000")**:
  com o `dev` e o `dev:backend` na mesma máquina, a descoberta das funções
  passa dos 10s padrão. O preparo passa `FUNCTIONS_DISCOVERY_TIMEOUT=120`.
- **Todo `/api/backend` do servidor das capturas dava 500** ("Invalid API
  upstream override"): o proxy só aceita os destinos de
  `lib/server-api-upstream.ts`. O emulador das capturas está na lista; outra
  porta precisa entrar lá, com teste.
- **`networkidle` nunca chega**: o ERP mantém ouvintes em tempo real abertos. A
  espera tem teto de 15s.
- **A lista de lançamentos abre com tudo selecionado** na visão por vencimento
  (é de propósito, os cards somam a seleção). O print usa a aba Agrupados.
- **Pasta nova em `public/`** precisa entrar na exclusão do matcher do
  `proxy.ts`, senão a imagem leva 307. `capturas/` já está, com teste.
- **Um segundo distDir do Next** (`.next-capturas`) quebrava o CSS do
  `npm run dev`, porque o Tailwind varria o cache binário do Turbopack. O
  `.gitignore` cobre `apps/web/.next-*/`, e o Tailwind respeita o `.gitignore`.
