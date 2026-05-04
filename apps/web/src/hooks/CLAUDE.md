# CLAUDE.md — src/hooks/

## Responsabilidade
React hooks customizados que encapsulam lógica reutilizável de dados e UI.

## Hooks existentes (principais)
```
hooks/
├── proposal/              # Hooks específicos de propostas
├── use-sort.ts            # Ordenação de listas
├── use-window-focus.ts    # Detecção de foco da janela
├── useClientActions.ts    # Ações CRUD de clientes
├── useCreateMember.ts     # Criação de membros da equipe
├── useCreateProposal.ts   # Criação de propostas
├── useCurrentNicheConfig.ts # Config do nicho atual do tenant
├── useDashboardData.ts    # Dados do dashboard
├── useFormValidation.ts   # Validação de formulários
├── useHeaderPresentation.ts
├── useInfiniteScroll.ts   # Paginação infinita
├── useMemberActions.ts    # Ações de membros
├── useNotificationScope.ts
├── useNotifications.ts    # Sistema de notificações
├── usePagePermission.ts   # Verificação de permissões por página
├── usePageTitle.ts        # Título dinâmico da página
├── usePlanChange.ts       # Mudança de plano
├── usePlanLimits.ts       # Verificação de limites do plano
├── usePlanUsage.ts        # Uso atual do plano
├── useProductActions.ts   # Ações CRUD de produtos
├── useServiceActions.ts   # Ações CRUD de serviços
├── useStripePrices.ts     # Preços do Stripe
└── useUpdatePermissions.ts
```

## Regras

- Um hook por arquivo: `use[Nome].ts` ou `use-[nome].ts`
- **Retornar objeto nomeado**: `return { data, loading, error }` — não array (exceto casos específicos como `useState`)
- Tipagem completa: parâmetros de entrada e tipo de retorno explícitos
- Cleanup obrigatório para listeners e subscriptions

## Cleanup obrigatório
```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(query, handler)
  return () => unsubscribe() // sempre limpar listeners
}, [dependency])
```

## Separação de responsabilidades
- **Hooks de dados** (Firebase/API): buscam/mutam dados, retornam `{ data, loading, error }`
- **Hooks de UI**: gerenciam estado visual, formulários, modais, animações
- **Não misturar**: hooks de dados não devem ter lógica de UI e vice-versa

## Padrão de hook de dados
```typescript
export function use[Recurso](params: Params) {
  const [data, setData] = useState<Tipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // implementação

  return { data, loading, error }
}
```

## Providers disponíveis para consumir
- `useAuth()` — usuário atual, login/logout
- `useTenant()` — dados do tenant ativo, `tenantNiche`
- `usePermissions()` — permissões por role do usuário
- `useTheme()` — dark/light mode (next-themes)
