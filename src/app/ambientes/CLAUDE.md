# CLAUDE.md — src/app/ambientes/ e src/app/solutions/

## Propósito e contexto de negócio

### `/ambientes`
Rota dedicada ao gerenciamento de **Ambientes** para o nicho `cortinas`. No nicho de cortinas, o workflow de proposta é orientado a ambientes (ex.: Sala, Quarto, Escritório), onde cada ambiente recebe produtos de cortinas específicos. Esta rota é a entrada principal do módulo de configuração de ambientes para esse nicho.

### `/solutions`
Wrapper inteligente que redireciona ou delega com base no nicho ativo:
- **`automacao_residencial`** → renderiza `AutomationPage` (a mesma de `/automation`)
- **`cortinas`** → redireciona via `router.replace("/ambientes")`
- **outros nichos** → exibe `PageUnavailableState`

## Quem pode acessar

**`/ambientes`:** exclusivo para tenants com nicho `cortinas` (verificação via `nicheConfig.proposal.workflow === "environment"`). Qualquer outro nicho recebe `PageUnavailableState` com CTA para `/products`.

**`/solutions`:** disponível somente para nicho `automacao_residencial`. Para `cortinas`, redireciona imediatamente para `/ambientes`.

Ambas as rotas requerem autenticação. Superadmin sem tenant selecionado vê `SelectTenantState`.

## Estrutura de arquivos

```
ambientes/
└── page.tsx          # CRUD de Ambientes (nicho cortinas)

solutions/
└── page.tsx          # Wrapper/redirect baseado em nicho
```

Os componentes de edição e listagem são **compartilhados** com o módulo de automação:

```
src/app/automation/_components/
├── ambiente-editor.tsx       # Editor de Ambiente (com produtos padrão)
└── ambiente-template-list.tsx # Grid de cards de Ambientes
```

## Arquivos-chave externos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/services/ambiente-service.ts` | CRUD de Ambientes |
| `src/types/automation.ts` | Tipos `Ambiente`, `AmbienteProduct` |
| `src/lib/niches/config.ts` | `getNicheConfig()`, `isPageEnabledForNiche()` |
| `src/app/automation/_components/ambiente-editor.tsx` | Editor (compartilhado com `/automation`) |
| `src/app/automation/_components/ambiente-template-list.tsx` | Listagem em cards (compartilhada) |

## Modelo de dados

Idêntico ao de `/automation` para o tipo `Ambiente`:

```typescript
type Ambiente = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  icon?: string;         // Emoji ou nome de ícone Lucide
  order?: number;
  defaultProducts: AmbienteProduct[];
  createdAt?: string;
};

type AmbienteProduct = {
  lineItemId?: string;
  productId: string;
  itemType?: "product" | "service";
  productName: string;  // Cache do nome do produto
  quantity: number;
  pricingDetails?: ProposalProductPricingDetails;
  notes?: string;
  status?: "active" | "inactive";
};
```

## Chamadas de API / serviços

Mesmas chamadas de `AmbienteService` documentadas em `/automation`:

| Operação | Endpoint |
|----------|----------|
| Listar Ambientes | Firestore direto — coleção `ambientes` |
| Criar Ambiente | `POST /v1/aux/ambientes` |
| Atualizar Ambiente | `PUT /v1/aux/ambientes/:id` |
| Excluir Ambiente | `DELETE /v1/aux/ambientes/:id` |

## Integração com outros módulos

- **Propostas (nicho cortinas)** — ao criar proposta, o usuário seleciona ambientes cadastrados aqui; os `defaultProducts` são copiados para a proposta como ponto de partida
- **`/automation`** — reutiliza os componentes `AmbienteEditor` e `AmbienteTemplateList`; a lógica de negócio é idêntica, apenas o contexto de navegação muda

## Diferença entre `/ambientes` e `/automation` (aba Ambientes)

| Aspecto | `/ambientes` (cortinas) | `/automation` aba "Ambientes Globais" |
|---------|------------------------|---------------------------------------|
| Nicho | `cortinas` | `automacao_residencial` |
| Tipo de listagem | `AmbienteTemplateList` (cards) | `AmbienteList` (lista com inline edit) |
| Presença de Sistemas | Não — só Ambientes | Sim — Sistemas são o elemento principal |
| URL de deep-link | `/ambientes?editAmbienteId=<id>` | `/automation?tab=ambientes&editAmbienteId=<id>` |

## Padrões e gotchas

### Verificação de nicho
`/ambientes/page.tsx` verifica `nicheConfig.proposal.workflow === "environment"` (não o nome do nicho diretamente). Se o nicho `cortinas` mudar seu workflow, a página se tornará inacessível. Preferir usar `isPageEnabledForNiche(niche, "ambientes")` se for refatorar.

### Deep linking do editor
A edição abre como substituto de toda a página (não modal), com URL atualizada via `router.replace` para suportar reload da página no estado de edição:
```
/ambientes?editAmbienteId=new      → cria novo ambiente
/ambientes?editAmbienteId=<id>     → edita ambiente existente
```

### `solutions/page.tsx` — redirect no useEffect
O redirect de `cortinas` para `/ambientes` acontece num `useEffect` (client-side), não em `redirect()` server-side. Isso significa que há um flash de `PageUnavailableState` antes do redirect se o tenant ainda estiver carregando. O `isLoading` do `useTenant` protege parcialmente isso.

### Remoção otimista no delete
`/ambientes/page.tsx` remove o item do estado local imediatamente ao confirmar a exclusão (`setAmbientes(prev => prev.filter(...))`), antes de aguardar confirmação do backend. Se o backend falhar, o dado some da lista mas não foi excluído — o `loadData` não é chamado em caso de erro para evitar recarregar toda a lista.
