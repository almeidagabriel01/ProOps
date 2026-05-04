# CLAUDE.md — src/app/admin/

## Propósito

A rota `/admin` é o painel de super-administrador da plataforma ProOps. Permite gerenciar todos os tenants (empresas clientes) cadastrados no sistema: criação, edição, exclusão, acesso impersonado e monitoramento de métricas agregadas.

**Esta rota é exclusiva para usuários com `role === "superadmin"`.**

---

## Estrutura de arquivos

```
src/app/admin/
├── page.tsx                         # Lista de tenants (cards) — rota /admin
├── layout.tsx                       # Guard de acesso — bloqueia não-superadmins
├── _components/
│   ├── index.ts                     # Re-exports
│   ├── admin-skeleton.tsx           # Skeleton de carregamento
│   ├── tenant-card.tsx              # Card de um tenant (lista principal)
│   └── copy-data-dialog.tsx         # Dialog para clonar dados entre tenants
├── _hooks/
│   └── useTenantManagement.ts       # Hook principal da página /admin
├── _utils/
│   └── billing-date.ts             # Utilitário: calcular próxima data de cobrança
└── overview/
    ├── page.tsx                     # Visão geral com métricas — rota /admin/overview
    ├── _hooks/
    │   └── useTenantsData.ts        # Hook de dados para a visão geral
    └── _components/
        ├── index.ts
        ├── admin-overview-skeleton.tsx
        ├── metrics-cards.tsx        # Cards de métricas agregadas
        ├── tenants-table.tsx        # Tabela detalhada de tenants
        ├── tenant-actions-menu.tsx  # Dropdown de ações por linha da tabela
        ├── company-avatar.tsx       # Avatar da empresa na tabela
        ├── plan-badge.tsx           # Badge do plano (ex: "Pro · Mensal")
        ├── status-badge.tsx         # Badge de status de assinatura
        ├── usage-indicator.tsx      # Barra de progresso de uso de recursos
        ├── subscription-sync-card.tsx # Ferramenta de sincronização Stripe
        └── billing-date.ts         # Utilitário: formatação de data de cobrança

src/components/admin/                # Componentes admin reutilizáveis
├── tenant-dialog.tsx                # Dialog de criação/edição de tenant
└── edit-limits-dialog.tsx           # Dialog para editar limites de features
```

---

## Controle de acesso

### Layout Guard (`layout.tsx`)

```typescript
// Verificação executada em todo acesso às rotas /admin/*
if (!isLoading && (!user || user.role !== "superadmin")) {
  router.push("/403");
}
```

O `layout.tsx` é um Client Component que:
1. Observa `user` e `isLoading` do `useAuth()`
2. Redireciona para `/403` se o usuário não for `superadmin`
3. Exibe `AdminSkeleton` enquanto a sessão está carregando

### Verificação dupla no hook de visão geral

`useTenantsData.ts` verifica novamente `user.role !== "superadmin"` e redireciona para `/dashboard` se necessário. Esta é uma camada de defesa extra no cliente.

### Segurança server-side

O backend (`functions/src/api/middleware/`) valida o `role === "superadmin"` no token Firebase Auth em todas as rotas `/v1/admin/*`. O controle de acesso no frontend é apenas UX — a fonte de verdade é o backend.

---

## Rota `/admin` — Lista de Tenants

### Funcionalidades

- **Busca** por nome da empresa (input com debounce local)
- **Criar empresa:** abre `TenantDialog` em modo criação
- **Editar empresa:** clique no ícone de lápis no card
- **Excluir empresa:** clique no ícone de lixeira → `AlertDialog` de confirmação → exclusão em cascata
- **Acessar painel:** botão "Acessar Painel" → impersonação do tenant via `setViewingTenant()` + redirect para `/dashboard`
- **Clonar dados:** ícone de cópia → `CopyDataDialog` para copiar produtos, serviços, sistemas e ambientes entre tenants

### `TenantCard`

Cada card exibe:

| Campo | Fonte |
|---|---|
| Nome da empresa | `item.tenant.name` |
| Logo (ou inicial) | `item.tenant.logoUrl` |
| Cor de destaque (borda superior) | `item.tenant.primaryColor` |
| Plano | `item.planName` |
| Intervalo de cobrança | `item.billingInterval` (Mensal/Anual) |
| Status da assinatura | `item.subscriptionStatus` |
| Data de vencimento | `item.admin.currentPeriodEnd` ou calculada via `calculateNextBillingDate()` |
| Data de criação | `item.tenant.createdAt` |

Tenants com `subscriptionStatus === "past_due"` têm borda vermelha e badge de "Atrasado".

### Hook `useTenantManagement`

Gerencia todo o estado da página `/admin`:

```typescript
// Carrega via AdminService.getAllTenantsBilling()
// Retorna TenantBillingInfo[] — estrutura que une tenant + admin + billing

interface TenantBillingInfo {
  tenant: {
    id: string; name: string; slug?: string; createdAt: string;
    logoUrl?: string; primaryColor?: string; niche?: string;
    whatsappEnabled?: boolean;
  };
  admin: {
    id: string; name?: string; email: string; phoneNumber?: string;
    subscriptionStatus?: string; currentPeriodEnd?: string;
    subscription?: { status: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean };
  };
  planName: string;
  planId?: string;
  subscriptionStatus?: string;
  billingInterval?: string;
  usage: { users: number; proposals: number; clients: number; products: number };
  planFeatures?: Partial<PlanFeatures>;
}
```

---

## Rota `/admin/overview` — Visão Geral

Dashboard com métricas agregadas de todos os tenants.

### Cards de métricas

| Métrica | Descrição |
|---|---|
| Total de Empresas | `tenantsData.length` com percentual de empresas ativas |
| Usuários Ativos | Soma de `usage.users` em todos os tenants |
| Produtos | Soma de `usage.products` em todos os tenants |
| Propostas | Soma de `usage.proposals` em todos os tenants |

### Tabela de tenants

Colunas: Empresa, Plano, Usuários (com barra de progresso), Produtos, Propostas, Status, Ações.

Filtros:
- Busca por nome da empresa ou email do admin
- Filtro por status: Todos / Ativos / Inativos / Gratuito

### Menu de ações por linha

Disponível via dropdown `TenantActionsMenu`:

| Ação | Função |
|---|---|
| Copiar ID Admin | `navigator.clipboard.writeText(item.admin.id)` |
| Copiar ID Empresa | `navigator.clipboard.writeText(item.tenant.id)` |
| Editar Limites | Abre `EditLimitsDialog` |

### `EditLimitsDialog`

Permite sobrescrever os limites do plano de um tenant específico via `AdminService.updateTenantLimits()`. Os campos editáveis são todos os campos numéricos e booleanos de `PlanFeatures`:

| Campo | Tipo | Descrição |
|---|---|---|
| `maxUsers` | number | -1 = ilimitado |
| `maxProducts` | number | -1 = ilimitado |
| `maxClients` | number | -1 = ilimitado |
| `maxProposals` | number | -1 = ilimitado (por mês) |
| `maxPdfTemplates` | number | -1 = todos |
| `hasFinancial` | boolean | Acesso ao módulo financeiro |
| `canCustomizeTheme` | boolean | Personalização de cores |
| `canEditPdfSections` | boolean | Editor PDF avançado |

### `SubscriptionSyncCard`

Ferramenta administrativa para corrigir inconsistências entre Stripe e Firestore. Duas operações:

- **Simular (dry run):** analisa sem gravar nada — mostra preview de impacto
- **Sincronizar Agora:** grava alterações no Firestore com base no estado atual do Stripe

Configurável: tamanho do lote por requisição (1-500). Exibe contadores de: lotes, scanned, elegíveis, sincronizados, falhas.

Usa paginação via cursor (`startAfterId`) para processar todos os usuários em múltiplas requisições.

---

## Operações de criação/edição de tenant

### `TenantDialog` — campos editáveis

O dialog é compartilhado entre criação e edição. Organizado em abas:

**Aba "Empresa":**

| Campo | Criação | Edição | Obrigatório |
|---|---|---|---|
| Nome da empresa | Sim | Sim | Sim |
| Nicho (`niche`) | Sim | Sim | Sim |
| Cor primária | Sim | Sim | Não |
| URL do logo | Sim | Sim | Não |
| WhatsApp ativado | Sim | Sim | Não |

**Aba "Administrador":**

| Campo | Criação | Edição | Obrigatório |
|---|---|---|---|
| Nome do usuário admin | Sim | Não | Criação: Sim |
| Email | Sim | Sim (opcional) | Criação: Sim |
| Senha | Sim | Sim (opcional) | Criação: Sim (min 6 chars) |
| Telefone | Sim | Sim (opcional) | Não |

**Aba "Plano e Cobrança":**

| Campo | Criação | Edição | Observação |
|---|---|---|---|
| Plano (`planId`) | Sim | Sim | free / starter / pro / enterprise |
| Status da assinatura | Sim | Sim | active / past_due / canceled / trialing / free / inactive |
| Data de vencimento | Sim | Sim | `currentPeriodEnd` (ISO date) |

### Sequência de operações no `handleSave` (edição)

1. `TenantService.updateTenant()` — atualiza campos do tenant
2. `AdminService.updateUserPlan()` — atualiza `planId` do usuário admin (se mudou)
3. `AdminService.updateAdminCredentials()` — atualiza email/senha/telefone (se fornecidos)
4. `AdminService.updateUserSubscription()` — atualiza `subscriptionStatus`, `currentPeriodEnd`, `isManualSubscription`

### Sequência de operações no `handleSave` (criação)

1. `AdminService.createTenant()` → `POST /v1/admin/tenants`
   - Cria o documento do tenant no Firestore
   - Cria o usuário admin no Firebase Auth
   - Cria o documento do usuário no Firestore
   - Retorna `{ tenantId, adminUserId }`

---

## Operação de clonagem de dados

`AdminService.copyTenantData(sourceTenantId, targetTenantId)` → `POST /v1/admin/tenants/copy-data`

Copia para o tenant de destino:
- Produtos (`products`)
- Serviços (`services`)
- Sistemas (`sistemas`)
- Ambientes (`ambientes`)

Retorna `{ totalCopied: number, message?: string }`.

---

## Operação de exclusão de tenant

`AdminService.deleteTenant(tenantId)` → `DELETE /v1/admin/tenants/:tenantId`

Internamente (`TenantService.deleteTenant`), a exclusão é feita em cascata pelo Firestore client SDK:

1. Deleta todos os documentos de `products` com `tenantId`
2. Deleta todos os documentos de `services` com `tenantId`
3. Deleta todos os documentos de `proposals` com `tenantId`
4. Deleta todos os documentos de `custom_options` com `tenantId`
5. Deleta todos os documentos de `clients` com `tenantId`
6. Para cada usuário do tenant: tenta deletar do Firebase Auth, depois deleta do Firestore
7. Deleta o documento do tenant

**Esta operação é irreversível.** O `TenantCard` exige confirmação via `AlertDialog` antes de executar.

---

## Impersonação de tenant (`handleLoginAs`)

O superadmin pode acessar o painel de qualquer tenant sem fazer login com as credenciais desse tenant:

```typescript
const handleLoginAs = (tenant: Tenant) => {
  setViewingTenant(tenant);          // Armazena o tenant no TenantProvider
  toast.info(`Acessando painel de "${tenant.name}"...`);
  router.push("/dashboard");         // Navega para o dashboard do tenant
};
```

O `TenantProvider` mantém o estado de `viewingTenant` separado do tenant "real" do superadmin. Enquanto impersonando, o superadmin vê os dados daquele tenant em todos os módulos.

Para voltar ao painel admin, o superadmin navega manualmente para `/admin`.

---

## Services usados no módulo admin

### `AdminService` (`src/services/admin-service.ts`)

Todas as chamadas passam pelo proxy `/api/backend/*` → Cloud Functions.

| Método | Endpoint | Descrição |
|---|---|---|
| `getAllTenantsBilling()` | `GET /v1/admin/tenants/billing` | Lista todos os tenants com billing info |
| `createTenant(data)` | `POST /v1/admin/tenants` | Cria tenant + usuário admin |
| `deleteTenant(id)` | `DELETE /v1/admin/tenants/:id` | Remove tenant (backend valida) |
| `copyTenantData(src, tgt)` | `POST /v1/admin/tenants/copy-data` | Clona dados entre tenants |
| `updateUserPlan(userId, planId)` | `PUT /v1/admin/users/:id/plan` | Muda plano do admin |
| `updateUserSubscription(userId, data)` | `PUT /v1/admin/users/:id/subscription` | Atualiza status de assinatura |
| `updateAdminCredentials(data)` | `POST /v1/admin/credentials` | Muda email/senha/telefone |
| `updateTenantLimits(tenantId, limits)` | `PUT /v1/admin/tenants/:id/limits` | Sobrescreve limites do plano |

### `TenantService` (`src/services/tenant-service.ts`)

Usado para leitura de tenants (Firestore direto) e `updateTenant()` (via API).

---

## Considerações de segurança

1. **Dupla verificação de role:** o `layout.tsx` bloqueia no cliente; o middleware do backend rejeita requisições sem `role === "superadmin"` no token.

2. **Custom claims no Firebase Auth:** o `role` é armazenado como custom claim no token JWT. É a fonte autoritativa para autorizações no backend. O campo `role` no Firestore é secundário.

3. **Impersonação sem troca de token:** a impersonação via `setViewingTenant` é apenas visual no frontend — o token JWT do superadmin continua sendo usado. O backend valida o `tenantId` nas requisições via custom claims, não via parâmetro de URL. Isso significa que dados de outros tenants retornados via API podem não corresponder ao tenant visualmente selecionado se o backend não tratar o superadmin como caso especial.

4. **Operações destrutivas requerem confirmação:** exclusão de tenants e clonagem de dados têm dialogs de confirmação obrigatórios antes de executar.

5. **Logs de auditoria:** o backend registra operações sensíveis em `security_audit_events` via `functions/src/lib/security-observability.ts`.

6. **Nunca expor este painel para roles não-superadmin:** não adicionar links para `/admin` no menu de navegação padrão. A rota já é protegida pelo layout, mas não deve ser visível para usuários comuns.

---

## Padrão para novos componentes admin

```typescript
interface MeuComponenteAdminProps {
  item: TenantBillingInfo;
  // outras props
}

export function MeuComponenteAdmin({ item }: MeuComponenteAdminProps) {
  // Não verificar role aqui — o layout.tsx já garante que só superadmin chega
  // Usar AdminService para chamadas de API
  // Sempre confirmar operações destrutivas com AlertDialog
}
```
