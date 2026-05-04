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

O campo `niche` é exibido como read-only (somente alterável pelo superadmin).

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

Assinaturas marcadas com `isManualSubscription = true` e sem evidência de Stripe (`stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`) exibem o badge "Manual" e omitem informações de faturamento Stripe.

---

## Aba "Planos" — `BillingTab`

Exibe cards de todos os planos disponíveis (`UserPlan[]` via `PlanService.getPlans()`).

- Toggle mensal/anual que muda os preços exibidos
- Botão de upgrade redireciona para Stripe Checkout
- Botão de downgrade abre `PlanChangeDialog` para confirmação
- Plano atual é destacado (sem botão de ação)
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
| `usePlanChange(user, tenant)` | Gerencia upgrade/downgrade, dialogs, preview de mudança de plano |
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

- A página de perfil sempre usa o usuário e tenant **ativos** dos providers
- Para superadmins que estão impersonando um tenant (`setViewingTenant`), a aba de assinatura exibe os dados do tenant visualizado
- O `usePlanChange` resolve o `effectiveUser` para o usuário admin do tenant quando necessário (via `UserService.getTenantAdminUser()`)

---

## Loading states

A página mostra `ProfileSkeleton` enquanto qualquer um dos seguintes está carregando:

- `usePlanChange.isLoading`
- `useAuth().isLoading`
- `usePlanUsage().isLoading`
- `useTenant().isLoading` (exceto para superadmin)
