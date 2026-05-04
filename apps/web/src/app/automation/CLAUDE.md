# CLAUDE.md — src/app/automation/

## Propósito e contexto de negócio

Módulo de catálogo de **Soluções** (sistemas de automação residencial) e **Ambientes** reutilizáveis. Exclusivo para o nicho `automacao_residencial`.

A hierarquia é: **Sistema** agrupa múltiplos **Ambientes**; cada Ambiente tem uma lista de **Produtos** padrão. Ao adicionar um Sistema a uma proposta, todos os seus ambientes e produtos são copiados como ponto de partida (o usuário pode customizar depois).

**Esta rota (`/automation`) é a implementação real.** A rota `/solutions` é apenas um wrapper que redireciona para `/ambientes` no nicho `cortinas` ou renderiza esta mesma página (`AutomationPage`) no nicho `automacao_residencial`.

## Quem pode acessar

Usuários autenticados com tenant ativo. A página verifica `isPageEnabledForNiche(tenant?.niche, "solutions")` — se o nicho não for `automacao_residencial`, exibe `PageUnavailableState` com link para `/products`.

Superadmin sem tenant selecionado vê `SelectTenantState`.

## Estrutura de rotas e componentes

```
automation/
├── page.tsx              # Página principal (Soluções + Ambientes Globais)
└── _components/
    ├── sistema-list.tsx          # Grid de cards de Sistemas
    ├── sistema-editor.tsx        # Editor de Sistema (com ambientes e produtos)
    ├── ambiente-list.tsx         # Lista de Ambientes para gestão inline
    ├── ambiente-editor.tsx       # Editor de Ambiente (com produtos padrão)
    └── ambiente-template-list.tsx # Grid de cards de Ambientes (view modo cortinas)
```

## Arquivos-chave externos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/services/ambiente-service.ts` | CRUD de Ambientes via Firestore direto (leitura) e backend (escrita) |
| `src/services/sistema-service.ts` | CRUD de Sistemas via Firestore direto (leitura) e backend (escrita) |
| `src/types/automation.ts` | Tipos `Sistema`, `Ambiente`, `AmbienteProduct`, `SistemaAmbienteTemplate`, tipos de proposta |
| `src/lib/niches/config.ts` | `getSolutionsPageConfig()`, `isPageEnabledForNiche()` |
| `src/components/features/automation/automation-skeleton.tsx` | Skeleton de loading |

## Modelo de dados

```typescript
// Hierarquia: Sistema > Ambientes > Produtos

type Sistema = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  icon?: string;                        // Emoji ou nome de ícone Lucide
  ambientes: SistemaAmbienteTemplate[]; // SOURCE OF TRUTH para produtos
  createdAt: string;
  updatedAt: string;
  // Deprecated (migração em andamento):
  availableAmbienteIds?: string[];
  defaultProducts?: SistemaProduct[];
  ambienteIds?: string[];
};

type SistemaAmbienteTemplate = {
  ambienteId: string;       // Referência ao Ambiente global
  description?: string;     // Override da descrição para este Sistema
  products: AmbienteProduct[];
};

type Ambiente = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  defaultProducts: AmbienteProduct[];
  createdAt?: string;
};

type AmbienteProduct = {
  lineItemId?: string;
  productId: string;
  itemType?: "product" | "service";
  productName: string;      // Cache — não buscar do catálogo em runtime
  quantity: number;
  pricingDetails?: ProposalProductPricingDetails;
  notes?: string;
  status?: "active" | "inactive";
};
```

### Migração de schema (CRÍTICO)
O schema antigo usava `ambienteIds: string[]` (só IDs) + `defaultProducts` no sistema. O schema novo usa `ambientes: SistemaAmbienteTemplate[]` (cada ambiente tem sua lista de produtos). O `normalizeSistema()` em `sistema-service.ts` faz a migração em memória ao ler documentos antigos.

**Ao salvar**, o `SistemaService.createSistema/updateSistema` sempre grava os dois campos (`ambientes` novo + `availableAmbienteIds`/`ambienteIds` legados) para retrocompatibilidade.

## Chamadas de API / serviços

| Operação | Método | Endpoint |
|----------|--------|----------|
| Listar Ambientes | `GET` Firestore direto | coleção `ambientes` |
| Buscar Ambiente por ID | `GET` Firestore direto | doc `ambientes/:id` |
| Criar Ambiente | `POST` via `callApi` | `/v1/aux/ambientes` |
| Atualizar Ambiente | `PUT` via `callApi` | `/v1/aux/ambientes/:id` |
| Excluir Ambiente | `DELETE` via `callApi` | `/v1/aux/ambientes/:id` |
| Listar Sistemas | `GET` Firestore direto | coleção `sistemas` |
| Criar Sistema | `POST` via `callApi` | `/v1/aux/sistemas` |
| Atualizar Sistema | `PUT` via `callApi` | `/v1/aux/sistemas/:id` |
| Excluir Sistema | `DELETE` via `callApi` | `/v1/aux/sistemas/:id` |

Erros de permissão Firestore são tratados silenciosamente — `isFirestorePermissionError()` retorna array vazio ao invés de propagar o erro.

## Integração com outros módulos

- **Propostas** (`src/app/proposals/`) — ao criar/editar uma proposta no nicho `automacao_residencial`, o usuário seleciona Sistemas para adicionar; os ambientes e produtos são copiados para a proposta como `ProposalSistema[]`
- **Catálogo de produtos** (`src/app/products/`) — o `AmbienteEditor` e `SistemaEditor` buscam produtos e serviços do catálogo via `ProductService` e `ServiceService` para montar a lista de `defaultProducts`
- **Niches config** — `isPageEnabledForNiche(niche, "solutions")` controla visibilidade; `getSolutionsPageConfig(niche)` define labels e modo

## Comportamento multi-niche

A `page.tsx` consulta `getSolutionsPageConfig(tenant?.niche)` que retorna:

```typescript
type SolutionsPageDefinition = {
  navigationLabel: string;
  pageTitle: string;
  pageDescription: string;
  mode: "automation" | "environment";
};
```

Quando `mode === "environment"` (nicho `cortinas`):
- A aba "Soluções" (Sistemas) é ocultada
- Só a aba "Ambientes" fica visível
- Usa `AmbienteTemplateList` em vez de `AmbienteList`
- O tab param na URL é sempre `ambientes`

Quando `mode === "automation"` (nicho `automacao_residencial`):
- Duas abas: "Soluções" e "Ambientes Globais"
- Tab padrão é "sistemas"
- Permite criar/editar Sistemas com ambientes aninhados

## Padrões e gotchas

### Lazy loading local com IntersectionObserver
A página implementa `useLocalLazyLoading` — um hook local (não exportado) que exibe itens em batches de 12 (Sistemas) ou 16 (Ambientes) usando `IntersectionObserver` com sentinel element. Necessário porque todos os dados são carregados de uma vez do Firestore mas exibidos progressivamente.

O hook tem guarda contra scroll inicial falso — só carrega mais quando detecta interação real do usuário (`hasUserInteractedRef`).

### Edição em place (sem modal)
O editor (`SistemaEditor` ou `AmbienteEditor`) substitui toda a página — não é um modal/sheet. A transição usa `motion` (Framer Motion) `scale(0.98) → (1)`. O estado `editingSistemaId` ou `editingAmbienteId` controla qual view é renderizada.

### Deep linking via URL params
Os editores podem ser abertos via query params:
- `?editSistemaId=<id>` — abre editor de Sistema
- `?editAmbienteId=<id>` — abre editor de Ambiente
- Usar `"new"` como valor para criar novo

### `loadData(silent: true)`
O argumento `silent` suprime o estado de loading (spinner) — usado em refreshes após save/delete para não piscar a tela.

### Normalização de produtos
`AmbienteService` normaliza `AmbienteProduct.quantity` e `pricingDetails` ao ler do Firestore via `normalizeAmbienteProduct()`. Nunca salvar quantidade negativa ou `pricingDetails` malformado.
