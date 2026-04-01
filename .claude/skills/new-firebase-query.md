# Skill: Nova Query Firestore

## Quando esta skill é invocada
Quando o usuário pede para criar uma nova query ou operação no Firestore.

## Contexto deste projeto
- Firestore é o banco principal
- Todo documento tem `tenantId` — SEMPRE filtrar por ele
- Firebase client SDK: `src/lib/firebase.ts`
- Firebase Admin SDK: `src/lib/firebase-admin.ts` (server-side) e `functions/src/init.ts`
- Services client-side: `src/services/` (chamam `/api/backend/*`, não Firestore diretamente do frontend)

## Para queries no backend (Cloud Functions) — mais comum

```typescript
import * as admin from 'firebase-admin'

// Leitura única
export async function getDocumento(tenantId: string, id: string): Promise<Tipo | null> {
  const db = admin.firestore()
  const snap = await db.collection('colecao').doc(id).get()

  if (!snap.exists) return null
  const data = snap.data() as Tipo

  // Verificar tenant isolation
  if (data.tenantId !== tenantId) return null

  return { id: snap.id, ...data }
}

// Listagem com filtro
export async function listarDocumentos(tenantId: string): Promise<Tipo[]> {
  const db = admin.firestore()
  const snap = await db
    .collection('colecao')
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc')
    .limit(50) // SEMPRE usar limit()
    .get()

  return snap.docs.map(d => ({ id: d.id, ...d.data() as Tipo }))
}

// Transação (múltiplos documentos)
export async function operacaoAtômica(tenantId: string, dados: DadosInput) {
  const db = admin.firestore()
  await db.runTransaction(async (transaction) => {
    const ref1 = db.collection('colecao1').doc(dados.id1)
    const ref2 = db.collection('colecao2').doc(dados.id2)

    const [doc1, doc2] = await Promise.all([
      transaction.get(ref1),
      transaction.get(ref2)
    ])

    // verificações...

    transaction.update(ref1, { campo: valor })
    transaction.update(ref2, { campo: valor })
  })
}
```

## Para listeners no frontend (Client Component)

```typescript
// src/hooks/use-[recurso].ts
'use client'
import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import type { Tipo } from '@/types'

export function use[Recurso](tenantId: string) {
  const [data, setData] = useState<Tipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!tenantId) return

    const q = query(
      collection(db, 'colecao'),
      where('tenantId', '==', tenantId),
      orderBy('createdAt', 'desc'),
      limit(50)
    )

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map(d => ({ id: d.id, ...d.data() as Tipo })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe() // cleanup obrigatório
  }, [tenantId])

  return { data, loading, error }
}
```

## Checklist
- [ ] `tenantId` filtrado em TODA query (tenant isolation)
- [ ] `limit()` em todas as queries de listagem
- [ ] Cleanup de listeners (`return () => unsubscribe()`)
- [ ] Tipo explícito definido em `src/types/`
- [ ] Índice necessário? (Firestore lança erro com link — copiar para `firestore.indexes.json`)
- [ ] Transação para operações multi-documento
- [ ] Paginação com `startAfter()` se listar mais de 50 documentos
