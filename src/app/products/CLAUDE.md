# CLAUDE.md — src/app/products/

## Propósito

Catálogo de produtos do tenant. Permite cadastrar, editar, excluir e visualizar produtos que são usados em propostas comerciais. O módulo suporta dois tipos de entidade — **produto** e **serviço** — mas ambos compartilham o mesmo formulário (`ProductFormNew`) e hook (`useProductForm`). A rota `/services` e `/ambientes` reusam esses componentes com `entityType` diferente.

---

## Estrutura de Rotas

```
/products                  → lista paginada + cards de estoque
/products/new              → wizard de criação (4 etapas)
/products/[id]             → edição ou visualização read-only (depende de permissão canEdit)
```

---

## Arquivos principais

| Camada | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Rota lista | `src/app/products/page.tsx` | Listagem paginada, filtro por nome, cards de saldo de estoque |
| Rota nova | `src/app/products/new/page.tsx` | Página de criação (guarda por `canCreate`) |
| Rota edição | `src/app/products/[id]/page.tsx` | Carrega produto por ID e exibe formulário; read-only se `!canEdit` |
| Formulário wizard | `_components/product-form-new.tsx` | StepWizard de 4 passos: info, preço, imagens, resumo |
| Etapa de preço | `_components/product-pricing-step.tsx` | UI de seleção de modo de precificação (4 modos para cortinas) |
| Célula de estoque | `_components/stock-editable-cell.tsx` | Célula inline editável na tabela; alias de `InventoryEditableCell` |
| Skeleton lista | `_components/products-skeleton.tsx` | Skeleton full-page enquanto dados não chegam |
| Skeleton tabela | `_components/products-table-skeleton.tsx` | Skeleton apenas da tabela |
| Skeleton vazio | `_components/products-empty-skeleton.tsx` | Estado vazio da listagem |
| Hook do form | `_hooks/useProductForm.ts` | Todo o estado, validação, upload de imagens e submit do formulário |
| Service | `src/services/product-service.ts` | Leituras Firestore diretas + mutações via `callApi` |
| Pricing lib | `src/lib/product-pricing.ts` | Lógica de cálculo de preços (modos, tiers, summary) |
| Inventory lib | `src/lib/product-inventory-summary.ts` | Cálculo do saldo consolidado de estoque (cortinas) |
| Niches config | `src/lib/niches/config.ts` | Labels, unidades e comportamento por nicho |

---

## Modelo de dados — tipo `Product`

Definido em `src/services/product-service.ts` (e reexportado via import direto).

```typescript
type Product = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  price: string;           // Preço base bruto (string para compatibilidade com formulários)
  markup?: string;         // Margem de lucro em % sobre o preço base
  pricingModel?: ProductPricingModel; // Regra de precificação (ver abaixo)
  manufacturer: string;
  category: string;
  inventoryValue: number;  // Valor normalizado de estoque (unidades ou metros)
  inventoryUnit?: InventoryUnit; // "unit" | "meter"
  stock: number;           // Alias de inventoryValue (mantido por compatibilidade)
  images: string[];        // URLs do Firebase Storage (dado novo)
  image?: string | null;   // URL única — campo legado, mantido para retrocompatibilidade
  status?: "active" | "inactive"; // @deprecated — status agora é contextual por proposta
  itemType?: "product";    // Discriminante; sempre "product" para produtos
  createdAt?: string;
  updatedAt?: string;
};
```

### Tipo `ProductPricingModel`

```typescript
type ProductPricingModel =
  | { mode: "standard" }
  | { mode: "curtain_meter" }
  | { mode: "curtain_width" }
  | { mode: "curtain_height"; tiers: CurtainHeightTier[] };

type CurtainHeightTier = {
  id: string;
  maxHeight: number;  // metros
  basePrice: number;  // preço bruto por metro de largura nesta faixa
  markup: number;     // % de margem
};
```

### Resolução de `inventoryValue`

A função `resolveInventoryValue()` em `src/lib/niches/config.ts` prefere `inventoryValue` sobre `stock`. Ambos são normalizados no momento de mapeamento do snapshot (`mapProductDoc`).

---

## Comportamento multi-niche

A variação de UI por nicho é controlada via `useCurrentNicheConfig()` (que lê `tenant.niche`). **Nunca** usar `if (niche === "cortinas")` diretamente em componentes genéricos — usar sempre `nicheConfig`.

### `automacao_residencial`

| Campo | Comportamento |
|-------|--------------|
| Inventário | Unidade (`"unit"`), step 1 |
| Coluna tabela | "Estoque" (editável inline) |
| Card de saldo | Saldo simples: `inventoryValue * basePrice` e `inventoryValue * sellingPrice` |
| Modos de precificação | Apenas `standard` (sem seleção de modo) |
| Limite de imagens | 1 por produto |
| Fabricante | Campo obrigatório no formulário |

### `cortinas`

| Campo | Comportamento |
|-------|--------------|
| Inventário | Metro (`"meter"`), step 0.01 |
| Coluna tabela | Coluna de inventário **oculta** (`hideInventoryColumn = true`) |
| Card de saldo | Usa `summarizeCurtainInventoryBalance()` — lógica por modo de precificação |
| Modos de precificação | Seletor com 4 opções (ver abaixo) |
| Limite de imagens | 3 por produto |
| Fabricante | Campo obrigatório no formulário |

### Modos de precificação (apenas `cortinas`)

| Modo (`pricingMode`) | Título | Cálculo na proposta |
|---------------------|--------|---------------------|
| `standard` | Por quantidade | `quantidade × preço com markup` |
| `curtain_meter` | Por metragem | `largura × altura × preço/m² com markup × painéis` |
| `curtain_width` | Por largura | `largura × preço/m linear com markup × painéis` |
| `curtain_height` | Por altura | faixas: seleciona tier por altura, multiplica largura × painéis × preço/m do tier |

Para o modo `curtain_height`, o campo `price` e `markup` do produto são o primeiro tier (`pricingModel.tiers[0]`). Isso é serializado corretamente em `handleSubmit` do `useProductForm`.

---

## Lógica de precificação

Funções centralizadas em `src/lib/product-pricing.ts`:

```typescript
// Preço de venda = preço base * (1 + markup / 100)
calculateSellingPrice(basePrice: number, markup: number): number

// Retorna o preço base efetivo do produto (considera curtain_height → tier[0])
getProductBasePrice(product): number

// Retorna o markup efetivo (considera curtain_height → tier[0])
getProductMarkup(product): number

// Retorna string de resumo para exibir na tabela/card
// Ex: "R$ 45,00 / m2", "R$ 30,00 a R$ 50,00 / m larg.", "R$ 120,00"
getProductPricingSummary(product): string

// Normaliza pricingModel de dado bruto do Firestore
normalizeProductPricingModel(value: unknown): ProductPricingModel
```

### Fórmula de saldo do catálogo (listagem)

Para `automacao_residencial`:
```
cost     = Σ (inventoryValue × getProductBasePrice(p))
withMarkup = Σ (inventoryValue × calculateSellingPrice(basePrice, markup))
```

Para `cortinas`, usa `summarizeCurtainInventoryBalance()` — que trata cada modo separadamente. Produtos dimensionais com inventário zero usam `dimensionMultiplier = 1` (entram no saldo mesmo sem metragem cadastrada).

---

## Gerenciamento de estado e API

### Carregamento na listagem (`page.tsx`)

A listagem usa **dois carregamentos paralelos**:

1. `ProductService.getProductsPaginated()` — via `DataTable` com paginação cursor-based (12 por página)
2. `ProductService.getProducts()` — carga total para habilitar filtro por nome (client-side)

O estado `allProducts` (carga total) é carregado em background. Enquanto `isLoadingAll` é true e o usuário está filtrando, o `Spinner` aparece no campo de busca.

**Cuidado:** ordenação por `stock` ou `inventoryValue` requer client-sort (sem índice Firestore) — o service busca todos os documentos e ordena em memória.

### Cache do `ProductService`

O service mantém um cache em memória por tenant com TTL de 5 minutos:

```typescript
const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
// Cache structure: Map<tenantId, { expiresAt, byId, allLoaded }>
```

Após uma mutação (criar, editar, excluir), chamar:
```typescript
ProductService.invalidateTenantCache(tenant.id)
```

Sem invalidar, a listagem pode exibir dados desatualizados por até 5 minutos.

### Mutações (criar/editar)

Mutações passam pelo backend via `callApi`:
- **Criar:** via hook `useProductActions` → `createProduct()` → `POST /api/backend/v1/products`
- **Editar:** `ProductService.updateProduct(id, data)` → `PUT /api/backend/v1/products/:id`
- **Excluir:** via hook `useProductActions` → `deleteProduct()` → `DELETE /api/backend/v1/products/:id`

Antes de excluir, o `page.tsx` verifica `ProposalService.isProductUsedInProposal()`. Se o produto estiver vinculado a uma proposta, o delete é bloqueado no frontend.

### Upload de imagens

O `useProductForm` gerencia:
- `imageUrls` — URLs já persistidas no Storage
- `pendingFiles` — arquivos `File` ainda não enviados
- `pendingPreviews` — URLs de preview local geradas via `FileReader`
- `removedUrls` — URLs a deletar do Storage no submit

No submit, a ordem é: (1) upload de `pendingFiles`, (2) delete de `removedUrls`, (3) chamada à API com `allImageUrls`.

---

## Wizard de formulário (`ProductFormNew`)

O wizard usa `StepWizard` + `StepNavigation` de `src/components/ui/`. Passos:

| Step | ID | Validação no `onBeforeNext` |
|------|----|-----------------------------|
| 1 | `info` | nome, categoria, fabricante (produto) |
| 2 | `pricing` | preço > 0 (ou tiers válidos se `curtain_height`) |
| 3 | `images` | nenhuma validação — opcional |
| 4 | `settings` | submit final |

Em modo edição (`productId` definido), `allowClickAhead={true}` no `StepWizard` — o usuário pode pular entre etapas livremente.

---

## Permissões

Controladas via `usePagePermission("products")`:

```typescript
const { canCreate, canEdit, canDelete, canView } = usePagePermission("products");
```

- Sem `canView` → redireciona para `/products`
- Sem `canCreate` → redireciona para `/products` na rota `/products/new`
- Sem `canEdit` → formulário em modo `isReadOnly`

---

## O que NÃO fazer

- **Nunca** ler `tenant.niche` diretamente em componentes — usar `useCurrentNicheConfig()` ou `nicheConfig.id`
- **Nunca** calcular preço com markup via `price * (1 + markup/100)` inline — usar `calculateSellingPrice()` de `src/lib/product-pricing.ts`
- **Nunca** acessar `product.stock` para exibir estoque — usar `getProductInventoryValue(product)` ou `product.inventoryValue` (ambos são normalizados)
- **Nunca** exibir `product.price` diretamente como preço final — o preço visível ao cliente é `calculateSellingPrice(getProductBasePrice(p), getProductMarkup(p))`
- **Nunca** editar `src/components/ui/` para customizar o formulário — usar `className` via `cn()`
- **Não** importar Firebase SDK diretamente em componentes — o `ProductService` já abstrai as queries Firestore
- **Não** chamar `ProductService.invalidateTenantCache()` fora do contexto de mutação — invalida o cache e força re-fetch desnecessário
- **Não** adicionar lógica de cálculo de saldo fora de `src/lib/product-pricing.ts` ou `src/lib/product-inventory-summary.ts`
