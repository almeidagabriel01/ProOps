# CLAUDE.md — src/lib/

## Responsabilidade
Utilitários, inicialização do Firebase, helpers de negócio, configuração de planos e lógica multi-niche.
Nenhum outro lugar do projeto deve importar Firebase SDKs diretamente — use os helpers daqui.

## Arquivos principais
```
lib/
├── firebase.ts              # Firebase client SDK init (auth, firestore, storage)
├── firebase-admin.ts        # Firebase Admin SDK (server-side: API routes, middleware)
├── api-client.ts            # Axios client configurado para /api/backend/*
├── firestore-error.ts       # Tratamento de erros Firestore
├── auth/                    # Helpers de autenticação (verificação de token, session)
├── niches/                  # Lógica multi-niche (automacao_residencial | cortinas)
├── plans/                   # Limites e permissões por plano (Free, Pro, etc.)
├── permissions/             # Fonte única dos pageIds do sistema de permissões
├── notifications/           # Helpers do sistema de notificações
├── validations/             # Funções de validação reutilizáveis
└── [utils].ts               # Helpers específicos (product-pricing, proposal-payment, etc.)
```

## Regras críticas

### Firebase Client (`firebase.ts`)
- Inicialização singleton do app Firebase
- Exporta: `db`, `auth`, `storage`
- Usar APENAS em Client Components ou hooks

### Firebase Admin (`firebase-admin.ts`)
- Usa `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` — secrets server-side
- Usar APENAS em: Server Components, API Route Handlers, Cloud Functions
- **NUNCA** importar em Client Components ou código que vai para o browser bundle

### API Client (`api-client.ts`)
- Axios pré-configurado para chamadas ao backend via `/api/backend/*`
- Toda chamada do frontend ao backend passa por aqui
- Inclui interceptors de auth (adiciona Bearer token automaticamente)

### Multi-niche (`niches/`)
- Toda lógica que varia por nicho de negócio fica aqui
- Nichos: `automacao_residencial` | `cortinas`
- Usar `useCurrentNicheConfig()` no frontend ou helpers de nicho no backend
- **Nunca** fazer `if (niche === 'cortinas')` espalhado pelo código — use os helpers

### Permissions (`permissions/pages.ts`)
- `PERMISSION_PAGES` é a **fonte única** dos `pageId` do sistema de permissões:
  o id do doc em `users/{uid}/permissions/{id}`, e a mesma chave lida pela
  guarda de rota (`page-config.ts`), pela dock, pelo `usePagePermission` e pelo
  `checkPermission` do backend.
- As duas telas da área de Equipe (criação e edição do membro) leem daqui.
  Antes eram duas listas independentes e elas divergiam — cada módulo novo
  entrava só numa. **Ao adicionar um módulo, acrescente aqui primeiro** e
  depois ligue as quatro camadas.
- `getDefaultPermissions()` também vive aqui: é função pura, e mantê-la no hook
  obrigava todo consumidor (e todo teste) a arrastar o cliente HTTP e a init do
  Firebase.

### Plans (`plans/`)
- Limites por plano (número de propostas, usuários, produtos, etc.)
- Verificar limites antes de criar novos recursos
- Atualizar quando novos planos forem adicionados

## O que NÃO colocar aqui
- Componentes React → `src/components/`
- Hooks → `src/hooks/`
- Chamadas de API → `src/services/`
- Tipos → `src/types/`
