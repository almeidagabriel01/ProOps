# CLAUDE.md — src/app/contacts/ (Módulo de Contatos)

## Propósito e usuários

Gerencia a base de **contatos** do tenant: clientes, fornecedores, vendedores e arquitetos. Qualquer membro da equipe com permissão `clients` pode visualizar. Criação requer `canCreate`, edição requer `canEdit`, exclusão requer `canDelete`.

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
                         (StepWizard em 3 passos, os MESMOS da criação)
```

Não há sub-rota de API aqui — todas as mutações passam por `/api/backend/` (proxy → Cloud Functions).

---

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `page.tsx` | Página de listagem — Client Component. Orquestra estado via `useContactsCtrl` |
| `_hooks/use-contacts-ctrl.ts` | Hook de controle central: paginação, busca, filtro de tipo, exclusão |
| `_components/contacts-toolbar.tsx` | Barra de busca + filtros "Todos / Clientes / Fornecedores / Vendedores / Arquitetos" |
| `_components/contact-type-selector.tsx` | Seleção múltipla do tipo. **Compartilhado** pelo cadastro e pela edição |
| `_components/contact-commission-field.tsx` | Comissão padrão do parceiro, no passo dos dados fiscais. **Compartilhado** |
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
export type ClientType  = "cliente" | "fornecedor" | "vendedor" | "arquiteto";

export type Client = {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  types: ClientType[];      // Array — permite ser fornecedor E arquiteto ao mesmo tempo
  commissionPercentage?: number | null;  // Comissão padrão; só para vendedor/arquiteto
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
- **`commissionPercentage`** — percentual padrão do parceiro, usado só para
  pré-preencher a proposta; o valor que vale é o gravado em
  `Proposal.commissions[]`. Em branco é `null`, **nunca `0`**: zero é um
  percentual válido, e deixar passar faria a proposta nascer com uma comissão
  que ninguém escolheu.

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

Um cadastro pode ser simultaneamente "fornecedor" e "arquiteto". O formulário usa
botões toggle (não radio buttons), garantindo que pelo menos um tipo esteja sempre
selecionado: desmarcar o único tipo marcado o mantém, porque o backend grava
`["cliente"]` por omissão e reverteria a escolha sem avisar.

O bloco vive em `_components/contact-type-selector.tsx`, **um só para as duas
telas**. Antes eram duas cópias independentes de ~110 linhas, e um tipo novo
entraria só numa delas. Guard: `_components/__tests__/contact-type-selector.test.tsx`.

**Vendedor e arquiteto são tipos de contato, não cadastro próprio.** O contato já
tem nome, telefone, documento, `searchTokens`, regra de Firestore e tela; e como
`types` sempre foi array, a mesma pessoa pode ser fornecedor e arquiteto. Os dois
recebem comissão, definida na proposta (ver `Proposal.commissions[]`).

`isCommissionPartner` e a lista dos papéis ficam em
`src/lib/contacts/commission-partner.ts`, **fora** do `client-service`: aquele
arquivo importa o SDK do Firebase, e quem precisa só da lista passaria a
inicializar auth, firestore e storage junto.

A **comissão padrão** vive em `_components/contact-commission-field.tsx`, fora
deste seletor e no passo seguinte: é consequência do tipo, mas não é dado de
contato nem dado fiscal, e no meio do cadastro lia-se como se fosse. O campo é o
`Input` comum com sufixo de porcentagem, o mesmo padrão dos demais percentuais do
produto; era um `DecimalInput` (32px de altura, centralizado, semibold),
desenhado para linha de tabela e destoando de todos os outros campos do
formulário. Em branco continua sendo `null`, nunca 0. Guard:
`_components/__tests__/contact-commission-field.test.tsx`.

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
| Tipo | `types` | Badges: "Cliente" (default) / "Fornecedor" (outline) / "Vendedor" (success) / "Arquiteto" (warning) |
| Endereço | `address` | Texto truncado |
| Contato | `email` + `phone` | Exibidos com ícones |
| Origem | `source` | Badge colorida: manual/proposal/financial |
| Ações | — | "Pasta no Drive", editar e excluir |

A ação **"Pasta no Drive"** (`OpenDriveFolderButton` com `iconOnly`) fica na
listagem, não dentro do cadastro: chegar à pasta não deveria exigir abrir o
formulário de um contato por vez — o caso de uso é o vendedor na casa do
cliente, no celular. Ela **não** é gateada por `canEdit`: abrir a pasta não
altera nada, e prendê-la à edição a esconderia justamente de quem tem só
leitura. O gate de plano (`hasDriveSync`) vive dentro do próprio botão, que se
esconde sozinho — não reimplementar isso na coluna. Guard:
`_components/__tests__/contacts-columns.test.tsx`.

### Formulário em StepWizard

**As duas telas têm os MESMOS 3 passos.** A criação e a edição divergirem é o
defeito clássico daqui:

O passo 1 responde "quem é este contato". O passo 2 junta o que quase todo
cadastro pula.

| Passo | Conteúdo | Validação |
|-------|----------|-----------|
| 1 — Informações | Tipo (um ou mais dos quatro), Nome, Email, Telefone, CPF/CNPJ, endereço livre | `name` e `phone` obrigatórios (validação em `validateStep1`) |
| 2 — Dados Fiscais | `ContactCommissionField` (só para vendedor/arquiteto) + `ClientFiscalFields` com `variant="step"` | Opcional |
| 3 — Finalizar | Observações + resumo dos dados | Submissão |

O botão "Próximo" do passo 1 é bloqueado até que `validateStep1()` retorne `true`.

Duas correções trouxeram a trilha até aqui, e nenhuma das duas falhas dava erro:

- Até 2026-09-08 os dados fiscais eram uma `FormSection` **recolhida** dentro do
  passo Finalizar. Fechada embaixo do resumo, ninguém achava o endereço fiscal,
  que é justamente o que a NF-e exige do destinatário. Viraram passo, e por isso
  o bloco não recolhe.
- Até 2026-09-09 esse passo existia **só na edição**: quem cadastrava um cliente
  para faturar salvava e reabria o contato para achar o campo. Guard:
  `new/__tests__/page.test.tsx`.

**A comissão divide o passo com o bloco fiscal, mas com cabeçalho próprio**
(`_components/contact-commission-field.tsx`). Ela **não é dado fiscal**: não
entra em campo nenhum da NF-e, alimenta `Proposal.commissions[]` e vira despesa
no financeiro. Sem a separação visual seria lida como campo da nota. O custo
conhecido dessa arrumação: no celular a trilha mostra só o TÍTULO do passo, então
um vendedor pode passar por "Dados Fiscais" sem ver a comissão. É recuperável
(o percentual é opcional e pode ser digitado na proposta), diferente de um
endereço fiscal ausente, que só aparece como lacuna na hora de emitir.

O endereço livre acompanha o fiscal enquanto ninguém escreveu nele à mão
(`isDerivedFreeAddress`, em `lib/fiscal/format-address.ts`). A condição era só
"está vazio", e isso congelava o campo na PRIMEIRA tecla digitada no logradouro:
o cadastro terminava com "R" de endereço. Texto próprio nunca é sobrescrito.

> **O array `customerSteps` de `[id]/page.tsx` alimenta DOIS wizards** — o de
> edição e o somente-leitura. Passo declarado sem card correspondente vira um
> passo clicável e **vazio**, sem erro nenhum: o `StepWizard` casa conteúdo por
> posição. Ao acrescentar um passo, acrescente o card nos dois. Guard:
> `src/__tests__/step-wizard-children-parity.test.ts`.

### Visualização somente leitura

Se o usuário tem `canView` mas não `canEdit`, a página `/contacts/[id]` exibe os mesmos passos com componentes `FormStatic` (leitura) no lugar dos inputs, inclusive o passo de dados fiscais, que mostra a comissão do parceiro e o endereço montado por `formatEnderecoFiscal`. O botão de submit vira "Voltar".

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
- **Nunca** duplicar o seletor de tipos numa tela nova — use `ContactTypeSelector`.
- **Nunca** renderizar `client.types` diretamente como string — mapear com `typeConfig` ou verificar individualmente.
- **Não** excluir cliente sem verificar `ProposalService.isClientUsedInProposal()` — o backend também bloqueia, mas a verificação no frontend evita erros desnecessários.
- **Não** exibir o `ContactsToolbar` antes de confirmar `hasAnyClients !== false` — evita flash de toolbar vazia.
- **Não** criar campo de busca que faça query Firestore por nome parcial — Firestore não suporta LIKE. A busca é client-side: carrega todos os clientes e filtra com `normalize()`.
- **Não** alterar `/contacts/[id]` para ser Server Component — depende de `useRouter`, `useParams`, e vários hooks de estado.
