# users.controller.ts — Documentacao

Controller responsavel pelo perfil do proprio usuario autenticado. Expoe apenas um endpoint publico (para o usuario logado atualizar seus proprios dados). Operacoes administrativas de usuarios estao em `admin.controller.ts`.

## Arquivo fonte

`functions/src/api/controllers/users.controller.ts`

## Rota (core.routes.ts)

Prefixo `/` (core routes, sem prefixo adicional).

| Metodo | Path | Handler | Auth |
|--------|------|---------|------|
| `PUT` | `/profile` | `updateProfile` | qualquer usuario autenticado |

---

## Dependencias de admin.controller.ts

O controller importa duas funcoes de `admin.controller.ts`:

```typescript
import { upsertPhoneNumberIndexTx, normalizePhoneNumber } from "./admin.controller";
```

- `normalizePhoneNumber` — normaliza para formato E.164 sem `+`
- `upsertPhoneNumberIndexTx` — gerencia o indice `phoneNumberIndex` dentro de uma transacao

---

## `updateProfile` — PUT /profile

Permite que o usuario autenticado atualize seu proprio perfil.

**Campos aceitos:**

| Campo | Tipo | Comportamento |
|-------|------|--------------|
| `name` | string | Atualiza Firestore e Firebase Auth `displayName` |
| `phoneNumber` | string ou null | Valida formato BR, atualiza `phoneNumberIndex` em transacao |
| `onboarding` | objeto | Normalizado por `normalizeOnboardingPayload` |

**Validacao de telefone:**
- Delega para `validateBrazilMobilePhone` de `lib/contact-validation`
- Se invalido: retorna `400` imediatamente, sem nenhuma escrita
- Se valido: normaliza com `normalizePhoneNumber` e roda dentro de `db.runTransaction` para atualizar o indice global

**Comportamento quando `phoneNumber` presente:**
A operacao inteira roda dentro de `db.runTransaction` para garantir atomicidade entre a atualizacao do doc do usuario e o indice de telefone. Se o telefone ja estiver vinculado a outro usuario, `upsertPhoneNumberIndexTx` lanca `Error("PHONE_ALREADY_LINKED")` e o handler retorna `409`.

**Normalizacao de onboarding (`normalizeOnboardingPayload`):**

A funcao mescla o payload recebido com o valor atual no Firestore, garantindo consistencia:

```typescript
{
  version: string,              // default: "core-v1"
  status: "active" | "completed" | "skipped",
  completedStepIds: string[],   // deduplicado, normalizado
  currentStepId: string | null,
  startedAt: string (ISO),      // preserva valor existente se ja tiver
  updatedAt: string (ISO),      // sempre now()
  completedAt: string | null,   // setado quando status === "completed"
  skippedAt: string | null,     // setado quando status === "skipped"
}
```

**Atualizacao de Firebase Auth:**
O `displayName` no Firebase Auth e atualizado apenas se `name` foi fornecido e difere do valor atual no Firestore. Falhas nessa etapa sao logadas mas nao interrompem o fluxo (nao-fatal).

**Respostas:**

| Status | Cenario |
|--------|---------|
| `200` | `{ success: true, message: "Perfil atualizado com sucesso." }` |
| `400` | Telefone invalido |
| `404` | Usuario nao encontrado no Firestore |
| `409` | Telefone ja vinculado a outro usuario |
| `500` | Erro interno |

---

## Multi-tenancy

O `updateProfile` opera sempre sobre o proprio usuario autenticado (`req.user.uid`). Nao ha filtragem por `tenantId` porque o escopo e sempre o proprio doc do usuario. O `tenantId` e usado apenas como contexto para o `phoneNumberIndex` (campo `tenantId` no indice serve para o sistema de billing do WhatsApp).

---

## Colecoes afetadas

| Colecao | Operacao |
|---------|---------|
| `users/{uid}` | update |
| `phoneNumberIndex/{phone}` | upsert/delete (somente se `phoneNumber` enviado) |

---

## Notas de implementacao

- O campo `updateData` e do tipo `Record<string, any>` (nao totalmente tipado) — bug conhecido, pode ser melhorado em refatoracao futura.
- `auth.updateUser` para `displayName` roda fora da transacao do Firestore porque a Firebase Auth API nao suporta transacoes. Se o Auth update falhar e o Firestore update tiver sucesso, o `displayName` pode ficar dessincronizado — situacao aceita pelo design atual.
