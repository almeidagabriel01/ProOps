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
automacao-residencial, automation, calendar, checkout-success,
commissions, contacts, contato, cookies, crm, dashboard, data-deletion, dre,
decoracao, fale-conosco, forgot-password, institucional, invoices, login,
manifesto, notifications, privacy, products, produtos, profile, projects, proposals,
register, reset,
services, settings, share, sobre, solutions, spreadsheets, subscribe,
subscription-blocked, tasks, team, terms, transactions, verify, wallets
```

`sobre`, `manifesto`, `produtos` e `fale-conosco` são as páginas do
**site da empresa** e vivem no route group `(empresa)/`, que não entra na URL.
`produtos` (português) é a página institucional; `products` (inglês) é a tela
autenticada de catálogo. São coisas diferentes.

`notifications` é a **central de notificações**: o histórico de cada pessoa e,
na aba Preferências (`?tab=preferencias`), o que chega no sino e por e-mail.
Fora do menu (abre pelo "Ver todas" do sino) e sem `pageId`: cada membro tem a
sua, como o Perfil. A notificação é POR PESSOA desde 2026-09-26: o sino consulta
`recipientUids array-contains uid`, a leitura vai em `readBy`, e o que cada um
recebe sai do catálogo (`lib/notifications/catalog.ts`, espelho do backend com
teste de paridade). Regras no `apps/functions/src/api/services/CLAUDE.md`.

`tasks` são as **tarefas**: o "a fazer" com responsável, prazo e @menção, em
todos os planos, com `pageId` próprio (`tasks`) e ícone próprio na dock, ao
lado do Calendário. A tarefa é DA PESSOA: o membro lê as que criou, as dele e as em que
foi citado (`audienceUids`, que as rules leem); dono e administradores leem
todas (`useTaskReader`). Coleção própria `tasks`, e não as atividades do CRM,
porque o histórico do lead é da equipe e as rules não liberariam uma lista que
misturasse os dois; por isso o tipo "Tarefa" saiu da criação de atividade, e o
lead ganhou o painel de tarefas. Aparecem também na ficha do contato (aba
"Próximas ações", e não "Tarefas": a tarefa é de alguém da equipe e o contato
é só o assunto; o mesmo título no painel do lead), na proposta ("Nova tarefa")
e no Dashboard ("Minhas tarefas de hoje").
A menção vale pelo que continua escrito (`mentionedUids`): apagar "@Nome"
desfaz. A leitura é sem `orderBy`, então não precisa de índice composto.

O **link de agendamento** tem duas pontas: a configuração em
`/settings/booking` e a página do cliente em `/share/visita/[token]`. O pedido
entra na Agenda (`calendar`) como "a confirmar" (status `pending`), e a Agenda
ganha o botão "Pedidos de visita" para confirmar ou recusar. Detalhes em
`settings/CLAUDE.md` e `share/CLAUDE.md`.

O **portal do cliente** também tem duas pontas: o botão "Portal do cliente"
na ficha do contato (`/contacts/[id]`, ao lado das abas) e a página pública em
`/share/portal/[token]`. Detalhes em `share/CLAUDE.md`.

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

`/institucional`, `/aplicativo` e as cinco páginas da empresa renderizam **fora
do `AuthProvider`** (`SESSIONLESS_MARKETING_ROUTES`), porque não leem usuário
nenhum. Antes de pôr uma rota nessa lista, confira que nada que ela renderiza
chama `useAuth`, `useTenant`, `usePlan` ou `usePagePermission`, nem via
componente compartilhado.

## O site da empresa

As cinco páginas ficam em `app/(empresa)/`, um route group que não entra na
URL. A raiz do apex (`app/(empresa)/institucional/page.tsx`, alvo do rewrite) é
a experiência longa; as outras quatro respondem **no nível do apex**. Elas não
moram debaixo de `/institucional` por dois motivos: `proops.com.br/sobre` é o
endereço que um site de empresa tem, e a subárvore `/institucional` é `noindex`
permanente por ser o alvo do rewrite, logo duplicata da raiz.

Isso torna `APEX_COMPANY_PATHS` (`lib/site/surfaces.ts`) load-bearing: é a lista
que mantém o apex servindo esses caminhos depois da virada, em vez de mandá-los
com 301 para `erp.proops.com.br`, que não os tem. Página nova do site da empresa
precisa entrar **nas três listas**: `APEX_COMPANY_PATHS`, `EMPRESA_LINKS`
(`components/institucional/nav-links.ts`, que valida a primeira no import) e
`ROTAS.institucional` em `host-seo.ts`.

**Um layout só**, `(empresa)/layout.tsx`, monta o `EmpresaShell`: Lenis, cortina
de transição, campo de ponteiro, navbar e rodapé. O shell é que escreve
`--px`/`--py`, herdados pela página inteira.

Ser um só é load-bearing, e era dois. Dois layouts irmãos são duas subárvores do
React: cruzar entre a raiz e uma sub-página desmontava a casca e construía
outra, então o `CurtainProvider` morria com o painel em pé (a transição sumia em
vez de subir), o Lenis era recriado atrás de um `requestIdleCallback` (a rolagem
inercial ficava fora do ar por até dois segundos) e o campo de ponteiro
recomeçava. Nada falhava: a URL trocava e o conteúdo estava certo. **Não dê
`layout.tsx` a nenhuma página daqui**; o guard é
`src/__tests__/site-da-empresa-uma-casca.test.ts`.

## Rotas de API (`src/app/api/`)
Subdivisões: `admin/`, `auth/`, `backend/`, `dev/`, `internal/`, `members/`, `proposals/`

O proxy principal está em `src/app/api/backend/` — encaminha para Cloud Functions.
**Nunca** criar lógica de negócio sensível em Route Handlers — use Cloud Functions.

## O que NÃO fazer aqui

- Não colocar lógica de negócio pesada em `page.tsx` — delegue para `src/lib/` ou backend
- Não importar Firebase client SDK em Server Components
- Não usar `useState`/`useEffect` sem `'use client'`
- Não hardcodar textos de UI (use props ou constantes)
