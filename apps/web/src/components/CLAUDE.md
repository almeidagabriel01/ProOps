# CLAUDE.md — src/components/

## Estrutura
```
components/
├── ui/           # Shadcn/ui (Radix primitives) — GERADO, não editar manualmente
├── admin/        # Painéis e ferramentas de administração
├── auth/         # Login, registro, recuperação de senha
├── billing/      # Componentes de faturamento, planos e add-ons
├── branding/     # Logo, identidade visual do tenant
├── charts/       # Gráficos (Recharts)
├── features/     # Features específicas do produto (inclui team/team-management)
├── landing/      # Página de landing/marketing
├── layout/       # Shell, navigation, sidebar, topbar
├── legal/        # Termos de uso, política de privacidade
├── lia/          # Componentes da IA Lia (chat, widgets)
├── notifications/# Sistema de notificações
├── observability/# Painéis de observabilidade (superadmin)
├── onboarding/   # Tutorial de conta nova (ver seção Onboarding)
├── pdf/          # Renderização de PDFs (usado server-side via Playwright)
├── profile/      # Perfil do usuário
├── seo/          # JSON-LD e schemas de SEO
└── shared/       # Componentes verdadeiramente genéricos
```

## Regras

- Um componente por arquivo
- **Export nomeado** (não default export) para tree-shaking
- Props sempre tipadas com `interface [Nome]Props {}`
- Componentes de UI puro: sem chamadas a Firebase ou services — recebem dados via props
- Componentes "smart" (com lógica de dados): ficam em pastas de domínio, consomem hooks

## Shadcn/ui (`components/ui/`)
- Arquivos **gerados pelo shadcn** (button, card, dialog, sheet, input, textarea,
  table, dropdown-menu...): não editar para customizar um uso pontual — use
  `className` via `cn()` no ponto de uso.
  Exceção: correção **transversal** que teria de ser repetida em dezenas de call
  sites (ex.: o bottom sheet mobile do `DialogContent`, o `text-base md:text-sm`
  de `input`/`textarea` que evita o zoom do iOS). Nesses casos a edição deve ser
  **aditiva e com guarda de breakpoint**, preservando o comportamento desktop.
- `ui/` também abriga componentes **próprios do projeto**, que não vêm do
  registry e são editados normalmente: `data-table.tsx`, `step-wizard.tsx`,
  `dock.tsx`, `command-palette.tsx`, `form-components.tsx`, `date-picker.tsx`,
  `upgrade-modal.tsx`, entre outros.
- Para adicionar novo componente do registry: `npx shadcn@latest add [componente]`
- Componentes disponíveis incluem: button, card, dialog, alert-dialog, badge, checkbox, avatar, command-palette, e muitos outros

## Loading

O spinner do projeto é o `Loader` (`ui/loader.tsx` — o LumaSpin), **nunca** o
`Loader2` do lucide-react. Ele traz `role="status"` e `aria-label`, então a
espera é anunciada por leitor de tela em vez de ser um ícone mudo.

| Onde | Uso |
|---|---|
| Dentro de botão | `<Loader size="sm" variant="button" className="mr-2" />` |
| Adorno dentro de campo | `variant="button"` + a classe de cor do call site |
| Carregando uma seção/página | `<Loader size="md" />` |
| Overlay de página inteira | `<Loader variant="page" />` |

Tela autenticada que está **abrindo** usa skeleton com o formato dela, não
`Loader`: é o `RouteContentSkeleton` no carregamento da rota e o skeleton da
própria tela enquanto os dados chegam. O `SubscriptionGuard` não desenha
spinner enquanto auth e tenant carregam, porque o `ProtectedRoute` já passa o
skeleton da rota como filho nesse intervalo.

`variant="button"` não quer dizer só "está num botão": é o que faz o spinner
herdar `currentColor`. É por isso que ele também serve ao adorno de campo, onde
a cor vem de um `text-muted-foreground` do call site.

**O tamanho sai só de `size`.** O `Loader` aplica largura e altura por `style`
inline, que vence classe do Tailwind: `className="w-4 h-4"` não encolhe nada, e
o spinner sai no `md` (32px) enquanto quem escreveu acha que ajustou. Foi assim
que o botão "Salvar" da numeração de propostas nasceu com um spinner do dobro
da altura do texto. `className` serve para margem e cor, não para tamanho.

Guard: `src/__tests__/loader-consistency.test.ts` falha se `Loader2` reaparecer
ou se algum `<Loader>` tentar se dimensionar por classe.

## Componentes compartilhados de estado (`shared/`)

| Componente | Quando usar |
|---|---|
| `ConfirmDialog` | Toda confirmação. `window.confirm()`/`alert()` são proibidos na interface (guard `no-native-dialogs.test.ts`); aviso simples é `toast` |
| `EmptyState` | Lista ou bloco sem nada: ícone, o que falta e a ação que resolve |
| `RouteError` | O `error.tsx` de cada módulo. Reporta ao pipeline de observabilidade (o boundary do Next captura antes do `window`) e oferece tentar de novo, início e suporte. Guard `route-error-boundaries.test.ts`: destino novo do menu precisa do seu `error.tsx` |

Exclusão com "Desfazer" é `runUndoableAction` (`lib/undoable-action.ts`): a
tela já mostra o resultado e a gravação só acontece depois da janela do toast.

O toast é do sileo, que desenha o toast inteiro como `<button>` com a ação num
`<a>` lá dentro: para o leitor de tela o "Desfazer" não existia. O
`ToastProvider` corrige a semântica de cada toast que entra
(`lib/toast-a11y.ts`: grupo fora da tabulação, desenho em SVG oculto, ação como
botão que responde ao Espaço). A correção é de atributos, e não um patch na
biblioteca, porque o sileo fica no `node_modules` da raiz e o `patch-package`
do web não o alcança. Guards: `lib/__tests__/toast-a11y.test.ts` e o E2E do
Desfazer em `proposals/proposal-crud.spec.ts`, que acha o botão pelo papel.

## Data

O seletor de data do projeto é o `DatePicker` (`ui/date-picker.tsx`), **nunca**
um `<input type="date">`. O nativo muda de aparência, idioma e até de ordem dos
campos conforme o sistema operacional e o locale — dois campos de data no mesmo
formulário se comportariam de formas diferentes.

Ao trocar um nativo pelo `DatePicker`, cuidado com uma perda silenciosa:
**`min`/`max` chegam só ao input escondido**, e o calendário não os aplica (nem
o navegador valida input escondido). Quem dependia da validação nativa precisa
de aviso próprio — é o caso da data de início de recebimento em
`/settings/fiscal`, onde uma data futura é escolha permanente.

O rodape do calendario traz um atalho **"Limpar"**. Onde "sem data" nao e um
estado valido — ou e um estado caro —, passe `clearable={false}`.

Guard: `src/__tests__/date-input-consistency.test.ts`.

## DataTable: as colunas têm que somar o grid

A soma dos `col-span-*` das colunas precisa fechar **exatamente** com o
`gridClassName="grid-cols-N"`. Estourando, o CSS Grid empurra a última coluna
para a linha de baixo — e a última costuma ser a de **ações**: os botões
continuam existindo, fora da linha onde a pessoa procura, com o cabeçalho
"Ações" sozinho num segundo nível.

Nada quebra e nada avisa; é aritmética dentro de string de classe, invisível
para o TypeScript. Guard: `src/__tests__/data-table-grid-columns.test.ts`.

## StepWizard: cada passo precisa do seu card

O `StepWizard` desenha a trilha a partir do array `steps` e casa o conteúdo por
**posição** (`React.Children.map`). Um passo declarado sem card correspondente
fica clicável e **vazio** — o conteúdo não existe, a tela some inteira, e nada
avisa: não é erro de tipo (é aritmética entre um array e a quantidade de filhos
JSX) nem de runtime.

O jeito clássico de cair nisso é um mesmo array alimentar **dois** wizards no
mesmo arquivo — em `/contacts/[id]`, o de edição e o somente-leitura — e o passo
novo entrar só num deles. Um card a mais é o espelho: existe e nunca é
alcançável.

Guard: `src/__tests__/step-wizard-children-parity.test.ts`.

Bloco promovido a conteúdo de passo **não pode ser recolhível**: no caso do
`CatalogFiscalFields` recolher esconde o único conteúdo do passo; no do
`ClientFiscalFields`, único conteúdo do passo "Dados Fiscais" do contato,
recolher recriaria o problema que a promoção resolveu (fechado, ninguém achava o
endereço que a NF-e exige). Daí o `variant="step"` dos dois, ao lado do
`"section"` recolhível.

## Navegação

O modelo de navegação (a dock, a tab bar do celular, o sheet e o seletor de visão
das páginas) tem contrato próprio em `layout/CLAUDE.md`. O resumo: `menuItems` é
a fonte, `useNavigationItems` é o único gate de plano, permissão e nicho,
`useDockEntries` colapsa um grupo em um ícone e `PageViewSwitcher` o expande de
volta no cabeçalho. Ninguém deriva a própria lista de destinos.

## Onboarding (`onboarding/`)

O tutorial de conta nova. Um card flutuante, uma TELA por passo: ele não aponta
para elementos da página, então não quebra quando um layout muda.

| Arquivo | Papel |
|---|---|
| `onboarding-steps.ts` | **O roteiro.** Puro: templates, capítulos, `buildOnboardingSteps`, `matchStepForPath` |
| `onboarding-provider.tsx` | Estado (`users/{uid}.onboarding`) e ações, montado no `ProtectedAppShell` |
| `app-onboarding.tsx` | O card (e a pílula minimizada) |
| `use-draggable-position.ts` | Arraste do card no desktop, com posição lembrada no navegador |
| `onboarding-welcome-dialog.tsx` | Boas-vindas, uma vez, com variante de demonstração |
| `first-steps.ts` / `first-steps-card.tsx` | Tarefas reais no Dashboard, só em conta paga |

- **Os passos derivam de duas listas que já existem**: `menuItems` (já filtrado
  pelo `useNavigationItems`) e `SETTINGS_NAV_GROUPS`
  (`app/settings/_components/settings-nav-items.ts`). **Tela nova no menu ou em
  Configurações precisa de template em `onboarding-steps.ts`**, ou de uma
  entrada justificada em `ROUTES_WITHOUT_OWN_STEP`. O guard
  `onboarding/__tests__/onboarding-steps.test.ts` falha nos dois sentidos: rota
  sem passo e passo sem rota. Foi assim que Comissões e Notas Fiscais ficaram
  meses fora do tutorial.
- Item de checklist que depende de plano declara `requiresCapability`; passo
  cujo módulo o plano não abre SOME (o menu coroa, o tutorial não leva a beco
  sem saída).
- Só abre sozinho para conta nova (as sementes gravam o estado no cadastro).
  Qualquer pessoa reabre por "Tutorial da plataforma", no menu do perfil, que
  retoma o tour em andamento ou recomeça do zero.
- O card fica no canto inferior direito, acima da Lia, e no desktop pode ser
  arrastado pela faixa do título (setas também; Home, duplo clique ou "voltar
  ao canto" desfazem). A posição é conveniência por navegador, em
  localStorage, e é sempre puxada de volta para dentro da janela. No celular
  ele fica ancorado.
- `welcomeSeenAt` e `firstStepsDismissedAt` sobrevivem a recomeçar o tour. O
  backend reconstrói o objeto campo a campo (`normalizeOnboardingPayload`):
  campo novo no estado precisa entrar lá, senão é descartado sem erro.

## Importar planilha (`features/import/`)

`ImportDialog` é o importar de Contatos, Produtos e Serviços: arquivo (.xlsx ou
.csv, com modelo para baixar), ligação das colunas (feita sozinha pelo nome,
em `lib/import/import-fields.ts`) e prévia antes de gravar. Para quem assina a
prévia é a do servidor (`dryRun`, que acha os repetidos); na demonstração é a
validação do navegador, e o último passo leva aos planos. A regra do backend
está no `apps/functions/CLAUDE.md`, seção Importação por planilha. A planilha
de produtos segue o nicho: coluna de metragem e "preço por" onde o estoque é em
metros. Leitor de planilha em `lib/import/read-sheet.ts` (o CSV detecta o ponto
e vírgula do Excel em português).

## Nomenclatura
- Arquivo: `nome-componente.tsx` (kebab-case)
- Componente: `NomeComponente` (PascalCase)
- Props interface: `NomeComponenteProps`
- Hook associado: `useNomeComponente` em `src/hooks/`

## Multi-niche
Para features que variam por nicho de negócio, use `useCurrentNicheConfig()` do hook
em `src/hooks/useCurrentNicheConfig.ts`. Nichos: `automacao_residencial` | `cortinas` | `seguranca_eletronica`.
Nunca hardcodar strings de nicho em componentes genéricos. "Ambiente" e "solução"
em texto de tela saem do vocabulário (`useNicheVocabulary()`); no PDF e no `/share`,
de `getNicheConfig(tenantNiche).vocabulary`. Ver `lib/niches/CLAUDE.md`.

## Antes de criar um componente novo
1. Verificar `ui/` — pode já existir um primitivo Shadcn
2. Verificar pasta de domínio — pode já existir algo similar
3. Verificar `shared/` — pode ser genérico o suficiente para estar lá
