# Camadas de Acesso — checklist obrigatório para módulo ou funcionalidade nova

Todo módulo do ERP atravessa **quatro** perguntas independentes. Um módulo novo
que não responda as quatro nasce com um buraco, e o buraco só aparece quando um
cliente reclama — ou quando alguém audita meses depois.

| # | Pergunta | Quem responde |
|---|---|---|
| 1 | Qual **membro** da equipe pode ver e mexer? | `users/{uid}/permissions` |
| 2 | Qual **plano** libera o módulo? | `PLAN_CATALOG` + `requirePlanCapability` |
| 3 | Uma conta **free** (modo demo) enxerga isto? | as três listas de demo |
| 4 | As **Firestore rules** cobrem a coleção nova? | `firebase/firestore.rules` |

**Nenhuma delas tem default seguro.** As quatro falham abertas ou fechadas em
silêncio, e o histórico do projeto tem um caso real de cada:

- **Permissão:** `checkFinancialPermission` lia um doc `financial` que nenhum
  caminho de escrita jamais criou. Membro sem doc é negado, então o módulo
  financeiro inteiro ficou fechado para todo membro, com o sintoma genérico
  "Sem permissão financeira.".
- **Plano:** fiscal, calendário e Asaas nasceram sem gate nenhum. `hasFinancial`
  e `hasKanban` viviam só no `PlanProvider`, então qualquer assinante emitia
  NF-e — que custa por documento — batendo direto na API.
- **Demo:** `DEMO_READABLE_PREFIXES` apontava para cinco caminhos que não
  existem (`/v1/ambientes` e companhia; o real é `/v1/aux`). Toda conta free
  levava 402 ao abrir Soluções, Ambientes ou o formulário de proposta.
- **Rules:** política DENY-by-default — coleção sem regra é coleção inacessível.

---

## 1. Permissão de membro

**Decida:** este módulo tem uma página que o master possa conceder ou negar por
membro? Se sim, ele precisa de um `pageId`.

- [ ] `pageId` acrescentado a `PERMISSION_PAGES` em
      `apps/web/src/lib/permissions/pages.ts` — **fonte canônica**, consumida
      pelas duas telas da área de Equipe.
- [ ] Controller checa: `hasPagePermission(claims, pageId, action)` (padrão
      novo) ou o bloco `if (!isMaster && !isSuperAdmin) checkPermission(...)`
      (controllers antigos que já têm o contexto resolvido em mãos).
- [ ] Página usa `usePagePermission(pageId)` para esconder ação sem permissão.
- [ ] Item de menu declara `pageId` em `navigation-config.tsx`.
- [ ] Ferramenta da Lia que toque o módulo declara
      `permission: { pageId, action }` em `ai/tools/index.ts`.

> **Nunca invente uma chave.** Use um `pageId` que a tela de Equipe realmente
> grava. Uma chave que só existe no leitor nega todo mundo, para sempre, sem
> erro visível.

## 2. Plano

**Decida:** este módulo entra em quais planos? É vendável como add-on?

- [ ] Capacidade declarada em `PLAN_CATALOG`
      (`apps/functions/src/shared/plan-capabilities.ts`) — **fonte única**. Se
      for só um teto numérico (quantos posso criar), é `limits`; se for
      "abre ou não abre", é `capabilities`.
- [ ] `requirePlanCapability("...")` montado na rota, **por prefixo**:
      `router.use("/meu-modulo", gate)`. Nunca `router.use(gate)` sem path —
      todos os routers são montados em `app.use("/v1", ...)`, então um `use()`
      sem path aplica o gate à API inteira e falha parecendo "o plano
      bloqueou", não "montei errado".
- [ ] Página mostra `UpgradeRequired` quando a capacidade falta (padrão de
      `app/wallets/page.tsx`).
- [ ] Item de menu declara `requiresCapability` — é o que coroa o item e abre o
      upsell em vez de navegar.
- [ ] Ferramenta da Lia declara `capability`.
- [ ] Add-on, se houver: `ADDON_DEFINITIONS_BACKEND` + `ADDON_DEFINITIONS` no
      front, e o grant em `applyAddonsToCapabilities`.

O que o cliente vê é **derivado**: `buildPublicPlanFeatures` alimenta
`GET /v1/stripe/plans`, e dali saem a landing, o `PlanCard` e o `PlanProvider`.
Uma chave nova no catálogo aparece sozinha na descrição dos planos — o que
significa que **um limite que você aplica sem declarar ali vira cobrança
silenciosa**, descoberta pelo cliente no 402.

> **Capacidade nova só aparece na tela DEPOIS de o backend subir.** O front lê
> as features de `getLivePlans()` → `GET /v1/stripe/plans`, e esse caminho
> devolve a resposta do backend **sem mesclar** com a cópia local do catálogo
> (o caminho do Firestore, em `getPlanById`, mescla — o live não). Com o backend
> rodando código antigo, a chave nova chega ausente e o `?? false` fecha a
> seção. Isso é o comportamento CERTO: o gate do backend também não conhece a
> capacidade ainda, então mostrar a tela seria prometer um 402. Sintoma:
> "Recurso Bloqueado" numa conta cujo plano claramente inclui o módulo.
> Resolve com `npm run deploy:dev` (ou `npm run build` em `apps/functions` se
> for emulador — ele serve o `lib/` compilado). Os planos ficam **5 min em
> cache** no navegador depois disso.

> Não digite valor de plano fora de `plan-capabilities.ts`. Dois guards falham
> se uma cópia andar sozinha: `src/shared/__tests__/plan-capabilities.test.ts`
> e `apps/web/src/__tests__/plan-capabilities-parity.test.ts`.

## 3. Conta free / modo demo

**Decida:** uma conta gratuita deve navegar este módulo em modo demonstração?

O modo demo existe para "dar o gostinho": a conta free navega o ERP inteiro em
somente-leitura, e o `PlanProvider` **destrava de propósito** os módulos
premium (`hasFinancial`, `hasKanban`) para as telas renderizarem em vez de
mostrarem a coroa.

**Se SIM**, as três listas precisam concordar:

- [ ] `DEMO_ACCESSIBLE_PREFIXES` em `apps/web/src/lib/auth/resolve-user-home.ts`
      — a rota do FRONT (`/meu-modulo`). Sem isso, redirect para `/`.
- [ ] `DEMO_READABLE_PREFIXES` em
      `apps/functions/src/api/middleware/require-active-subscription.ts` — o
      prefixo REAL da API. **Confira contra `app.use(...)` em `api/index.ts`**:
      o casamento é `startsWith`, então um prefixo que não existe não bate com
      nada e não dá erro nenhum — só 402 no cliente.
- [ ] `DEMO_BLOCKED_MUTATION_PREFIXES` em `apps/web/src/lib/demo-mode.ts` — para
      a mensagem amigável. A escrita já morre no backend de qualquer jeito
      (só GET passa), mas sem isto o usuário vê um 402 genérico.
- [ ] Se for módulo premium, decida se entra no destravamento do
      `PlanProvider` (branch `role === "free"`). Fiscal está fora de propósito:
      não tem dado de demonstração e a tela pede CNPJ e certificado A1.

**Se NÃO** (o caso do fiscal e do Asaas): não faça nada. A conta free é barrada
por `FREE_TIER_FORBIDDEN` antes do gate de plano, que é o comportamento certo.

## 4. Firestore rules

- [ ] Coleção nova tem regra explícita em `firebase/firestore.rules` — a
      política é DENY-by-default.
- [ ] Leitura passa por `tenantSubscriptionAllowsRead`, no padrão das demais.
- [ ] Escrita pelo client só se houver motivo; o padrão é `allow write: if false`
      (Admin SDK).

> As rules gatam por **tenant + role + status de assinatura**. Elas NÃO conhecem
> plano — não tente gatear tier ali.

---

## Testes exigidos

A Bug Fix Policy do `CLAUDE.md` vale aqui inteira. O mínimo para módulo novo:

| Camada | Onde | O que afirma |
|---|---|---|
| Plano | `apps/functions/src/api/middleware/__tests__/` | tier sem a capacidade leva 402; tier com ela passa; add-on destrava |
| Permissão | `tests/e2e/permissions/` | membro sem o `pageId` é negado na API, não só na tela |
| Demo | `tests/e2e/plans/demo-mode.spec.ts` | a conta free lê o que deve e não escreve nada |
| Catálogo | `apps/functions/src/shared/__tests__/plan-capabilities.test.ts` | a matriz alvo, literal |

E2E de plano roda com `TENANT_PLAN_CAPABILITY_MODE=enforce` (ligado no
`global-setup`). Em `monitor` um teste aceitaria 200 e passaria sem provar nada.

**Chamada de API em spec precisa do prefixo `v1/`**: o proxy repassa o caminho
verbatim. Sem ele a resposta é 404, e um teste que aceite `[402, 404]` passa
sem provar nada.

---

## Como isso é ligado hoje (para conferir)

```
                    shared/plan-capabilities.ts        lib/permissions/pages.ts
                      (PLAN_CATALOG)                     (PERMISSION_PAGES)
                            |                                    |
   requirePlanCapability ---+--- buildPublicPlanFeatures    hasPagePermission
   (rota, por prefixo)      |    (landing, PlanCard)        (controller)
                            |                                    |
                  lib/tenant-capabilities.ts              usePagePermission
                  (tier + add-ons comprados)                  (página)

   require-active-subscription  →  gate binário free vs pagante (vem ANTES)
   firestore.rules              →  tenant + role + status (nunca tier)
```

Ordem em que uma request atravessa: `validateFirebaseIdToken` →
`requireActiveSubscription` (free vs pagante) → rate limiter →
`requirePlanCapability` (módulo) → controller (`checkPermission`).
