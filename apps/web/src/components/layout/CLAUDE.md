# CLAUDE.md — components/layout/

## O modelo de navegação

Quatro arquivos, cada um com uma responsabilidade, nesta ordem:

| Arquivo | Responsabilidade |
|---|---|
| `navigation-config.tsx` | **A fonte.** `menuItems`, os tipos e as funções puras. Sem React, sem hooks. |
| `use-navigation-items.tsx` | **O único gate.** Nicho, plano, permissão de membro, `masterOnly`. |
| `use-dock-entries.ts` | **Colapsa** um grupo em um ícone. Alimenta as três superfícies. |
| `page-view-switcher.tsx` | **Expande** o grupo de volta, no cabeçalho da página. |

Regra que segura o resto: **ninguém deriva a própria lista de destinos.** A dock,
a tab bar do celular, o sheet e o seletor de cabeçalho leem todos o mesmo
`useDockEntries()`. O command palette é a exceção declarada, porque é busca e
precisa ser plano, e existe um guard (`navigation-surfaces-parity.test.ts`) que
afirma que ele não perdeu nenhum destino do menu.

## Grupo

Um `MenuItem` com `children` é um grupo: a dock desenha **um** ícone, e as telas
irmãs reaparecem no seletor do cabeçalho de cada uma delas. Hoje são dois,
Financeiro e Catálogo.

Um grupo **não declara `href` nem `pageId`**:

- **`href`** porque o destino depende de quem está olhando. Um membro com
  permissão só para Notas Fiscais precisa que o ícone do Financeiro leve a
  `/invoices`. Quem resolve é `resolveGroupTarget`, que escolhe o primeiro filho
  que o plano realmente abre e cai no primeiro visível quando nenhum abre.
- **`pageId`** porque grupo não é página. O achatamento antigo gravava
  `pageId: "financial"` nos três filhos, e `"financial"` nunca existiu em
  `PERMISSION_PAGES`. Ninguém lia o campo, então não quebrou nada, mas era uma
  chave fantasma esperando alguém confiar nela. `navigation-config.test.ts`
  fecha isso.

**A capacidade do grupo é a do filho escolhido, nunca a mais cara.** Notas
Fiscais é Enterprise e o Financeiro é Pro: herdar do filho fecharia o módulo
para quem já paga por ele, e um assinante Pro tem que ver Financeiro sem coroa
com Notas Fiscais coroada lá dentro. Herdar sempre a do pai é o erro espelhado,
e já aconteceu: um assinante Pro abria o módulo fiscal inteiro.

**Sobrando um filho só, a entry vira o próprio filho.** Um ícone rotulado
"Financeiro" que leva a `/wallets`, sem seletor (que não desenha nada com uma
opção), mentiria sobre o destino.

## Ao acrescentar um item

Um destino novo é **filho de um grupo** ou item de topo. Em qualquer caso:

1. `pageId` que exista em `lib/permissions/pages.ts`. Uma chave que só existe no
   leitor nega todo mundo, para sempre, sem erro visível.
2. `requiresCapability` se o módulo for de plano, e a entrada em
   `PLAN_CATALOG` no backend. O checklist das quatro camadas está em
   `.claude/rules/access-control.md`.
3. `availabilityPageId` se a disponibilidade por nicho for diferente da
   permissão. É o caso de Ambientes, que divide `pageId: "solutions"` com
   Soluções mas tem porta de nicho própria.
4. Entrada em `PAGE_CONFIG` (`lib/page-config.ts`) e no command palette.
5. Sendo filho de grupo, montar `<PageViewSwitcher />` no cabeçalho da página.

Os guards cobrem 1, 4 e 5: `navigation-config.test.ts`,
`navigation-surfaces-parity.test.ts` e `page-view-switcher-mounted.test.ts`.

## Estado de carregamento

`useDockEntries()` devolve `[]` enquanto plano ou permissões carregam. O
`PlanProvider` entrega toda capacidade como `false` nesse intervalo e o
`PermissionsProvider` nega tudo. Antes do agrupamento isso só piscava coroa; com
grupo, decidiria também **para onde o ícone aponta**, e um clique rápido iria
para a página errada.

## As três superfícies

`BottomDock` de `md` para cima, `MobileTabBar` + `MobileNavSheet` abaixo. A tab
bar mostra `VISIBLE_TABS = 4` abas e manda o resto para o sheet: a constante
governa quantas abas cabem a 360px, não quantos destinos existem.

Item bloqueado por plano vira `<button>` com coroa e abre o `UpgradeModal`, em
vez de `<Link>`. É `resolveCapabilityRestriction` (`capability-gate.ts`), e o
seletor de cabeçalho usa exatamente o mesmo caminho, para uma visão bloqueada se
comportar igual ao ícone bloqueado.
