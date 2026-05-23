# Skill: Nova API Route / Cloud Function

## Quando esta skill é invocada
Quando o usuário pede para criar um novo endpoint de API.

## Arquitetura de API deste projeto
```
Frontend → src/app/api/backend/[...proxy] → Cloud Functions Express
```

Há dois casos:
- **A) Nova route no backend Express** (Cloud Functions) — o caminho mais comum para lógica de negócio
- **B) Nova Next.js Route Handler** — apenas para rotas internas que NÃO precisam de secrets do backend

## Caso A — Nova rota no backend Express (Cloud Functions)

1. **Confirme:**
   - Qual recurso? (proposals, products, clients, etc.)
   - Qual método HTTP? (GET, POST, PUT, DELETE)
   - Autenticada? (quase sempre sim)
   - Precisa de nova coleção Firestore?

2. **Defina tipos em `apps/functions/src/shared/`** (se for tipo compartilhado)

3. **Crie o método no controller existente** `apps/functions/src/api/controllers/[recurso].controller.ts`
   ou crie um novo controller se for recurso novo.

4. **Template de handler:**
```typescript
import { Request, Response } from 'express'
import * as admin from 'firebase-admin'
import { AuthenticatedRequest } from '../middleware/auth' // adapte o path

export async function nomeHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { tenantId, uid } = req.authContext // sempre presente se rota protegida

    // 1. Validar input
    const { campo } = req.body
    if (!campo) {
      return res.status(400).json({ error: 'campo é obrigatório' })
    }

    // 2. Lógica de negócio com tenantId
    const db = admin.firestore()
    const result = await db
      .collection('colecao')
      .where('tenantId', '==', tenantId)
      .limit(50)
      .get()

    // 3. Retornar resultado
    return res.status(200).json({ data: result.docs.map(d => d.data()) })
  } catch (error) {
    console.error('[nomeHandler] erro:', error)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
```

5. **Registrar na rota** `apps/functions/src/api/routes/[recurso].routes.ts`

6. **Adicionar service no frontend** `src/services/[recurso]-service.ts`:
```typescript
import { apiClient } from '@/lib/api-client'

export async function nomeServico(params: NomeParams): Promise<NomeResponse> {
  const { data } = await apiClient.post('/api/backend/[rota]', params)
  return data
}
```

## Caso B — Next.js Route Handler interno

```typescript
// src/app/api/[rota]/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // lógica sem secrets

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API /rota] erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

## Checklist final
- [ ] Multi-tenant: `tenantId` filtrado em todas as queries Firestore
- [ ] Autenticação verificada (custom claims: `tenantId`, `role`, `masterId`)
- [ ] Inputs validados
- [ ] `limit()` em queries de listagem
- [ ] HTTP status codes corretos
- [ ] Sem dados sensíveis na resposta
- [ ] TypeScript sem erros, sem `any`
- [ ] Deploy testado no emulador antes de prod: `npm run dev:backend`
