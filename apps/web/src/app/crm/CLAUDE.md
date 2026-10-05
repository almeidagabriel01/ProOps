# CLAUDE.md — src/app/crm/ (Módulo CRM / Kanban)

## Propósito e usuários

Visualização em **quadro Kanban** das propostas e lançamentos financeiros do tenant. Permite arrastar itens entre colunas para alterar status. É um **add-on de plano** — requer `hasKanban === true` em `usePlanLimits()` para ser acessível (exceto superadmin).

Três modos de uso:
- **Quadro de Propostas** — pipelines customizáveis com colunas salvas no Firestore (`kanban_statuses`)
- **Quadro de Leads** — a oportunidade ANTES da proposta, em etapas fixas (ver "Leads e atividades")
- **Quadro de Lançamentos** — colunas fixas (Pendente / Atrasado / Pago) com ordem customizável salva no tenant

---

## Estrutura de rotas

```
/crm                        → Página principal com Tabs (leads | propostas | lançamentos), abrindo em propostas
/crm?tab=transactions       → Abre diretamente na aba de lançamentos
/crm?tab=leads              → Abre na aba de leads
/crm?tab=leads&lead=<id>    → Abre a ficha do lead (link do lembrete no sino)
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
| `src/services/kanban-board-service.ts` | Queries paginadas por coluna (propostas/lançamentos) + contagem via aggregation |
| `src/app/transactions/_hooks/useTransactionStatuses.ts` | Lê e reordena colunas fixas de lançamentos (salva no tenant) |

---

## Leads e atividades (Onda 2, 2026-09-25)

Quem pediu contato e ainda não tem proposta: origem, valor estimado, próxima ação
com data e uma linha do tempo de atividades (ligação, visita, reunião, tarefa...).

As quatro camadas de acesso, decididas pelo dono do produto:

| Camada | Decisão |
|---|---|
| Permissão | a mesma do CRM: pageId `kanban` (ver/criar/editar/excluir) |
| Plano | junto do CRM: `requirePlanCapability("crm")` em `/leads` e `/activities` (`crm.routes.ts`) |
| Demo | sim, só leitura: o seed põe 3 leads e 3 atividades no tenant `demo` |
| Rules | `leads` e `activities`: leitura do tenant (e `isDemoRead`), escrita só pela API |

- **Leitura direta no Firestore, escrita pela API** (`services/leads-service.ts`), como
  o resto do CRM. É o que faz a conta free enxergar o tenant `demo`: a API responde com
  o tenant da CONTA, que não tem dado nenhum.
- **Etapas fixas** (`_lib/leads.ts`): Novo, Em contato, Qualificado, Convertido,
  Perdido. O funil de propostas já é personalizável; personalizar os dois dobraria a
  configuração sem ganho.
- **"Convertido" só pela conversão.** `POST /v1/leads/:id/convert` cria o contato
  (com o teto `maxClients` do plano e a permissão de criar contato), ou reaproveita o
  já ligado, e marca o lead. Arrastar para a coluna abre a confirmação da conversão; o
  PUT recusa `stage: "convertido"` num lead sem contato. Depois a tela segue para
  `/proposals/new?clientId=...`, que já abre com o contato escolhido (o mesmo link da
  ficha 360).
- **Lembrete:** o cron `checkDueDates` (parte 2c, `lead-reminders.ts`) cria a
  notificação `lead_reminder` no dia da próxima ação de lead aberto e no prazo de
  atividade não concluída, um aviso por item e dia.
- Excluir o lead apaga as atividades dele junto.

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

## Carga por coluna (paginada) — `KanbanBoardService`

O board **nunca baixa a coleção inteira**. Cada coluna carrega no máximo **30 cards**
por página (`KANBAN_COLUMN_PAGE_SIZE`), via query Firestore direta por coluna:

- **Propostas**: `where("tenantId","==",...)` + `where("status","in", [colId, mappedStatus])`
  + `orderBy("createdAt","desc")` + `limit(30)`. Índice: `(tenantId, status, createdAt DESC)`.
  Colunas virtuais (`default_*`) consultam só o `mappedStatus`.
- **Lançamentos**: `where("tenantId","==",...)` + `where("status","==", pending|overdue|paid)`
  + `orderBy("date","desc")` + `limit(30)`. Índice: `(tenantId, status, date DESC)`.

Comportamento:

- **"Carregar mais"** no rodapé da coluna (via `renderColumnFooter`) busca +30 com
  cursor `startAfter` enquanto `hasMore` (página cheia = provavelmente há mais).
- **Contagem do header** vem de `getCountFromServer` (aggregation, 1 leitura/1000 docs)
  — o badge mostra o total real da coluna mesmo com só 30 cards carregados. Com filtro
  local ativo na coluna, o badge volta a mostrar a contagem dos cards filtrados/carregados.
- O **total monetário** do header soma apenas os cards carregados (não é aggregation).
- Os **filtros por coluna** (busca, cliente, valor, data) aplicam-se apenas aos cards
  já carregados — são client-side.
- Drag-and-drop ajusta os totais das colunas de origem/destino de forma otimista
  (decrementa/incrementa), com rollback em caso de erro da API.
- Estado por coluna (`cursor`, `hasMore`, `total`, `isLoadingMore`) é mantido nos tabs,
  chaveado por `columnStatusKey` (propostas — statuses ordenados unidos por `|`) ou pelo
  status fixo (lançamentos). O pool local de docs é deduplicado por `id` (`mergeById`).
- Lançamentos aplicam `withDerivedOverdue` na leitura (igual `getTransactions`) — um doc
  `pending` vencido pode aparecer na coluna Atrasado; o badge reflete o status persistido.

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
| Página de cards da coluna | Direto no Firestore (`proposals`/`transactions`, paginado) | `KanbanBoardService.getProposalColumnPage()` / `getTransactionColumnPage()` |
| Total da coluna | Aggregation `getCountFromServer` | `KanbanBoardService.countProposalColumn()` / `countTransactionColumn()` |
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
