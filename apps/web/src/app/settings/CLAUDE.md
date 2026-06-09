# CLAUDE.md — src/app/settings/

## Propósito

A rota `/settings` centraliza a configuração da conta/empresa ativa, acessível pelo item **"Configurações"** no dropdown do perfil (header). É uma página com **abas navegáveis por URL** (cada aba é uma sub-rota).

> **Importante:** As abas Equipe e Pagamento Online são gated por `isMaster` **dentro do próprio componente** (mostram "Acesso Restrito" para membros) — as sub-rotas NÃO são `masterOnly` no `page-config.ts`, senão o membro cairia em `/403` em vez de ver a aba. A aba Verificação em dois fatores é acessível a todos (inclusive free e membros). Dados de organização (nome, cor, logo) continuam em `/profile` (aba "Visão Geral") via `OrganizationForm`.

---

## Estrutura de sub-rotas

```
src/app/settings/
├── layout.tsx                # Server Component (metadata) + <SettingsTabs/>
├── page.tsx                  # redirect("/settings/team")
├── team/page.tsx             # <TeamManagement/> (components/features/team/team-management.tsx)
├── security/page.tsx         # <TwoFactorSection/> (Verificação em dois fatores)
├── payments/page.tsx         # Asaas (master) ou "Acesso Restrito" (não-master)
├── _components/
│   ├── settings-tabs.tsx     # Client — barra de abas (usePathname + router)
│   ├── asaas-connect-card.tsx
│   ├── asaas-payout-config-section.tsx
│   └── asaas-webhook-status-alert.tsx
└── CLAUDE.md                 # Este arquivo
```

### Abas

| Sub-rota | Aba | Acesso |
|---|---|---|
| `/settings/team` | Equipe | Master (membro vê "Acesso Restrito") |
| `/settings/security` | Verificação em dois fatores | Todos |
| `/settings/payments` | Pagamento Online (Asaas) | Master (membro vê "Acesso Restrito") |

A rota legada `/team` faz `redirect("/settings/team")`. O conteúdo de equipe vive em
`components/features/team/team-management.tsx` (extraído da antiga page `/team`).

Pré-requisitos de acesso (não remover ao mexer aqui):
- `proxy.ts` **não** deve voltar a redirecionar `/settings/team` → `/team`.
- `/settings` está na allowlist do plano free (`resolve-user-home.ts`) para preservar o 2FA do free.

---

## O que é configurável (e onde)

As configurações do tenant estão divididas entre dois lugares no sistema:

### Em `/profile` (aba "Visão Geral") — via `OrganizationForm`

| Campo | Tipo | Impacto |
|---|---|---|
| `name` | string | Nome exibido em todo o sistema e nos PDFs |
| `primaryColor` | string (hex) | Cor do tema da UI e PDFs do tenant |
| `logoUrl` | string (Base64/URL) | Logo exibida nos PDFs e no painel |

- Somente usuários com `isMaster = true` (role `admin`) podem editar.
- Usuários com role `user`/`member` veem o formulário em modo somente leitura.
- Persiste via `TenantService.updateTenant()` → `PUT /v1/tenants/:id`.

### Campos configurados apenas via painel Super Admin (`/admin`)

| Campo | Tipo | Impacto |
|---|---|---|
| `niche` | `TenantNiche` | Determina lógica condicional em toda a UI |
| `whatsappEnabled` | boolean | Habilita o módulo de WhatsApp |
| `whatsappPlan` | `"none" \| "basic" \| "pro"` | Define o plano de WhatsApp |
| `whatsappMonthlyLimit` | number | Limite mensal de mensagens |
| `whatsappAllowOverage` | boolean | Permite exceder o limite (cobrado) |

Esses campos **não são editáveis pelo tenant diretamente** — são gerenciados pelo superadmin.

---

## Documento Tenant no Firestore

Coleção: `tenants/{tenantId}`

```typescript
type Tenant = {
  id: string;
  name: string;
  slug?: string;
  primaryColor?: string;          // Hex, ex: "#3b82f6"
  logoUrl?: string;               // URL ou Base64
  niche: TenantNiche;             // "automacao_residencial" | "cortinas"
  createdAt?: string;             // ISO date
  proposalDefaults?: Record<string, unknown>;
  whatsappEnabled?: boolean;
  whatsappPlan?: "none" | "basic" | "pro";
  whatsappMonthlyLimit?: number;
  whatsappAllowOverage?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  whatsappOverageSubscriptionItemId?: string;
  transactionStatusOrder?: string[];  // Ordem personalizada de status de transações
};
```

### Leitura do tenant no frontend

O `tenant-provider.tsx` carrega o documento do tenant ativo em tempo real via Firestore listener. Todos os componentes acessam via:

```typescript
const { tenant, isLoading } = useTenant();
```

O `tenantOwner` (usuário admin do tenant) também é exposto pelo provider e usado em `usePlanLimits` para resolver o plano de assinatura.

---

## Como as configurações afetam outros módulos

### `primaryColor`
- Aplicada como CSS custom property na UI via `tenant-provider.tsx`
- Usada nos PDFs gerados pelo Playwright
- Referenciada em `PlanFeatures.canCustomizeTheme` — plano Starter não pode alterar

### `logoUrl`
- Exibida no cabeçalho dos PDFs gerados
- Exibida no `ProfileHeader` em `/profile`

### `niche`
- Determina qual configuração de nicho é carregada via `src/lib/niches/`
- Afeta: terminologia dos itens de proposta (ex: "ambiente" vs "produto"), templates PDF disponíveis, campos de formulário visíveis
- Valores: `"automacao_residencial"` | `"cortinas"`
- **Nunca hardcodar verificações de nicho nos componentes** — use `useCurrentNicheConfig()`

### `transactionStatusOrder`
- Ordem personalizada de exibição dos status de transações financeiras
- Lida em `transactions/_hooks/useFinancialData.ts`

### `whatsappEnabled` / `whatsappPlan`
- Controlam se o botão de WhatsApp aparece nas propostas
- Afetam o billing de overage (cron mensal no backend)

---

## Service de tenant

`src/services/tenant-service.ts` — acesso misto (Firestore direto + API):

| Método | Transporte | Endpoint |
|---|---|---|
| `getTenants()` | Firestore direto | `collection("tenants")` |
| `getTenantById(id)` | Firestore direto | `doc("tenants", id)` |
| `createTenant(data)` | Firestore direto | `addDoc("tenants")` |
| `updateTenant(id, data)` | API (`callApi`) | `PUT /v1/tenants/:id` |
| `deleteTenant(id)` | Firestore direto (cascata) | Deleta produtos, serviços, propostas, clientes, usuários e o tenant |

> **Atenção:** `TenantService.deleteTenant()` faz uma exclusão em cascata diretamente via Firestore client SDK, deletando todos os documentos relacionados ao tenant. Esta operação não é revertível. Use apenas via painel `/admin`, nunca expor ao usuário comum.

---

## Permissões e controle de acesso

- Qualquer usuário autenticado do tenant pode **ler** os dados do tenant (via `useTenant()`).
- Somente `isMaster === true` (role `admin`) pode **editar** via `OrganizationForm`.
- Configurações críticas (niche, WhatsApp, limites do plano) só são alteráveis pelo `superadmin` via `/admin`.
- As regras do Firestore (`firestore.rules`) impõem isolamento por `tenantId` — um tenant nunca acessa dados de outro.

---

## Padrões de componente para settings

Ao criar um novo formulário de configurações:

1. Verificar se o usuário tem permissão (`isMaster`) antes de habilitar o modo de edição
2. Mostrar os campos como `disabled` / somente leitura para membros sem permissão
3. Chamar o service via `TenantService.updateTenant()` — **nunca** escrever diretamente no Firestore para campos que o backend valida
4. Usar `window.location.reload()` após salvar (padrão atual do projeto para forçar re-hidratação dos providers)
5. Fornecer feedback com `toast.success()` / `toast.error()`
