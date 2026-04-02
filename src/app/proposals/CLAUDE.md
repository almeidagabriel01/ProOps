# CLAUDE.md — src/app/proposals/

## Propósito

Módulo de propostas comerciais do ProOps. Permite criar, editar, visualizar, duplicar, compartilhar e baixar propostas em PDF. Usado por membros da equipe com permissão `proposals` (visualizar/criar/editar/excluir).

O fluxo completo é: criar proposta em wizard multi-etapas → salvar → visualizar preview → personalizar PDF → compartilhar link público ou baixar PDF → ao aprovar, gera transações financeiras no módulo financeiro.

---

## Estrutura de Rotas

| Rota | Arquivo | O que faz |
|------|---------|-----------|
| `/proposals` | `page.tsx` | Listagem paginada de propostas com busca, filtro, ações inline |
| `/proposals/new` | `new/page.tsx` | Cria nova proposta — renderiza `SimpleProposalForm` sem `proposalId` |
| `/proposals/[id]` | `[id]/page.tsx` | Edita proposta existente — renderiza `SimpleProposalForm` com `proposalId` |
| `/proposals/[id]/view` | `[id]/view/page.tsx` | Preview da proposta renderizada como PDF (componente React) |
| `/proposals/[id]/edit-pdf` | `[id]/edit-pdf/page.tsx` | Editor visual de PDF: tema, capa, seções, fontes (Pro+) |
| `/share/[token]` | `src/app/share/[token]/page.tsx` | Visualização pública sem autenticação via token |

---

## Tabela de Arquivos Chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/proposals/page.tsx` | Listagem com paginação infinita, busca, status kanban, download/share/duplicar/excluir |
| `src/app/proposals/new/page.tsx` | Guard de permissão + renderiza `SimpleProposalForm` |
| `src/app/proposals/[id]/page.tsx` | Guard de permissão/view + renderiza `SimpleProposalForm` |
| `src/app/proposals/[id]/view/page.tsx` | Preview com sincronização de dados frescos de clients/products/sistemas |
| `src/app/proposals/[id]/edit-pdf/page.tsx` | Layout do editor de PDF (painel esquerdo + preview ao vivo) |
| `src/app/proposals/_components/proposals-skeleton.tsx` | Skeleton full-page para carregamento inicial |
| `src/app/proposals/_components/proposals-table-skeleton.tsx` | Skeleton da tabela (carregamento de mais páginas) |
| `src/app/proposals/_components/proposals-empty-skeleton.tsx` | Skeleton do estado vazio |
| `src/components/features/proposal/simple-proposal-form.tsx` | Wizard multi-etapas: componente principal de criação/edição |
| `src/components/features/proposal/proposal-form.tsx` | Form legado (ainda existente, não é o principal) |
| `src/components/features/proposal/edit-pdf/use-edit-pdf-page.ts` | Hook completo do editor de PDF: estado + save + geração |
| `src/components/features/proposal/pdf/use-pdf-generator.ts` | Hook centralizado para download de PDF via backend Playwright |
| `src/components/pdf/proposal-pdf-viewer.tsx` | Renderizador React do PDF (usado em view e edit-pdf) |
| `src/components/pdf/templates/ProposalPdfTemplate.tsx` | Template React do PDF com suporte a themes, seções, capa |
| `src/hooks/proposal/useProposalForm.ts` | Entry-point do hook de formulário (delega para core) |
| `src/hooks/proposal/useProposalForm.core.ts` | Core: auto-save de rascunho, load de proposta existente, orquestração |
| `src/hooks/proposal/useProposalForm.types.ts` | Interfaces `UseProposalFormProps` e `UseProposalFormReturn` |
| `src/hooks/proposal/useProposalForm.helpers.ts` | `createInitialProposalFormData()`, `buildFullFormSnapshot()` para dirty detection |
| `src/hooks/proposal/useProposalForm.loading-effects.ts` | Efeito que carrega proposta existente, sync de master data |
| `src/hooks/proposal/useProposalForm.product-submit.ts` | Handlers de produto + `handleSubmit` principal |
| `src/hooks/proposal/useProposalForm.system-dirty.ts` | `addSistema/removeSistema/updateSistema`, `isDirty`, `resetToInitial` |
| `src/hooks/proposal/useMasterDataTransaction.ts` | Operações otimistas em Ambientes e Sistemas com rollback |
| `src/hooks/proposal/submit-helpers.ts` | `sanitizeProducts()`, `transformSistemas()`, `prepareCreatePayload()`, `updateProposal()` |
| `src/hooks/proposal/product-handlers.ts` | `createToggleProduct()`, `createUpdateProductQuantity()`, `getExtraProducts()` |
| `src/services/proposal-service.ts` | CRUD de propostas no Firestore + event bus + paginação |
| `src/services/proposal-template-service.ts` | CRUD de templates de proposta via backend |
| `src/services/shared-proposal-service.ts` | Geração de share link + busca pública via token |
| `src/services/pdf/download-proposal-pdf.ts` | Download autenticado via `POST /v1/proposals/{id}/pdf` |
| `src/services/pdf/download-shared-proposal-pdf.ts` | Download público via `GET /v1/share/{token}/pdf` |
| `src/lib/niches/config.ts` | `getNicheConfig()` — determina `proposalWorkflow` por nicho |
| `src/types/proposal.ts` | Interfaces `Proposal`, `ProposalProduct`, `ProposalSystemInstance`, `ProposalAmbienteInstance`, `ProposalAttachment` |
| `src/types/shared-proposal.ts` | `SharedProposal`, `ShareLinkResponse` |
| `src/types/pdf-display-settings.ts` | `PdfDisplaySettings` — flags de visibilidade no PDF |

---

## Modelo de Dados

### `Proposal` — documento Firestore na coleção `proposals`

```typescript
interface Proposal {
  id: string;
  tenantId: string;          // Isolamento multi-tenant
  title: string;
  status: ProposalStatus;    // Ver seção de status abaixo
  clientId: string;          // ID no Firestore (coleção clients)
  clientName: string;        // Snapshot desnormalizado
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;       // YYYY-MM-DD

  products: ProposalProduct[];
  sistemas: ProposalSystemInstance[];
  sections: Record<string, unknown>[];  // Legado — seções customizadas do PDF

  discount?: number;           // Percentual (ex: 10 = 10%)
  totalValue?: number;         // Calculado: subtotal - desconto + extraExpense
  closedValue?: number | null; // Valor negociado final (sobrescreve totalValue ao aprovar)
  extraExpense?: number;       // Despesa extra adicionada ao total

  customNotes?: string;
  pdfSettings?: PdfDisplaySettings & ProposalPdfCustomSettings; // Configurações visuais do PDF

  // Opções de pagamento
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  downPaymentWallet?: string;       // ID da carteira (uso interno — não aparece no PDF)
  downPaymentDueDate?: string;      // YYYY-MM-DD
  downPaymentMethod?: string;       // Exibido no PDF

  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  installmentsWallet?: string;      // ID da carteira (uso interno — não aparece no PDF)
  firstInstallmentDate?: string;    // YYYY-MM-DD
  installmentsPaymentMethod?: string; // Exibido no PDF

  paymentMethod?: string;    // Método padrão exibido no PDF

  attachments?: ProposalAttachment[];
  pdf?: ProposalPdfMetadata; // Metadados do último PDF gerado

  // Campos desnormalizados para ordenação no Firestore
  primarySystem?: string;      // Nome do primeiro sistema (concatenado)
  primaryEnvironment?: string; // Nome do primeiro ambiente

  createdAt: string;  // ISO
  updatedAt: string;
}
```

### `ProposalStatus`

```typescript
type ProposalStatus =
  | "draft"        // Rascunho — auto-salvo, não pode ser compartilhado ou ter PDF gerado
  | "in_progress"  // Em progresso
  | "sent"         // Enviada
  | "approved"     // Aprovada — dispara criação de transações financeiras no backend
  | "rejected"     // Rejeitada
  | (string & {}); // ID de coluna Kanban customizada
```

**Atenção:** Status como `"in_progress"`, `"sent"`, `"approved"`, `"rejected"` são legados. A listagem também aceita IDs arbitrários de colunas Kanban (ex: `"kanban_col_abc123"`). O label correto é obtido via `KanbanService.getStatuses()` e o fallback é `LEGACY_STATUS_CONFIG`.

### `ProposalProduct` — item de produto/serviço dentro de uma proposta

```typescript
interface ProposalProduct {
  lineItemId?: string;    // UUID único por linha — gerado em ensureProposalProductLineItemId()
  productId: string;      // ID no catálogo
  itemType?: "product" | "service";
  productName: string;
  quantity: number;
  unitPrice: number;      // Preço base/custo
  markup?: number;        // Percentual de markup (apenas para products, não services)
  priceManuallyEdited?: boolean;
  pricingDetails?: ProposalProductPricingDetails; // Detalhes de medição/precificação
  total: number;          // quantity * unitPrice * (1 + markup/100) para produtos; quantity * unitPrice para serviços
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  manufacturer?: string;
  category?: string;

  // Vínculo com sistema/ambiente (nicho automacao_residencial)
  ambienteInstanceId?: string;  // Formato: "{sistemaId}-{ambienteId}" — campo ATUAL
  /** @deprecated Use ambienteInstanceId */
  systemInstanceId?: string;    // Alias mantido para migração

  isExtra?: boolean;    // Produto adicionado manualmente (fora do template do sistema)
  status?: "active" | "inactive";
}
```

### `ProposalSystemInstance` — sistema dentro da proposta (nicho automacao_residencial)

```typescript
interface ProposalSystemInstance {
  sistemaId: string;
  sistemaName: string;
  description?: string;
  ambientes: ProposalAmbienteInstance[]; // Array de ambientes — formato atual
  // DEPRECATED: campos abaixo mantidos para migração de dados antigos
  ambienteId?: string;
  ambienteName?: string;
  productIds?: string[];
}

interface ProposalAmbienteInstance {
  ambienteId: string;
  ambienteName: string;
  description?: string;
  productIds: string[];  // IDs dos produtos associados a este ambiente
}
```

### `ProposalTemplate` — template de texto e estilo para PDF

```typescript
type ProposalTemplate = {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  introductionText: string;
  scopeText: string;
  paymentTerms: string;
  warrantyText: string;
  footerText: string;
  coverImage?: string;   // Base64
  theme: "modern" | "classic" | "minimal" | "tech" | "elegant" | "bold";
  primaryColor: string;
  fontFamily: string;
  repeatHeader?: boolean;
};
```

### `PdfDisplaySettings` — flags de visibilidade no PDF

```typescript
interface PdfDisplaySettings {
  showProductImages: boolean;
  showProductDescriptions: boolean;
  showProductPrices: boolean;       // Default: false
  showProductMeasurements: boolean;
  showProductQuantities: boolean;
  showSubtotals: boolean;
  showEnvironmentSubtotals: boolean; // Default: false
  showPaymentTerms: boolean;
  showLogo: boolean;
  showValidUntil: boolean;
  showNotes: boolean;
}
```

### `SharedProposal` — registro de link compartilhado

```typescript
interface SharedProposal {
  id: string;
  proposalId: string;
  tenantId: string;
  token: string;         // Identificador único do link
  createdAt: string;
  createdBy: string;
  expiresAt: string;     // Link expira após prazo configurado no backend
  viewedAt?: string;
  viewerInfo?: ViewerInfo[];
}
```

---

## Lógica de Negócio

### Status e transições

```
draft → in_progress (ao finalizar com dados completos)
any → sent / approved / rejected (via dropdown na listagem ou no form)
approved → (não pode voltar para draft se houver transações pagas — erro explícito do backend)
```

A lógica de status no submit (`handleSubmit` em `useProposalForm.product-submit.ts`):
- Se `finalize: false` e proposta existe e está em `draft` → mantém `draft`
- Se proposta tem título + cliente + produtos → mantém status atual (ou promove `draft` para `in_progress`)
- Se incompleta → salva como `draft`

### Auto-save de rascunhos

Implementado no `useEffect` de cleanup em `useProposalForm.core.ts`. Só ocorre para **novas** propostas (sem `proposalId`). Nunca ocorre para edições de propostas existentes.

Condições para o auto-save disparar:
1. `proposalId` ausente (nova proposta)
2. `hasSaved === false` (usuário não clicou em Salvar)
3. Há dados mínimos: `selectedClientId` ou `clientName` ou `title` ou `products`
4. `userDiscardedRef.current === false`
5. `pendingActionsCount === 0` (sem operações de master data pendentes)

O auto-save usa `ProposalService.notifySavingStarted()` que bloqueia a listagem de propostas até o save completar (via `ProposalService.waitForSave()`).

### Aprovação e vínculo com transações financeiras

Quando o status muda para `"approved"` **no backend** (`proposals.controller.ts`), a função `syncApprovedProposalTransactions()` é chamada. Ela cria transações financeiras a partir das opções de pagamento da proposta:

- Entrada (`downPaymentEnabled: true`) → 1 transação com `installmentNumber: 0`, `isDownPayment: true`
- Parcelas (`installmentsEnabled: true`) → N transações com `installmentNumber: 1..N`
- Todas as transações têm `proposalId`, `proposalGroupId` e `installmentGroupId`

**Guard crítico:** transações pagas de propostas aprovadas não podem ser revertidas para pendente sem antes reverter a proposta para rascunho (erro explícito no backend).

### Campos de wallet em propostas

`downPaymentWallet` e `installmentsWallet` armazenam **IDs de carteiras** (após migração abril/2025). São campos de uso interno — não aparecem no PDF. Ao criar transações, o backend os resolve via `resolveWalletRef()`.

### Cálculo de totais

```
subtotal = Σ (product.quantity * product.unitPrice * (1 + markup/100))
           para services: product.quantity * product.unitPrice (sem markup)
discount_amount = subtotal * (discount / 100)
totalValue = subtotal - discount_amount + extraExpense
```

`closedValue` (quando definido e não-null) representa o valor negociado final e sobrescreve o `totalValue` para fins de aprovação.

---

## Wizard Multi-Etapas (`SimpleProposalForm`)

O componente principal (`src/components/features/proposal/simple-proposal-form.tsx`) usa `StepWizard` com etapas que variam por nicho:

### Nicho `automacao_residencial` (`workflow: "automation"`)
1. **Contato** — dados do cliente
2. **Soluções** — sistemas + ambientes (`SistemaSelector`)
3. **Pagamento** — entrada e parcelas
4. **PDF** — `PdfDisplayOptionsSection`
5. **Resumo** — `ProposalSummarySection` com botão Finalizar

### Nicho `cortinas` (`workflow: "environment"`)
1. **Contato**
2. **Ambientes** — seleção por ambiente (sem sistemas)
3. **Pagamento**
4. **PDF**
5. **Resumo**

### Nicho padrão (catalog, ou sem nicho)
1. **Contato**
2. **Produtos** — catálogo livre
3. **Pagamento**
4. **PDF**
5. **Resumo**

Ao criar proposta completa (novo), após o save redireciona para `/proposals/{id}/edit-pdf`.

---

## Geração de PDF

### Arquitetura

Todo PDF é gerado **server-side** via Playwright no backend (Cloud Functions). Não existe fallback client-side (html2canvas/jsPDF foi removido).

### Fluxo para propostas autenticadas

1. Usuário clica "Baixar PDF" em qualquer tela
2. `usePdfGenerator.handleGenerate()` é chamado
3. Internamente chama `downloadProposalPdfFromBackend(proposalId)`
4. Que chama `downloadPdfFromApiEndpoint({ endpointPath: '/v1/proposals/{id}/pdf', requiresAuth: true })`
5. O proxy Next.js (`/api/backend`) encaminha para a Cloud Function
6. Backend valida tenant ownership, gera PDF com Playwright e retorna binário
7. `download-pdf-client.ts` cria Blob e dispara download no browser

### Fluxo para propostas compartilhadas públicas

1. Link público `/share/{token}` é acessado sem autenticação
2. Botão "Baixar PDF" chama `downloadSharedProposalPdf(token)`
3. Endpoint: `GET /v1/share/{token}/pdf` (sem autenticação)
4. Backend valida token e expiry, gera PDF com Playwright

### Configurações salvas no PDF (`pdfSettings`)

O campo `proposal.pdfSettings` no Firestore contém:
- `PdfDisplaySettings` — flags de visibilidade (preços, descrições, etc.)
- `ProposalPdfCustomSettings` — tema, cor, fonte, capa, seções customizadas

O editor (`/proposals/{id}/edit-pdf`) salva via `PUT /v1/proposals/{id}` com o campo `pdfSettings` atualizado. O botão "Salvar Configurações" salva as settings também em `tenant.proposalDefaults` para aplicar em novas propostas.

### Restrições de acesso ao editor de PDF

- Plano Free/Basic: somente visualização, sem editor
- Pro: editor disponível (`features.maxPdfTemplates > 1`)
- Enterprise: templates ilimitados (`features.maxPdfTemplates === -1`)

---

## Multi-Niche

A lógica de nicho é resolvida via `getNicheConfig(tenant?.niche)` em `useProposalForm.core.ts`:

```typescript
const proposalWorkflow = getNicheConfig(tenant?.niche).proposal.workflow;
const isAutomacaoNiche = proposalWorkflow === "automation";
const isEnvironmentProposal = proposalWorkflow === "environment";
```

| Nicho | `workflow` | Etapa de itens | Unidade de inventário |
|-------|-----------|---------------|----------------------|
| `automacao_residencial` | `"automation"` | Sistemas + Ambientes via `SistemaSelector` | Unidades (`un`) |
| `cortinas` | `"environment"` | Ambientes via seletor dedicado | Metros (`m`) |
| padrão (sem nicho) | `"catalog"` | Catálogo livre de produtos | Unidades |

O nicho também afeta:
- Labels de campo no PDF (`sistemaName` vs `ambienteName`)
- Modo da página Soluções (`automacao` vs `environment`)
- Cálculo de `primarySystem`/`primaryEnvironment` para ordenação

---

## Compartilhamento Público

### Geração do link

1. Na listagem ou no form, clica "Compartilhar"
2. `SharedProposalService.generateShareLink(proposalId)` → `POST /v1/proposals/{id}/share-link`
3. Backend cria documento em `shared_proposals` com token único e data de expiração
4. Retorna `{ shareUrl, token, expiresAt }`
5. URL é copiada para clipboard (com fallback via `execCommand('copy')`)

### Visualização pública (`/share/[token]`)

- Rota pública — sem middleware de autenticação
- `SharedProposalService.getSharedProposal(token)` → `GET /v1/share/{token}` (via `callPublicApi`)
- Retorna `{ proposal, tenant }` — dados suficientes para renderização
- `ProposalPdfViewer` exibe a proposta com configurações salvas em `pdfSettings`
- Download disponível via `downloadSharedProposalPdf(token)` → `GET /v1/share/{token}/pdf`
- Erros tratados: 404 (token inválido), 410 (link expirado)

### O que é exposto publicamente

- Dados da proposta: título, cliente, produtos, sistemas, totais, notas, condições de pagamento
- Dados do tenant: nome, logo, cor primária
- **Não exposto:** carteiras (`downPaymentWallet`, `installmentsWallet`), IDs internos, dados financeiros detalhados

---

## Gerenciamento de Estado

### `useProposalForm` — hook principal do formulário

Orquestra os sub-hooks e retorna o contrato `UseProposalFormReturn`. Consumido exclusivamente por `SimpleProposalForm`.

Sub-hooks:
- `useProposalFormLoadingEffects` — carrega proposta existente + sync de master data (ambientes/sistemas)
- `useProposalFormProductSubmit` — handlers de produtos, calculadoras, `handleSubmit`
- `useProposalFormSystemDirty` — CRUD de sistemas na proposta, detecção de `isDirty`, `resetToInitial`
- `useMasterDataTransaction` — operações otimistas em Ambientes/Sistemas (com rollback em erro)

### Detecção de alterações (`isDirty`)

Usa snapshots JSON serializados para comparar estado atual vs. estado inicial:
- `buildFullFormSnapshot()` — snapshot completo (inclui detalhes de produto)
- `buildEssentialFormSnapshot()` — snapshot essencial (apenas IDs e quantidades)

`isDirty` compara o snapshot essencial atual com o inicial. Exibe `UnsavedChangesModal` ao navegar com mudanças pendentes.

### Paginação da listagem (`page.tsx`)

- Usa `DataTable` com prop `fetchPage` — callback que chama `ProposalService.getProposalsPaginated()`
- Paginação cursor-based com Firestore (`startAfter`)
- Ordenação server-side exceto para `primarySystem`/`primaryEnvironment` (client-side via `compareProposalsByField`)
- Busca é client-side — carrega todas as propostas via `ProposalService.getProposals()` quando `isFiltering === true`
- `ProposalService.subscribe()` para receber notificações de alterações (ex: retorno do editor)

### Event bus de propostas

`ProposalService` implementa um event bus simples:

```typescript
ProposalService.notifySavingStarted() // → retorna função resolve()
ProposalService.waitForSave()         // → Promise que aguarda resolve()
ProposalService.subscribe(listener)   // → retorna unsubscribe()
```

Usado para sincronizar: listagem espera o save terminar antes de buscar dados atualizados.

---

## Chamadas de API

| Operação | Endpoint | Autenticado |
|----------|----------|-------------|
| Criar proposta | `POST /v1/proposals` | Sim |
| Atualizar proposta | `PUT /v1/proposals/{id}` | Sim |
| Excluir proposta | `DELETE /v1/proposals/{id}` | Sim |
| Gerar link de compartilhamento | `POST /v1/proposals/{id}/share-link` | Sim |
| Baixar PDF (autenticado) | `GET /v1/proposals/{id}/pdf` | Sim |
| Buscar proposta compartilhada | `GET /v1/share/{token}` | Não |
| Baixar PDF compartilhado | `GET /v1/share/{token}/pdf` | Não |
| CRUD de templates | `POST/PUT/DELETE /v1/aux/proposal-templates` | Sim |

Leituras de listagem e detalhe são feitas **diretamente no Firestore** (client SDK), não via API. Apenas escritas e operações sensíveis passam pelo backend.

---

## Padrões e Convenções

### Nomenclatura de campos

- Campos `*Wallet` em propostas sempre armazenam **IDs** de carteira (após migração abril/2025)
- `installmentValue` = valor de cada parcela; `installmentsCount` = número de parcelas
- `downPayment*` = prefixo para entrada; `installments*` = prefixo para parcelas
- `primarySystem` e `primaryEnvironment` = campos desnormalizados para ordenação (não editar diretamente)

### `lineItemId`

Todo `ProposalProduct` deve ter um `lineItemId` único. Use `ensureProposalProductLineItemId(product)` de `src/lib/proposal-product.ts` antes de qualquer operação que precise identificar uma linha individualmente (atualizar, remover, comparar).

### Instance ID de sistema

Formato: `"{sistemaId}-{ambienteId}"`. Ambos `ambienteInstanceId` e `systemInstanceId` usam este formato. `ambienteInstanceId` é o campo atual; `systemInstanceId` é alias de migração.

### Serialização de sistemas para API

Use `transformSistemas(selectedSistemas, selectedProducts)` de `submit-helpers.ts`. Converte `ProposalSistema[]` para `ProposalSystemInstance[]` com array `ambientes`. Mantém campos legados (`ambienteId`, `ambienteName`, `productIds`) para retrocompatibilidade.

### Sanitização de produtos

Use `sanitizeProducts(products)` de `submit-helpers.ts` antes de enviar para API. Garante: imagens normalizadas, `lineItemId` presente, `markup` seguro, cálculo correto de `total`.

---

## O que NÃO Fazer

1. **Não editar status diretamente no Firestore** sem passar pelo backend. A transição para `"approved"` dispara criação de transações financeiras — contornar isso corrompe o módulo financeiro.

2. **Não gerar PDF client-side** com html2canvas ou jsPDF. Toda geração é feita no backend via Playwright. O hook `usePdfGenerator` já encapsula isso — use-o.

3. **Não renderizar `proposal.pdfSettings` como `PdfDisplaySettings` somente.** O campo também contém `ProposalPdfCustomSettings` (tema, seções, capa). Faça cast seguro ou acesse campos individualmente.

4. **Não usar `getProposals()` (busca completa) na listagem normal.** Use `getProposalsPaginated()`. A busca completa existe apenas para filtros de texto client-side.

5. **Não auto-salvar propostas existentes.** O auto-save no unmount só funciona para novas propostas. Checar `if (state.proposalId) return` está lá por motivo crítico.

6. **Não exibir `downPaymentWallet` ou `installmentsWallet` no PDF.** São campos internos de carteira. O PDF exibe `downPaymentMethod` e `installmentsPaymentMethod`.

7. **Não confundir `ProposalStatus` de `src/types/index.ts` com o de `src/types/proposal.ts`.** O de `proposal.ts` aceita strings arbitrárias (union com `string & {}`). O de `index.ts` é a union fechada legada. Use o de `proposal.ts` em código novo.

8. **Não criar componentes de form de proposta sem consumir `useProposalForm`.** A lógica de dirty detection, auto-save, e validação está toda no hook.

9. **Não ignorar `pendingActionsCount` ao auto-salvar.** Se há operações de master data pendentes (criar ambiente/sistema), o auto-save deve ser bloqueado para evitar salvar com IDs temporários.

10. **Não hardcodar labels de status.** Use `getStatusLabel(status)` que resolve via colunas Kanban com fallback para `LEGACY_STATUS_CONFIG`.
