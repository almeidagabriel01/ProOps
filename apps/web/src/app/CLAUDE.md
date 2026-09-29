# CLAUDE.md — src/app/ (Next.js App Router)

## Contexto
Rotas e layouts do App Router. Cada pasta é um segmento de URL.
Segmentos de rota: proposals, contacts, products, transactions, calendar, crm, dashboard, team, settings, profile, admin, auth, subscription, além de rotas públicas/marketing (agendar, contato, automacao-residencial, decoracao, solutions, services) e legais (privacy, terms, cookies, data-deletion), etc.

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
- Proteção de rotas via `src/proxy.ts` (cookie `__session`)

## Rotas existentes
```
403, admin, agendar, ambientes, aplicativo, api, auth,
automacao-residencial, automation, booking, calendar, cash-flow, checkout-success,
commissions, contacts, contato, contracts, cookies, crm, dashboard, data-deletion, dre,
decoracao, equipment, fale-conosco, forgot-password, funcionalidades, goals, institucional, invoices, login,
manifesto, notifications, privacy, products, produtos, profile, projects, proposals,
register, reset,
service-orders, services, settings, share, sobre, solutions, spreadsheets, subscribe,
subscription-blocked, tasks, team, terms, transactions, verify, wallets
```

`funcionalidades` é a página pública com todas as funcionalidades do ERP, em
cards com o print de verdade de cada tela, e `funcionalidades/[slug]` é a
página de cada uma (estática, gerada da mesma lista; slug fora dela é 404), com
o print no topo. Na home, "Funcionalidades" da navbar rola até "Recursos da
plataforma" (`#recursos`), que cita as cinco principais e leva a esta página.
Os prints moram em `public/capturas/`, declarados em `lib/landing/capturas.ts`,
e são refeitos por `tests/capturas-do-erp`. Tudo sai do catálogo em
`lib/landing/funcionalidades/`: os recursos (o detalhe), as funcionalidades que
os reúnem (`funcionalidades.ts`, uma página cada, com os slugs em `slugs.ts`, que
o sitemap também lê) e os cinco destaques da home, que abrem essas páginas. Todo
recurso pertence a exatamente uma funcionalidade (teste do catálogo). O plano de
cada recurso é um selo DERIVADO de `DEFAULT_PLANS` e dos add-ons
(`selo-do-plano.ts`), com paridade testada contra o `PLAN_CATALOG` do backend.
Nunca escreva o nome de um plano num recurso: declare a chave de `PlanFeatures`
que o libera. Recurso novo no ERP entra no catálogo e numa funcionalidade, e o
teste do selo reprova se uma capacidade vendável não aparecer em nenhum recurso.
Funcionalidade nova precisa de um print em `CAPTURAS_DAS_FUNCIONALIDADES`
(um `Record` por slug, que não compila sem ele) e de uma entrada no roteiro de
`tests/capturas-do-erp/capturas.spec.ts`.

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
todos os planos, com `pageId` próprio (`tasks`), visão do grupo Agenda da
dock, junto do Calendário e do Link de agendamento. A tarefa é DA PESSOA: o
membro lê as que criou, as dele e as em que foi citado (`audienceUids`, que as rules leem); dono e administradores leem
todas (`useTaskReader`). Coleção própria `tasks`, e não as atividades do CRM,
porque o histórico do lead é da equipe e as rules não liberariam uma lista que
misturasse os dois; por isso o tipo "Tarefa" saiu da criação de atividade, e o
lead ganhou o painel de tarefas. Aparecem também na ficha do contato (aba
"Próximas ações", e não "Tarefas": a tarefa é de alguém da equipe e o contato
é só o assunto; o mesmo título no painel do lead), na proposta ("Nova tarefa")
e no Dashboard ("Minhas tarefas de hoje").
A menção vale pelo que continua escrito (`mentionedUids`): apagar "@Nome"
desfaz. A leitura é sem `orderBy`, então não precisa de índice composto.

O **link de agendamento** tem duas pontas: a configuração em `/booking` (visão
do grupo Agenda da dock, ao lado de Calendário e Tarefas) e a página do cliente
em `/share/visita/[token]`. O pedido entra no Calendário (`calendar`) como "a
confirmar" (status `pending`), e o Calendário ganha o botão "Pedidos de visita"
para confirmar ou recusar. A configuração cobre o expediente (dias, horário,
antecedência, horizonte), os tipos de visita com a duração, as exceções (dias
ou faixas sem atendimento, com motivo que só a empresa vê; o editor só aparece
quando o GET devolve `exceptions`) e o link para copiar. É do master (o membro
vê "Acesso Restrito"; a conta free vê o padrão do nicho, só para ler, sem
chamar a API). Detalhes da página pública em `share/CLAUDE.md`.

As **metas de vendas** ficam em `/goals`, visão do grupo Financeiro: a meta do
mês da empresa e de cada pessoa da equipe, definida pelo master (o membro vê
"Acesso Restrito" e acompanha a dele no Dashboard). Na proposta o campo se
chama "Responsável pela venda", e não "Vendedor", porque "vendedor" já é o
parceiro da comissão. Ao lado da meta de cada pessoa a tela mostra o que ela
já vendeu no mês (`GET /v1/sales-goals/progress`), com a porcentagem calculada
sobre a meta que está sendo digitada; se essa leitura falhar, a tela continua
servindo para definir as metas.

As duas são telas de módulo, na largura toda, com as ações (mês e salvar nas
metas; ligar e salvar no link) à direita do título, e o conteúdo em cards:
Empresa e Equipe nas metas; Link, Expediente, Tipos de visita e Exceções no
agendamento.

As duas telas moravam em Configurações até 2026-09-28; os endereços antigos
(`/settings/goals`, `/settings/booking`) só redirecionam. O portão de plano e
de administrador continua dentro da tela, e não em `page-config.ts`, para o
membro que abrir pela URL ler o motivo em vez de cair em `/403`.

A **assistência técnica** são três telas do grupo Assistência da dock:
`/service-orders` (a fila de OS, o detalhe `/service-orders/[id]` e o
atendimento pelo celular em `/service-orders/[id]/executar`, passo a passo até
a assinatura), `/equipment` (o parque instalado, também como aba
"Equipamentos" na ficha do contato, carregada sob demanda) e `/contracts`
(os contratos de manutenção: a receita recorrente no topo, o cadastro em
etapas em `/contracts/new` e `/contracts/[id]/edit`, o detalhe
`/contracts/[id]` com ativar, suspender, retomar e encerrar, as mensalidades
lançadas com o link de pagamento de cada uma e as visitas que o contrato
abriu). A lista e o
detalhe são lidos no Firestore; o técnico sem o escopo `service_orders_all`
consulta filtrando por ele mesmo (`serviceOrdersQuery`), senão as rules recusam
a lista. O que muda por nicho (tipos de equipamento, exemplo de nome e o
checklist com que a preventiva nasce, e o tipo e o exemplo de nome do
contrato) é `NicheConfig.fieldService`. O editor de itens e o seletor de
catálogo moram em `components/features/field-service/`, porque servem à OS e
ao contrato (este sem a chave de estoque). A barra de
ações no rodapé é `sticky` dentro do `<main>`, e não `fixed`: quem rola é o
`<main>`, e a barra de abas do celular fica logo abaixo dele. Regras do backend
em `apps/functions/CLAUDE.md`, seção Assistência técnica.

O **portal do cliente** também tem duas pontas: o botão "Portal do cliente"
na ficha do contato (`/contacts/[id]`, ao lado das abas) e a página pública em
`/share/portal/[token]`. Detalhes em `share/CLAUDE.md`.

Na **proposta**, a chave "Mensal" de cada linha (só com o módulo de contratos
no plano) tira a linha do total, da entrada e das parcelas; ela aparece à
parte como "+ R$ X/mês" no resumo, no pagamento, no PDF e no link, e vira um
contrato em rascunho na aprovação. Toda soma de total passa por
`countsInProposalTotal` (`lib/proposal/monthly-lines.ts`), com guard.

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
Subdivisões: `auth/`, `backend/`, `dev/`, `mercadopago/`

O proxy principal está em `src/app/api/backend/` — encaminha para Cloud Functions.
**Nunca** criar lógica de negócio sensível em Route Handlers — use Cloud Functions.

## O que NÃO fazer aqui

- Não colocar lógica de negócio pesada em `page.tsx` — delegue para `src/lib/` ou backend
- Não importar Firebase client SDK em Server Components
- Não usar `useState`/`useEffect` sem `'use client'`
- Não hardcodar textos de UI (use props ou constantes)
