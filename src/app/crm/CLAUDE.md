# CLAUDE.md — src/app/crm/ (Módulo CRM / Kanban)

## Propósito e usuários

Visualização em **quadro Kanban** das propostas e lançamentos financeiros do tenant. Permite arrastar itens entre colunas para alterar status. É um **add-on de plano** — requer `hasKanban === true` em `usePlanLimits()` para ser acessível (exceto superadmin).

Dois modos de uso:
- **Quadro de Propostas** — pipelines customizáveis com colunas salvas no Firestore (`kanban_statuses`)
- **Quadro de Lançamentos** — colunas fixas (Pendente / Atrasado / Pago) com ordem customizável salva no tenant

---

## Estrutura de rotas

```
/crm                        → Página principal com Tabs (propostas | lançamentos)
/crm?tab=transactions       → Abre diretamente na aba de lançamentos
/crm?scope=proposals        → Modo "scoped": exibe só o quadro de propostas sem as tabs
/crm?scope=transactions     → Modo "scoped": exibe só o quadro de lançamentos sem as tabs
```

O parâmetro `scope` bloqueia a troca de abas — usado quando a página CRM é aberta a partir de um contexto específico (ex: botão "Ver no CRM" na tela de propostas).

---

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `page.tsx` | Rota principal — controla tabs, verifica plano, `scope` param |
| `loading.tsx` | Re-exporta `KanbanSkeleton` para o loading automático do App Router |
| `_components/kanban-skeleton.tsx` | Esqueletos de loading: `KanbanSkeleton` (página inteira) e `KanbanBoardSkeleton` (só o board) |
| `src/components/features/kanban/proposal-kanban-tab.tsx` | Aba de propostas: colunas customizáveis, drag-and-drop, filtros por coluna |
| `src/components/features/kanban/transaction-kanban-tab.tsx` | Aba de lançamentos: colunas fixas, drag-and-drop, toggle "marcar vencidos" |
| `src/components/features/kanban/kanban-board.tsx` | Componente genérico do board — DnD Kit, `KanbanBoard<T>` |
| `src/components/features/kanban/kanban-card.tsx` | Cards visuais: `ProposalKanbanCard` e `TransactionKanbanCard` |
| `src/components/features/kanban/kanban-detail-modal.tsx` | Modais de detalhe: `ProposalDetailModal` e `TransactionDetailModal` |
| `src/components/features/kanban/kanban-status-dialog.tsx` | Dialog para criar/editar colunas do quadro de propostas |
| `src/services/kanban-service.ts` | CRUD de `kanban_statuses` + defaults |
| `src/app/transactions/_hooks/useTransactionStatuses.ts` | Lê e reordena colunas fixas de lançamentos (salva no tenant) |

---

## Modelo de dados — `KanbanStatusColumn`

Coleção Firestore: `kanban_statuses` (somente para propostas; lançamentos usam colunas fixas no código).

```typescript
export interface KanbanStatusColumn {
  id: string;
  tenantId: string;
  label: string;        // Nome da coluna exibido na UI
  color: string;        // Hex — ex: "#3b82f6"
  order: number;        // Posição da coluna (0-indexed)
  mappedStatus?: string; // Status de proposta que esta coluna representa (compat. legada)
  category: "open" | "won" | "lost"; // Impacta métricas de conversão no dashboard
  createdAt: string;
  updatedAt: string;
}
```

---

## Estrutura do Kanban de Propostas

### Colunas e status

Propostas com `status === "draft"` são **filtradas** — o quadro não exibe rascunhos. Os demais status são mapeados para colunas:

| Status Firestore | Coluna padrão | Categoria |
|-----------------|---------------|-----------|
| `in_progress` | Em Aberto | `open` |
| `sent` | Enviada | `open` |
| `approved` | Aprovada | `won` |
| `rejected` | Rejeitada | `lost` |

### Colunas padrão vs customizadas

Quando o tenant ainda não tem colunas no Firestore (`kanban_statuses` vazio):
1. O sistema cria **colunas virtuais** com IDs `default_0`, `default_1`, etc. — não persistidas ainda
2. Na **primeira mutação** (criar coluna, editar, reordenar), `persistDefaultsIfNeeded()` persiste todas as colunas padrão antes de executar a ação
3. Colunas com `id.startsWith("default_")` precisam de tratamento especial ao mapear IDs

```typescript
// Verificar se ainda está usando defaults
const isUsingDefaults = columns.every((c) => c.id.startsWith("default_"));
```

### Drag-and-drop (propostas)

Ao soltar um card em outra coluna:
1. **Update otimista** — `setProposals` atualiza o status localmente
2. Chama `ProposalService.updateProposal(itemId, { status: newStatus })`
3. Em caso de erro, **reverte** o estado local para o status anterior

O `newStatus` é o `id` da coluna de destino (exceto para colunas default, onde usa `mappedStatus`).

### Filtros por coluna

Cada coluna tem um dropdown de filtros independente armazenado em `columnFilters` (Record por `column.id`):

```typescript
Record<string, {
  term: string;                                      // Busca por título
  filterExpiration: "all" | "valid" | "expired";     // Validade
  clientName?: string;                               // Filtro de cliente
  minAmount?: string;                               // Valor mínimo
  maxAmount?: string;                               // Valor máximo
  dateStart?: string;                               // Data início
  dateEnd?: string;                                 // Data fim
}>
```

---

## Estrutura do Kanban de Lançamentos

### Colunas fixas

As colunas de lançamentos são **imutáveis no conteúdo** — só a ordem é customizável:

| ID / Status | Label | Ícone | Cor |
|-------------|-------|-------|-----|
| `pending` | Pendente | Clock | `#f59e0b` |
| `overdue` | Atrasado | AlertTriangle | `#ef4444` |
| `paid` | Pago | Check | `#22c55e` |

A ordem é salva em `tenant.transactionStatusOrder` (array de IDs) via `TenantService.updateTenant()`.

### Modo "marcar vencidos como atrasados"

Toggle na toolbar que reprocessa lançamentos localmente:
- Se `autoOverdue === true` e `t.status === "pending"` e `t.dueDate` está no passado → exibe como `overdue`
- Não altera o Firestore — é apenas uma apresentação visual
- O estado é persistido em `localStorage` com a chave `"kanban_auto_overdue"`

### Drag-and-drop (lançamentos)

Usa `TransactionService.updateTransactionsStatusBatch([itemId], newStatus)` em vez de `updateProposal`. A atualização otimista também seta `paidAt` quando o destino é `paid`.

### Filtros por coluna

Análogos aos de propostas, mas com `filterType: "all" | "income" | "expense"` em vez de `filterExpiration`.

---

## Componente `KanbanBoard<T>` (genérico)

Localizado em `src/components/features/kanban/kanban-board.tsx`. É totalmente genérico — não conhece propostas nem lançamentos.

```typescript
interface KanbanBoardProps<T> {
  columns: KanbanColumn<T>[];
  onDragEnd: (itemId: string, fromColumnId: string, toColumnId: string) => void;
  onColumnDragEnd?: (orderedIds: string[]) => void;   // Para reordenar colunas
  renderCard: (item: T, columnId: string, isDragging?: boolean) => React.ReactNode;
  renderColumnHeader?: (column: KanbanColumn<T>, count: number) => React.ReactNode;
  renderColumnFooter?: (column: KanbanColumn<T>) => React.ReactNode;
  getItemId: (item: T) => string;
  onCardClick?: (item: T) => void;
  emptyMessage?: string;
  isDragEnabled?: boolean;          // Default: true
  showColumnTotals?: boolean;
  getItemValue?: (item: T) => number;
}
```

### Biblioteca de DnD

Usa `@dnd-kit/core` + `@dnd-kit/sortable`. Sensores configurados:
- `PointerSensor` com `activationConstraint: { distance: 8 }` — previne drag acidental em cliques
- `TouchSensor` com `delay: 200, tolerance: 8` — mobile
- `KeyboardSensor` — acessibilidade

### Scroll horizontal do board

O board usa drag-to-scroll nativamente (mouse down + move no container externo) sem conflito com o DnD do `@dnd-kit`. O scroll só é ativado quando não há nenhum card ou coluna sendo arrastado.

### DragOverlay

Enquanto arrasta, o item original fica com `opacity: 0.4` e o overlay flutuante mostra o card com `rotate-2 scale-105 shadow-2xl`. Para colunas, o overlay replica o header e os cards (sem interatividade).

---

## Modais de detalhe

### `ProposalDetailModal`

Abre ao clicar em um card de proposta. Exibe: status, validade, valor total, dados do cliente (nome, email, telefone, endereço), lista de produtos/serviços. Botões de ação: "Editar" (`/proposals/[id]`) e "Ver PDF" (`/proposals/[id]/view`).

Respeita `tenantNiche` para renderizar linhas de produtos corretamente via `getProposalProductMeasurementLabel()` e funções similares de `src/lib/product-pricing.ts`.

### `TransactionDetailModal`

Abre ao clicar em um card de lançamento. Quando `transaction.proposalId` está presente, busca a proposta associada (`ProposalService.getProposalById()`) e exibe os produtos relacionados. Exibe: status, tipo (receita/despesa), badges (entrada, parcela N/M, parcial, origem proposta), cliente, categoria, vencimento, data de pagamento, carteira.

**Atenção:** o campo `wallet` no modal é exibido diretamente (`transaction.wallet`) — pode ser um ID de carteira em dados novos. Se precisar exibir o nome da carteira, resolver com `wallets.find(w => w.id === tx.wallet || w.name === tx.wallet)?.name ?? tx.wallet`.

---

## Verificação de plano

```typescript
const { hasKanban, isLoading: isPlanLoading } = usePlanLimits();

if (!hasKanban && user.role !== "superadmin") {
  return <UpgradeRequired feature="CRM" ... />;
}
```

Superadmin ignora a verificação de plano. Durante `isPlanLoading`, exibe o `KanbanSkeleton`.

---

## Endpoints de API

| Operação | Endpoint | Service |
|----------|----------|---------|
| Listar colunas kanban | Direto no Firestore (`kanban_statuses`) | `KanbanService.getStatuses()` |
| Criar coluna | `POST v1/kanban-statuses` | `KanbanService.createStatus()` |
| Atualizar coluna | `PUT v1/kanban-statuses/:id` | `KanbanService.updateStatus()` |
| Excluir coluna | `DELETE v1/kanban-statuses/:id` | `KanbanService.deleteStatus()` |
| Reordenar colunas | `PUT v1/kanban-statuses/reorder` | `KanbanService.reorderStatuses()` |
| Atualizar status proposta | `PUT v1/proposals/:id` | `ProposalService.updateProposal()` |
| Atualizar status lançamento | `POST v1/transactions/batch-status` | `TransactionService.updateTransactionsStatusBatch()` |
| Salvar ordem de lançamentos | `PUT v1/tenants/:id` | `TenantService.updateTenant()` |

---

## Comportamento de fallback — `category` nas colunas

Colunas mais antigas no Firestore podem não ter o campo `category`. O `KanbanService.getStatuses()` infere a categoria por heurísticas:

```typescript
category =
  mappedStatus === "approved" || label.includes("aprovad") || label.includes("ganha") ? "won" :
  mappedStatus === "rejected" || label.includes("rejeitad") || label.includes("perdid") ? "lost" :
  "open";
```

---

## O que NÃO fazer

- **Nunca** adicionar lógica de negócio diretamente no `KanbanBoard<T>` — ele é genérico e não conhece o domínio.
- **Nunca** atualizar o status de uma proposta para `"draft"` via drag — rascunhos são filtrados do quadro e isso causaria o sumiço do card.
- **Nunca** confiar que colunas do quadro de propostas têm IDs de Firestore reais — colunas ainda não persistidas têm `id.startsWith("default_")`. Sempre checar antes de chamadas ao backend.
- **Não** chamar `KanbanService.reorderStatuses()` com IDs que começam com `"default_"` — persiste os defaults primeiro com `persistDefaultsIfNeeded()`.
- **Não** fazer o modal de detalhe de lançamento buscar automaticamente a proposta sem verificar `transaction.proposalId` — o useEffect já faz essa guarda, mas ao alterar o fluxo, manter a condicionalidade.
- **Não** transformar `page.tsx` em Server Component — usa `useSearchParams`, `useRouter`, e múltiplos hooks de estado.
- **Não** renderizar o CRM sem checar `hasKanban` — o add-on pode não estar ativo no plano do tenant.
- **Não** criar colunas de lançamentos customizadas — as três colunas (`pending`, `overdue`, `paid`) são fixas por design. Apenas a ordem é editável.
- **Não** esquecer de implementar rollback ao estender `handleDragEnd` — toda atualização otimista deve ter um `catch` que reverte o estado local.
