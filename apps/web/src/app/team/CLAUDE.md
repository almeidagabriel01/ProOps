# CLAUDE.md — src/app/team/

## Propósito

Gerenciamento de membros da equipe do tenant. Exclusivo para usuários `MASTER` (donos da empresa). Permite:

- Visualizar todos os membros vinculados ao tenant
- Criar novos membros com email/senha e definir permissões por página
- Editar nome, email e senha de membros existentes
- Excluir membros
- Ajustar permissões granulares por página em tempo real

Membros sem role `MASTER` veem uma tela de "Acesso Restrito" ao acessar esta rota.

---

## Arquivos principais

| Caminho | Responsabilidade |
|---------|-----------------|
| `src/app/team/page.tsx` | Página principal — fetch de membros, controle de permissões, listagem |
| `src/app/team/_components/team-skeleton.tsx` | Skeleton de carregamento |
| `src/components/features/team/` | Todos os componentes e hooks da feature |
| `src/hooks/useCreateMember.ts` | Hook para criar membro via API |
| `src/hooks/useMemberActions.ts` | Hook para editar e excluir membros via API |
| `src/hooks/useUpdatePermissions.ts` | Hook para atualizar permissões granulares via API |
| `src/hooks/usePagePermission.ts` | Hook usado em todas as páginas para verificar permissão |
| `src/providers/permissions-provider.tsx` | Provider central de permissões |

---

## Modelo de Papéis (Roles)

### Roles do sistema (Firebase Auth + Firestore)

O sistema tem dois roles reais:

| Role | Valor no Firestore | Descrição |
|------|--------------------|-----------|
| MASTER | `"MASTER"` (ou legados: `"admin"`, `"superadmin"`) | Dono da empresa. Acesso total irrestrito a todas as páginas e ações. |
| MEMBER | `"MEMBER"` (ou legados: `"user"`, `"free"`) | Membro da equipe. Acesso somente às páginas e ações explicitamente permitidas. |

A função `normalizeRole()` em `permissions-provider.tsx` faz o mapeamento de roles legados para o formato atual.

Há também o role especial `"superadmin"` para acesso à área administrativa do sistema (multi-tenant). Esse role é tratado como MASTER internamente.

### Presets de Role na UI de criação

Ao criar um membro, o usuário escolhe um preset que define as permissões iniciais. Os presets são apenas uma conveniência de UI — as permissões reais ficam no Firestore e podem ser ajustadas individualmente depois.

| Preset (UI) | `roleType` | Permissões iniciais |
|-------------|------------|---------------------|
| Visualizador | `viewer` | `canView: true` em todas as páginas disponíveis |
| Editor | `editor` | `canView + canCreate + canEdit` em todas as páginas |
| Administrador | `admin` | Permissões completas (`canView + canCreate + canEdit + canDelete`) |

A função `getDefaultPermissions(roleType, hasFinancial)` em `src/hooks/useCreateMember.ts` retorna o mapa de permissões correspondente.

---

## Páginas disponíveis para permissão

Definidas em `AVAILABLE_PAGES` em `src/components/features/team/team-types.ts`:

| `id` (pageId) | Nome exibido | viewOnly |
|---------------|--------------|----------|
| `dashboard` | Dashboard | sim (sem create/edit/delete) |
| `kanban` | CRM | — |
| `proposals` | Propostas | — |
| `clients` | Clientes | — |
| `products` | Produtos | — |
| `services` | Servicos | — |
| `spreadsheets` | Planilhas | — |
| `calendar` | Calendario | — |
| `transactions` | Lancamentos (Financeiro) | — |
| `wallet` | Carteira (Financeiro) | — |
| `solutions` | Solucoes | — |

As páginas financeiras (`transactions`, `wallet`) são ocultadas em `MemberCard` quando o plano do tenant não inclui o módulo financeiro (`hasFinancial = false`).

---

## Sistema de Permissões

### Estrutura no Firestore

```
users/{userId}/                       # Documento do usuário
  role: "MASTER" | "MEMBER"
  masterId: string | null             # ID do MASTER dono do tenant (null se for MASTER)
  tenantId: string

users/{userId}/permissions/{pageId}/  # Subcoleção de permissões
  canView: boolean
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  pageSlug: string
```

### `PermissionsProvider` (`src/providers/permissions-provider.tsx`)

Provider global montado no root layout. Ao inicializar:

1. Busca o documento `users/{userId}` para ler `role`, `masterId`, `companyId`
2. Se `role === "MEMBER"`, tenta buscar o nome do MASTER (para exibição)
3. Busca a subcoleção `users/{userId}/permissions` para obter as permissões de cada página
4. Para usuários `MASTER`, pré-popula pages padrão com permissão total

Expõe via contexto:

```typescript
{
  permissions: UserPermissions | null
  isLoading: boolean
  hasPermission: (pageId: string, action: "view"|"create"|"edit"|"delete") => boolean
  isMaster: boolean
  isMember: boolean
  refreshPermissions: () => Promise<void>
}
```

**MASTER bypass**: usuários `MASTER` sempre retornam `true` em qualquer `hasPermission()`. A verificação individual de página não é nem consultada.

### `usePagePermission(pageId)` (`src/hooks/usePagePermission.ts`)

Hook de conveniência sobre `usePermissions`. Retorna:

```typescript
{
  isLoading: boolean
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}
```

Enquanto `isLoading=true` ou `permissions===null`, todos os campos retornam `false` para evitar race conditions que causariam negações incorretas de acesso.

Usado em todas as páginas protegidas e em `QuickActionsCard` do dashboard.

---

## Fluxo de criação de membro

A criação é um wizard de 3 passos (`StepWizard`):

```
Passo 1 — Informacoes
  └── MemberInfoStep: nome, email, senha, telefone

Passo 2 — Nivel de Acesso
  └── RoleSelectionStep: escolha do preset (viewer | editor | admin)

Passo 3 — Personalizar Permissoes
  └── PermissionsStep: ajuste fino por página (toggle canView/canCreate/canEdit/canDelete)
```

Ao confirmar no passo 3, `useCreateMemberForm` chama `useCreateMember.createMember()`:

```
POST /v1/admin/members
Body: { name, email, password, phoneNumber, permissions }
```

O backend (`members.controller.ts`) cria o usuário no Firebase Auth e grava o documento em Firestore, vinculando `masterId` ao usuário atual. Também escreve os documentos de permissão na subcoleção `users/{newMemberId}/permissions/`.

### Limites de plano

Antes de submeter, `usePlanLimits` é consultado. Se o limite de membros do plano for atingido, o hook emite um erro com código `resource-exhausted` ou `failed-precondition`, e a `CreateMemberSection` exibe o `UpgradeModal` em vez de um toast de erro.

---

## Atualização de permissões em tempo real

Ao alterar um toggle em `PagePermissionRow`, o fluxo é:

1. `MemberCard` chama `onUpdatePermission(memberId, pageId, key, value)`
2. `TeamPage` delega para `updateSinglePermission` de `useUpdatePermissions`
3. Chamada: `PUT /v1/admin/members/permissions` com `{ targetUserId, pageId, key, value, mode: "single" }`
4. Em caso de sucesso, o estado local `members` é atualizado otimisticamente

Regra de cascata: ao desativar `canView`, os campos `canCreate`, `canEdit` e `canDelete` são automaticamente zerados (lógica no `updatePermission` de `page.tsx`).

---

## Isolamento multi-tenant

- A query de membros filtra por `masterId === user.id` — um MASTER só vê os membros vinculados a ele, nunca de outros tenants.
- Quando o usuário logado é `superadmin`, o `masterId` da query é `tenantOwner.id` (o master do tenant visualizado).
- As permissões são armazenadas na subcoleção do próprio usuário — o MASTER não consegue ver permissões de membros de outros tenants pelas regras do Firestore.

---

## Custom Claims no Firebase Auth

Os custom claims são gerenciados pelo backend e carregados no ID token:

| Claim | Valor | Descrição |
|-------|-------|-----------|
| `tenantId` | string | ID do tenant ao qual o usuário pertence |
| `role` | string | Role do usuário (`MASTER` / `MEMBER`) |
| `masterId` | string | ID do master (para membros) |

O backend usa os custom claims para autorização rápida sem precisar buscar o Firestore. Para casos onde os claims estão desatualizados (stale claims), o middleware do backend tem um fallback que busca o documento do usuário diretamente.

---

## Componentes de `src/components/features/team/`

| Arquivo | Componente | Descrição |
|---------|-----------|-----------|
| `index.ts` | barrel | Re-exporta `TeamMember`, `Permission`, `CreateMemberSection`, `MemberCard` |
| `team-types.ts` | tipos | `TeamMember`, `Permission`, `AVAILABLE_PAGES`, `ROLE_PRESETS` |
| `team-constants.tsx` | constantes | `roleConfig` (estilos por papel), `steps` (wizard) |
| `create-member-section.tsx` | `CreateMemberSection` | Container do wizard de criação |
| `member-card.tsx` | `MemberCard` | Card expansível com info + painel de permissões |
| `member-modals.tsx` | `EditMemberModal`, `DeleteMemberDialog` | Modais de edição e exclusão |
| `page-permission-row.tsx` | `PagePermissionRow` | Linha de permissão por página (toggles) |
| `permission-toggle.tsx` | `PermissionToggle` | Toggle individual de permissão |
| `steps/` | — | Componentes dos 3 passos do wizard |
| `hooks/` | — | Hooks internos da feature |

---

## Paginação de membros

A listagem usa `useInfiniteScroll(members, 6)` (`src/hooks/useInfiniteScroll.ts`): exibe 6 membros inicialmente e carrega mais ao rolar até o sentinel element. Evita renderizar todos os cards de uma vez em equipes grandes.

---

## Operações de membro via API

| Ação | Hook | Rota |
|------|------|------|
| Criar membro | `useCreateMember` | `POST /v1/admin/members` |
| Editar membro | `useMemberActions.updateMember` | `PUT /v1/admin/members/:id` |
| Excluir membro | `useMemberActions.deleteMember` | `DELETE /v1/admin/members/:id` |
| Atualizar permissão | `useUpdatePermissions.updateSinglePermission` | `PUT /v1/admin/members/permissions` |
| Atualizar permissões em lote | `useUpdatePermissions.updatePermissions` | `PUT /v1/admin/members/permissions` |

Todas as operações são implementadas como chamadas HTTP ao proxy `/api/backend/*` via `callApi` de `src/lib/api-client.ts`.

---

## Casos especiais

- **Acesso negado para MEMBER**: se `isMaster === false` após carregamento, a página exibe ícone de escudo com mensagem "Acesso Restrito". Nenhum dado é carregado.
- **Superadmin visualizando tenant**: quando `user.role === "superadmin"` e há um tenant/tenantOwner selecionado, a query de membros usa `tenantOwner.id` como `masterId`.
- **Superadmin sem tenantOwner**: se o superadmin ainda não selecionou um tenant, o fetch é abortado prematuramente (`if (!tenantOwner?.id) return`).
