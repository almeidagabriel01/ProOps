# CLAUDE.md — src/app/profile/

## Propósito

A rota `/profile` é o painel de conta do usuário autenticado. Ela centraliza três funções distintas:

1. **Edição de dados pessoais e da organização** — nome, telefone, logo, cor do tema
2. **Gestão da assinatura** — plano ativo, status Stripe, cancelamento, upgrade/downgrade
3. **Módulos add-on** — compra, acompanhamento e cancelamento de funcionalidades extras

Acesso: todos os usuários autenticados. Algumas seções são restritas ao usuário com `isMaster = true` (role `admin`).

---

## Estrutura de arquivos

```
src/app/profile/
├── page.tsx                          # Página principal (Client Component)
├── _components/
│   └── profile-skeleton.tsx         # Skeleton de carregamento
└── addons/
    ├── page.tsx                      # Página de add-ons (/profile/addons)
    └── _components/
        └── addons-skeleton.tsx       # Skeleton de carregamento dos add-ons

src/components/profile/               # Componentes compartilhados
├── index.ts
├── ProfileHeader.tsx                  # Header com nome, avatar e badge de plano
├── OverviewTab.tsx                    # Aba "Visão Geral"
├── personal-form.tsx                  # Formulário de dados pessoais
├── organization-form.tsx              # Formulário de dados da organização
├── password-form.tsx                  # Formulário de alteração de senha
├── MySubscriptionTab.tsx              # Aba "Minha Assinatura"
├── BillingTab.tsx                     # Aba "Planos" (cards de upgrade)
├── PlanCard.tsx                       # Card individual de plano
└── PlanChangeDialog.tsx               # Dialog de confirmação de mudança de plano
```

---

## Abas da página principal

A página usa `?tab=` na URL para sincronizar a aba ativa. Valores válidos:

| Valor do parâmetro | Label exibido | Componente |
|---|---|---|
| `overview` (padrão) | Visão Geral | `OverviewTab` |
| `subscription` | Minha Assinatura | `MySubscriptionTab` |
| `billing` | Planos | `BillingTab` |

A aba é sincronizada bidirecionalmente: mudanças de aba atualizam a URL via `router.replace()`, e navegação direta por URL (`?tab=subscription`) ativa a aba correta.

---

## Aba "Visão Geral" — `OverviewTab`

Layout em duas colunas (responsive):

| Coluna esquerda | Coluna direita |
|---|---|
| `PersonalForm` | `OrganizationForm` |
| `PasswordForm` (se tiver provedor de senha) | `PlanUsageCard` (se tiver provedor de senha) |
| `PlanUsageCard` (se não tiver provedor de senha) | — |

### `PersonalForm`

O que pode ser editado:

| Campo | Editável | Observação |
|---|---|---|
| `name` | Sim | Nome completo do usuário |
| `email` | Não | Somente leitura — gerenciado pelo Firebase Auth |
| `phoneNumber` | Sim | Número de WhatsApp/telefone |

- Persiste via `UserService.updateProfile()` → `PUT /v1/profile`
- Detecta se o usuário tem provedor de senha (`password`) via `onAuthStateChanged` para decidir se exibe o `PasswordForm`

### `OrganizationForm`

Comportamento condicional baseado em `isMaster`:

- **isMaster = true (role admin):** formulário editável com campos de nome da empresa, logo (upload) e cor do tema
- **isMaster = false (role user/member):** formulário somente leitura mostrando nome da empresa e papel "Membro da Equipe"

O que pode ser editado pelo master:

| Campo | Tipo | Validação |
|---|---|---|
| `name` | string | Obrigatório |
| `primaryColor` | hex string | Color picker + input de texto |
| `logoUrl` | imagem Base64 | Max 2MB, tipos: JPEG, PNG, GIF, WebP, SVG |

O campo `niche` é exibido como read-only: o nicho nasce no cadastro e nunca muda, nem pelo superadmin.

Persiste via `TenantService.updateTenant()` → `PUT /v1/tenants/:id`.

### `PasswordForm`

Exibido apenas para usuários com provedor `"password"` no Firebase Auth. Usuários que entraram com Google ou outros provedores OAuth não veem este formulário.

---

## Aba "Minha Assinatura" — `MySubscriptionTab`

Restrita a `isMaster = true`. Usuários sem permissão veem um card de "Acesso Restrito".

### O que é exibido

- Nome e badge de status do plano atual
- Preço com intervalo de cobrança (mensal/anual)
- Data da próxima cobrança (somente para assinaturas Stripe ativas)
- Lista de features do plano com valores formatados
- Lista de módulos ativos (do plano + add-ons contratados)

### Status de assinatura possíveis

| Status | Label | Variante do badge |
|---|---|---|
| `active` | Ativa | success |
| `trialing` | Trial | warning |
| `past_due` | Pagamento Pendente | destructive |
| `canceled` | Cancelada | destructive |
| `unpaid` | Não Pago | destructive |
| `free` | Gratuito | default |
| `inactive` | Inativa | default |

### Ações disponíveis

| Ação | Condição | Destino |
|---|---|---|
| Alterar Plano | Sempre | Navega para `?tab=billing` |
| Gerenciar Pagamento | Tem plano ativo | Abre Stripe Customer Portal (redirect externo) |
| Cancelar Assinatura | Tem assinatura Stripe ativa e `cancelAtPeriodEnd = false` | Chama `StripeService.cancelSubscription()` |
| Cancelar módulo add-on | Add-on ativo sem cancelamento agendado | Chama `StripeService.cancelAddon()` |
| Sincronizar | Tem `stripeSubscriptionId` mas sem `currentPeriodEnd` | Chama `StripeService.syncSubscription()` |

### Assinaturas manuais

Plano dado pelo painel do superadmin: `isManualSubscription = true` (lido do
tenant, com o usuário de reserva) e sem `stripeSubscriptionId`. Exibe o selo
"Manual", "Contrato com a ProOps" e o bloco `subscription-manual-period`: "Plano
válido até dd/mm/aaaa" ou, vencido, "Acesso até" o último dia da carência. As
datas saem de `contractDayLabel`/`graceLastDayLabel`
(`lib/billing/billing-banner.ts`), sem conversão de fuso. A data de fim e o
status ativo NÃO contam como evidência de Stripe: contavam, e o selo nunca
aparecia para quem ele descreve.

O preço exibido é o `unitAmount` da RAIZ do tenant (o mapa `subscription.*` não
é mais gravado), ignorado no contrato manual.

### Faixas do topo do ERP

`resolveBillingBanner` (`lib/billing/billing-banner.ts`, puro) decide a faixa de
assinatura do `ProtectedAppShell`, lendo só o doc do tenant e só para dono e
administradores (`usePermissions().isMaster`): contrato manual a 30 dias do fim
(amarela) e vencido em carência (vermelha), as duas com "Assinar pelo cartão"
(aba Planos) e "Falar com a ProOps";
Stripe em atraso (portal) e com cancelamento agendado (reativar). Trial, demo e
add-on seguem com a lógica própria. Guard: `lib/billing/__tests__/billing-banner.test.ts`
e `tests/e2e/billing/billing-state-banners.spec.ts`.

### Tela de quem perdeu o acesso (`/subscription-blocked`)

A página é Server Component: `_lib/blocked-session.ts` (com `cache`, dividido
com o layout, que decide se redireciona) lê a sessão e o tenant, e
`resolveBlockedScreen` (`lib/billing/blocked-screen.ts`, puro) escreve o texto:

- **Membro**: "O acesso da empresa X ao ERP está suspenso. Fale com Y,
  responsável pela conta", só com "Sair". Nenhum botão de cobrança: o backend
  recusa portal e checkout para quem não é dono ou admin.
- **Dono/admin de plano manual** (inclusive o teste dado pelo painel): "Seu
  plano venceu em dd/mm/aaaa", com "Falar com a ProOps" (WhatsApp de suporte),
  "Assinar pelo cartão" (`/subscription-blocked/plans`) e "Sair". Ao assinar,
  a empresa deixa de ser manual (ver `apps/web/src/app/admin/CLAUDE.md`).
- **Dono/admin de Stripe**: "Renovar assinatura" (`/subscription-blocked/plans`),
  "Atualizar pagamento", "Falar com a ProOps" e "Sair".

Papel, empresa e responsável saem do doc `users/{uid}`, com as claims só
preenchendo o que falta (`lib/billing/blocked-session-identity.ts`): é o doc
que o login e o `SubscriptionGuard` leem para mandar a pessoa até aqui. Lendo
só as claims, uma conta com claim vazia ou `free` e doc de dono era devolvida à
landing sem mensagem. Pelo mesmo motivo, `/api/auth/billing-status` busca o
tenant no doc quando a claim não o traz (antes liberava tudo), e a landing
mostra "Entrar no ERP" para a conta bloqueada, que leva a esta tela.

Nunca cita o nome do plano. **A pessoa fica logada nessa tela**: nem o front
(`auth-provider`, ao ler a claim de cobrança) nem o backend
(`lib/billing-claims.ts`) deslogam ou revogam a sessão por status de cobrança.
Guard: `lib/billing/__tests__/blocked-screen.test.ts` e
`tests/e2e/billing/subscription-blocked-messages.spec.ts`.

---

## Aba "Planos" — `BillingTab`

Exibe cards de todos os planos disponíveis (`UserPlan[]` via `PlanService.getPlans()`).

- Toggle mensal/anual que muda os preços exibidos
- Botão de upgrade redireciona para Stripe Checkout
- Botão de downgrade abre `PlanChangeDialog` para confirmação
- Plano atual é destacado (sem botão de ação)
- **Contrato manual** sem assinatura no Stripe (`isManualContract` do
  `usePlanChange`): nenhum card é o "atual" e todos levam ao checkout com
  "Assinar este plano", inclusive o do mesmo plano. É por aqui que o contrato
  vira assinatura pelo cartão sem esperar o bloqueio.
- Restrita a `isMaster = true`

---

## Módulos Add-on — `/profile/addons`

### O que são add-ons

Add-ons são funcionalidades extras vendidas separadamente via Stripe, sobre o plano base. São cobranças mensais independentes da assinatura principal.

### Add-ons disponíveis

Definidos em `ADDON_DEFINITIONS` (`src/services/addon-service.ts`):

| ID | Nome | Feature desbloqueada | Disponível para |
|---|---|---|---|
| `pdf_editor_partial` | Editor PDF Parcial | `maxPdfTemplates: 3` | Starter |
| `financial` | Módulo Financeiro | `hasFinancial: true` | Starter |
| `pdf_editor_full` | Editor PDF Completo | `maxPdfTemplates: -1`, `canEditPdfSections: true` | Starter |
| `crm` | Módulo CRM | `hasKanban: true` | Starter, Pro |
| `fiscal` | Notas Fiscais | `hasFiscal: true`, `maxInvoicesPerMonth: 100` (sem a recepção de notas de entrada) | Starter, Pro |
| `online_payments` | Pagamento Online | `hasOnlinePayments: true` | Starter (exige `financial`), Pro |
| `field_service` | Ordens de Serviço | `hasFieldService: true` | Starter |

`requiresAddons` declara pré-requisito por tier: o card mostra "Contrate antes:
Módulo Financeiro" e desabilita a compra, e o backend recusa com
`ADDON_REQUIRES_ADDON`. A cópia do front é guardada por
`src/__tests__/addon-definitions-parity.test.ts` (ids, tiers, pré-requisitos e o
efeito de cada add-on, contra `ADDON_DEFINITIONS_BACKEND`).

> **Preços:** NÃO estão armazenados no frontend. São buscados dinamicamente via `useStripePrices()` que chama o backend. Isso garante que dev/prod sempre usem os preços corretos do Stripe.

### Lógica de `isIncluded` vs `isPurchased`

Um add-on pode estar em três estados para o usuário:

| Estado | Condição | Exibição |
|---|---|---|
| Incluso no plano | `addon.availableForTiers` não contém o tier atual do usuário | Badge "Incluso" |
| Comprado (add-on) | `purchasedAddons.includes(addon.id)` | Badge "Ativo" + botão "Cancelar" |
| Disponível para compra | Tier válido e não comprado | Botão "Contratar" |

### Fluxo de compra

1. Usuário clica em "Contratar" → `AddonConfirmDialog` exibe preço e confirmação
2. Confirmação → `StripeService.createAddonCheckout()` cria sessão no Stripe
3. Redirect para Stripe Checkout
4. Retorno com `?success=true` → toast de sucesso + `router.replace("/profile/addons")` (limpa params)
5. Stripe webhook ativa o add-on no Firestore (`addons/{tenantId}_{addonType}`)

### Fluxo de cancelamento

1. Usuário clica em "Cancelar Assinatura" → `AlertDialog` de confirmação com data de expiração
2. Confirmação → `StripeService.cancelAddon()` agenda cancelamento no Stripe
3. Retorno com `?addon_cancelled=true` → toast informando data de expiração

### Coleção Firestore dos add-ons

Coleção: `addons/{tenantId}_{addonType}`

```typescript
type PurchasedAddon = {
  id: string;
  tenantId: string;
  addonType: AddonType;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status: "active" | "cancelled" | "past_due";
  billingInterval?: "monthly" | "yearly";
  quantity?: number;
  purchasedAt: string;                    // ISO date
  expiresAt?: string;                     // Preenchido ao cancelar
  currentPeriodEnd?: string;              // Para cálculo de grace period
  cancelAtPeriodEnd?: boolean;            // true = cancelamento agendado
};
```

### Grace period de add-ons

O hook `usePlanLimits` aplica um grace period de 7 dias para add-ons `past_due`:

```
Se status === "past_due" E currentPeriodEnd + 7 dias > hoje → add-on ainda ativo
```

---

## Hooks usados na página de perfil

| Hook | Responsabilidade |
|---|---|
| `useProfileSubject()` | De quem é o perfil (própria conta, dono ou membro visto pelo super admin) |
| `usePlanChange(user, tenant, billing)` | Gerencia upgrade/downgrade, dialogs, preview de mudança de plano, sobre a conta de `billing` |
| `usePlanUsage()` | Carrega uso atual vs. limites (propostas, clientes, produtos, usuários) |
| `usePlanLimits()` | Carrega features do plano + add-ons contratados |
| `useStripePrices()` | Busca preços dinâmicos de add-ons do Stripe |
| `useAuth()` | Usuário atual e estado de loading |
| `useTenant()` | Dados do tenant ativo |
| `usePermissions()` | `isMaster` para controle de acesso |

---

## Conexão com Firebase Auth

- O email do usuário é **somente leitura** — gerenciado pelo Firebase Auth, não pelo Firestore
- A detecção de provedor de senha (`password`) é feita via `onAuthStateChanged` observando `firebaseUser.providerData`
- A alteração de senha ocorre via Firebase Auth SDK diretamente no `PasswordForm` (sem passar pelo backend)
- O `UserService.updateProfile()` atualiza apenas `name` e `phoneNumber` no Firestore (via backend API)

---

## Considerações multi-tenant

- A página de perfil sempre usa o tenant **ativo** dos providers.
- **De quem é o perfil** sai de `useProfileSubject()` (`hooks/use-profile-subject.ts`):
  - `self`: a própria conta (todo usuário, e o super admin fora do Acessar Painel);
  - `owner`: no Acessar Painel, o dono da empresa vista, pela mesma regra do
    backend (`UserService.getTenantOwnerUser`, o "Dono" da lista de membros e o
    administrador da aba Acesso);
  - `member`: no Ver como membro, o membro visto.
  Nome, e-mail e telefone vêm de `subject`; a aba Minha Assinatura e o
  `usePlanChange` recebem `billingUser`, que é sempre o dono.
- **Fora de `self` os dados pessoais ficam somente leitura** (`readOnlyPersonalData`
  no `OverviewTab`): o `PersonalForm` perde editar e salvar, e o `PasswordForm`
  some. `PUT /v1/profile` e a troca de senha usam a identidade LOGADA, então
  gravariam no doc e na senha do próprio super admin. O aviso no topo
  (`ImpersonatedProfileNotice`) diz de quem é o perfil e manda para a aba Acesso.
- Até 2026-10 o `usePlanChange` resolvia a pessoa por `getTenantAdminUser`
  (`role == "admin"`, minúsculo) e, sem achar, devolvia qualquer usuário da
  empresa: o Perfil da AWA mostrava o e-mail de um membro. Guards:
  `services/__tests__/user-service.owner.test.ts`,
  `hooks/__tests__/use-profile-subject.test.tsx` e
  `components/profile/__tests__/overview-tab.impersonation.test.tsx`.

---

## Loading states

A página mostra `ProfileSkeleton` enquanto qualquer um dos seguintes está carregando:

- `usePlanChange.isLoading`
- `useProfileSubject().isLoading` (dono ou membro ainda sendo buscados)
- `useAuth().isLoading`
- `usePlanUsage().isLoading`
- `useTenant().isLoading` (exceto para superadmin)
