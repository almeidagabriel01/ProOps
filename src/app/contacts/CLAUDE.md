# CLAUDE.md — src/app/contacts/ (Módulo de Contatos)

## Propósito e usuários

Gerencia a base de **clientes e fornecedores** do tenant. Qualquer membro da equipe com permissão `clients` pode visualizar. Criação requer `canCreate`, edição requer `canEdit`, exclusão requer `canDelete`.

Clientes podem ser criados de três formas:
- **Manual** — pelo formulário em `/contacts/new`
- **Via Proposta** — automaticamente quando uma proposta é criada com novo cliente
- **Via Financeiro** — automaticamente quando um lançamento é criado com novo cliente

---

## Estrutura de rotas

```
/contacts              → Listagem paginada com busca e filtro de tipo
/contacts/new          → Formulário de criação (StepWizard em 3 passos)
/contacts/[id]         → Formulário de edição / visualização somente leitura
```

Não há sub-rota de API aqui — todas as mutações passam por `/api/backend/` (proxy → Cloud Functions).

---

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `page.tsx` | Página de listagem — Client Component. Orquestra estado via `useContactsCtrl` |
| `_hooks/use-contacts-ctrl.ts` | Hook de controle central: paginação, busca, filtro de tipo, exclusão |
| `_components/contacts-toolbar.tsx` | Barra de busca + filtros "Todos / Clientes / Fornecedores" |
| `_components/contacts-columns.tsx` | Definição das colunas do `DataTable` (função `createColumns`) |
| `_components/contacts-empty-states.tsx` | `ContactsEmptyState` (zero clientes) e `ContactsNoResults` (busca sem resultado) |
| `_components/contacts-skeleton.tsx` | Skeleton do cabeçalho da página durante loading inicial |
| `_components/contacts-table-skeleton.tsx` | Skeleton da tabela durante carregamento de dados |
| `_components/delete-client-dialog.tsx` | AlertDialog de confirmação de exclusão |
| `[id]/page.tsx` | Edição/visualização de cliente — Client Component com StepWizard |
| `new/page.tsx` | Criação de novo cliente — Client Component com StepWizard |
| `src/services/client-service.ts` | Acesso ao Firestore para leitura e chamadas à API para escrita |
| `src/hooks/useClientActions.ts` | `createClient` e `deleteClient` via Cloud Functions |

---

## Modelo de dados — tipo `Client`

Definido em `src/services/client-service.ts`:

```typescript
export type ClientSource = "manual" | "proposal" | "financial";
export type ClientType  = "cliente" | "fornecedor";

export type Client = {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  types: ClientType[];      // Array — permite ser cliente E fornecedor ao mesmo tempo
  source: ClientSource;     // Origem do cadastro
  sourceId?: string;        // ID da proposta ou lançamento que criou o cliente
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
};
```

### Campos críticos

- **`types`** — array que permite múltiplos tipos. Nunca assume que será um único valor. Sempre usar `types.includes("cliente")`.
- **`source`** — determina a badge exibida na coluna "Origem" (`manual` → azul, `proposal` → verde, `financial` → âmbar).
- **`sourceId`** — referência bidirecional ao objeto que criou o cliente automaticamente. Não editável na UI.

---

## Lógica de negócio

### Regra de exclusão

Antes de excluir um cliente, o sistema verifica se ele está vinculado a alguma proposta usando `ProposalService.isClientUsedInProposal()`. Se sim, a exclusão é bloqueada com uma mensagem de erro.

```typescript
// Em use-contacts-ctrl.ts — handleDelete()
const isUsed = await ProposalService.isClientUsedInProposal(clientToDelete.id, tenant.id);
if (isUsed) {
  toast.error("Não é possível excluir este cliente pois ele está vinculado a uma ou mais propostas.");
  return;
}
```

### Limite de plano

`/contacts/new` verifica `usePlanLimits().canCreateClient()` antes de permitir a criação. Se o limite for atingido, abre o `LimitReachedModal` com `resourceType="clients"`.

### Tipos múltiplos

Um cadastro pode ser simultaneamente "cliente" e "fornecedor". O formulário usa botões toggle (não radio buttons), garantindo que pelo menos um tipo esteja sempre selecionado:

```typescript
// Se desmarcar o único tipo selecionado, o tipo é mantido no array
return { ...prev, types: newTypes.length > 0 ? newTypes : ["cliente"] };
```

---

## Gerenciamento de estado

### `useContactsCtrl` — arquitetura dual-mode

O hook opera em dois modos distintos:

| Modo | Quando ativo | Estratégia de dados |
|------|-------------|---------------------|
| **Paginado** | `isFiltering === false` | `DataTable` com `fetchPage` callback — cursor-based pagination via `getClientsPaginated()` |
| **Filtrado** | `isFiltering === true` | Busca todos os clientes (`getClients()`) e filtra/ordena no cliente |

`isFiltering` é `true` quando `searchTerm.trim() !== ""` **ou** `typeFilter !== "todos"`.

```typescript
const isFiltering = searchTerm.trim() !== "" || typeFilter !== "todos";
```

### Reset de paginação

`resetRef` é um `React.Ref<(() => void) | null>` que aponta para o método de reset interno do `DataTable`. Chamado quando `sortConfig` muda ou após uma exclusão bem-sucedida.

### Estado de "tem clientes"

`hasAnyClients: boolean | null` controla se a `ContactsToolbar` e o `DataTable` são renderizados ou se o `ContactsEmptyState` é exibido:
- `null` — ainda carregando
- `false` — zero clientes no tenant
- `true` — há pelo menos um cliente

---

## Chamadas de API e acesso a dados

### Leituras (direto no Firestore via SDK — Client Component)

| Método | Descrição |
|--------|-----------|
| `ClientService.getClients(tenantId)` | Todos os clientes do tenant, ordenados por nome |
| `ClientService.getClientsPaginated(tenantId, pageSize, cursor, sortConfig)` | Paginação cursor-based |
| `ClientService.getClientById(id)` | Busca por ID — usada na tela de edição |
| `ClientService.getClientByEmail(tenantId, email)` | Busca por email — usada para deduplicação |
| `ClientService.getClientByName(tenantId, name)` | Busca por nome exato |

### Escritas (via Cloud Functions, sempre autenticadas)

| Operação | Endpoint | Hook/Service |
|----------|----------|--------------|
| Criar cliente | `POST v1/clients` | `useClientActions().createClient()` |
| Atualizar cliente | `PUT v1/clients/:id` | `ClientService.updateClient()` |
| Excluir cliente | `DELETE v1/clients/:id` | `useClientActions().deleteClient()` |

---

## Padrões de UI

### Tabela de listagem (`page.tsx`)

A `DataTable` recebe colunas criadas por `createColumns({ canEdit, canDelete, onDelete })`. As colunas são:

| Coluna | Campo | Notas |
|--------|-------|-------|
| Nome | `name` | Link para `/contacts/[id]` |
| Tipo | `types` | Badges: "Cliente" (default) / "Fornecedor" (outline) |
| Endereço | `address` | Texto truncado |
| Contato | `email` + `phone` | Exibidos com ícones |
| Origem | `source` | Badge colorida: manual/proposal/financial |
| Ações | — | Botões de editar e excluir condicionais por permissão |

### Formulário em StepWizard (3 passos)

Usado tanto em `/contacts/new` quanto em `/contacts/[id]`:

| Passo | Conteúdo | Validação |
|-------|----------|-----------|
| 1 — Informações | Tipo (cliente/fornecedor), Nome, Email, Telefone | `name` e `phone` obrigatórios (validação em `validateStep1`) |
| 2 — Endereço | Campo de endereço livre | Opcional |
| 3 — Finalizar | Observações + resumo dos dados | Submissão |

O botão "Próximo" do passo 1 é bloqueado até que `validateStep1()` retorne `true`.

### Visualização somente leitura

Se o usuário tem `canView` mas não `canEdit`, a página `/contacts/[id]` exibe os mesmos passos com componentes `FormStatic` (leitura) em vez de inputs. O botão de submit vira "Voltar".

### Detecção de alterações

Em `/contacts/[id]`, o botão "Salvar Alterações" só fica habilitado quando `hasChanges === true`. Isso é calculado comparando um snapshot JSON dos dados atuais contra o snapshot inicial:

```typescript
const buildCustomerFormSnapshot = (formData: EditCustomerFormData): string =>
  JSON.stringify({ name, email, phone, address, notes, types: [...types].sort() });
```

---

## O que NÃO fazer

- **Nunca** importar Firebase SDK diretamente em `page.tsx` ou nos componentes — use `ClientService` para leituras e `useClientActions` para escritas.
- **Nunca** assumir que `client.types` tem um único elemento — é sempre um array. Checar com `types.includes("cliente")`, não `types[0] === "cliente"`.
- **Nunca** renderizar `client.types` diretamente como string — mapear com `typeConfig` ou verificar individualmente.
- **Não** excluir cliente sem verificar `ProposalService.isClientUsedInProposal()` — o backend também bloqueia, mas a verificação no frontend evita erros desnecessários.
- **Não** exibir o `ContactsToolbar` antes de confirmar `hasAnyClients !== false` — evita flash de toolbar vazia.
- **Não** criar campo de busca que faça query Firestore por nome parcial — Firestore não suporta LIKE. A busca é client-side: carrega todos os clientes e filtra com `normalize()`.
- **Não** alterar `/contacts/[id]` para ser Server Component — depende de `useRouter`, `useParams`, e vários hooks de estado.
