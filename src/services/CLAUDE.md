# CLAUDE.md — src/services/

## Responsabilidade
Camada de chamadas de API do lado do cliente. Todo acesso ao backend passa por aqui.
Os services chamam `/api/backend/*` (proxy Next.js → Cloud Functions). **Nunca** chamam
URLs de Cloud Functions diretamente nem acessam Firestore diretamente.

## Services existentes
```
services/
├── addon-service.ts          # Add-ons de planos
├── admin-service.ts          # Operações de admin
├── ambiente-service.ts       # Ambientes (niche: automação residencial)
├── calendar-service.ts       # Google Calendar
├── client-service.ts         # Clientes/contatos
├── custom-field-service.ts   # Campos customizados
├── kanban-service.ts         # Kanban/pipeline CRM
├── notification-service.ts   # Notificações
├── option-service.ts         # Opções de configuração
├── pdf/                      # Geração e download de PDFs
├── plan-service.ts           # Planos e subscriptions
├── product-service.ts        # Produtos do catálogo
├── proposal-service.ts       # Propostas comerciais
├── proposal-template-service.ts
├── service-service.ts        # Serviços (tipo de item de proposta)
├── shared-proposal-service.ts  # Propostas compartilhadas (link público)
├── shared-transaction-service.ts
├── sistema-service.ts        # Configurações do sistema
├── spreadsheet-service.ts    # Import/export de planilhas
├── storage-service.ts        # Firebase Storage (upload/download)
├── stripe-service.ts         # Stripe (preços, checkout, portal)
├── tenant-service.ts         # Configurações do tenant
├── transaction-service.ts    # Transações financeiras
├── user-service.ts           # Usuários e perfil
└── wallet-service.ts         # Carteiras financeiras
```

## Padrão de service
```typescript
import { apiClient } from '@/lib/api-client'
import type { TipoRequest, TipoResponse } from '@/types'

export async function nomeOperacao(params: TipoRequest): Promise<TipoResponse> {
  const { data } = await apiClient.post('/api/backend/[rota]', params)
  return data
}

export async function buscarRecurso(id: string): Promise<TipoResponse> {
  const { data } = await apiClient.get(`/api/backend/[rota]/${id}`)
  return data
}
```

## Regras
- Sempre tipar parâmetros e retorno
- Erros são propagados para o hook consumidor (não silenciar com try/catch vazio)
- Não incluir lógica de negócio aqui — só chamadas HTTP
- Hooks em `src/hooks/` consomem os services e gerenciam estado (loading, error)
