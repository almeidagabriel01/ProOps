# clients.controller.ts — Documentacao

Controller responsavel pelo CRUD de clientes (contatos/leads/fornecedores). Multi-tenant com verificacao de permissoes granulares e limite de plano.

## Arquivo fonte

`functions/src/api/controllers/clients.controller.ts`

## Rotas (core.routes.ts)

Prefixo montado sem prefixo adicional (core routes).

| Metodo | Path | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/clients` | `createClient` | autenticado + permissao |
| `PUT` | `/clients/:id` | `updateClient` | autenticado + permissao |
| `DELETE` | `/clients/:id` | `deleteClient` | autenticado + permissao |

> Leitura de clientes e feita diretamente do Firestore no frontend via SDK (sem endpoint de listagem no backend).

---

## Modelo de dados — colecao `clients`

```typescript
{
  tenantId: string,
  name: string,
  types: string[],        // ex: ["cliente"], ["fornecedor"], ["lead"]
  source: string,         // "manual" | outros
  sourceId: string | null,
  email?: string,         // lowercase, trimado
  phone?: string,
  address?: string,
  notes?: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## `createClient` — POST /clients

**Validacoes:**
- `name` deve ter >= 2 caracteres (trim antes de verificar)
- `tenantId` obrigatorio (resolvido do token + doc do usuario)

**Verificacao de permissao (membros):**
O sistema verifica em dois caminhos para compatibilidade com dados legados:
1. `checkPermission(userId, "clients", "canCreate")`
2. Fallback: `checkPermission(userId, "customers", "canCreate")` (slug legado)

Se nenhum dos dois retornar `true`, retorna `403`. Masters e superadmins ignoram essa verificacao.

**SuperAdmin atuando em nome de outro tenant:**
Se `isSuperAdmin` e `input.targetTenantId` presente e diferente do proprio tenant, o controller busca o owner do tenant alvo (user sem `masterId`, ou com role `MASTER/ADMIN`) para usar como `targetMasterRef` no decremento/incremento de `usage`.

**Limite de plano:**
Chama `checkClientLimit(targetMasterData)` de `lib/billing-helpers`. Se limite atingido:
- Usuario normal → `402 { message, code: "resource-exhausted" }`
- SuperAdmin → ignora o erro e prossegue

**Transacao atomica:**
1. Cria doc em `clients/{newId}`
2. Incrementa `usage.clients` no doc do master (via `targetMasterRef`)
3. Incrementa `usage.clients` no doc `companies/{tenantId}` (se existir)

**Body:**
```json
{
  "name": "string",
  "email": "string (opcional)",
  "phone": "string (opcional)",
  "address": "string (opcional)",
  "notes": "string (opcional)",
  "types": ["cliente"],
  "source": "manual",
  "sourceId": null,
  "targetTenantId": "string (opcional, apenas superadmin)"
}
```

**Respostas:**
- `201` `{ success: true, clientId, message }`
- `400` nome invalido ou tenantId ausente
- `402` limite de clientes atingido
- `403` sem permissao

---

## `updateClient` — PUT /clients/:id

**Guards de tenant:** verifica que `clientData.tenantId === tenantId` do token. SuperAdmin bypassa.

**Verificacao de permissao (membros):**
Dois caminhos (igual ao create): `"clients"/"canEdit"` ou `"customers"/"canEdit"`.

**Campos seguros para atualizacao:**

```typescript
safeUpdate: {
  name?,
  email?,
  phone?,
  address?,
  notes?,
  types?,
  updatedAt: Timestamp.now()
}
```

Apenas os campos presentes no body sao atualizados (verificacao `!== undefined`). Campos como `tenantId`, `source`, `sourceId`, `createdAt` nao podem ser alterados via update.

**Respostas:**
- `200` `{ success: true, message }`
- `400` ID invalido
- `403` tenant mismatch ou sem permissao
- `404` cliente nao encontrado

---

## `deleteClient` — DELETE /clients/:id

**Guards de tenant:** igual ao update.

**Verificacao de permissao (membros):**
Dois caminhos: `"clients"/"canDelete"` ou `"customers"/"canDelete"`.

**SuperAdmin deletando cliente de outro tenant:**
Busca o owner correto para decrementar `usage.clients` no tenant certo (mesma logica do create).

**Transacao atomica:**
1. Deleta `clients/{id}`
2. Decrementa `usage.clients` no master correto
3. Decrementa `usage.clients` em `companies/{tenantId}` (se existir)

**Respostas:**
- `200` `{ success: true, message: "Cliente removido." }`
- `400` ID ausente
- `403` acesso negado
- `404` cliente nao encontrado

---

## Multi-tenancy

- Toda query busca por documento especifico (`db.collection("clients").doc(id)`) e valida `clientData.tenantId === tenantId` do token
- SuperAdmin pode criar/deletar em outros tenants via `targetTenantId` / deteccao automatica pelo `clientData.tenantId`
- `usage.clients` e mantido desnormalizado tanto no `users/{masterId}` quanto em `companies/{tenantId}`

## Permissoes granulares

O sistema de permissoes usa a subcollection `users/{memberId}/permissions/{pageId}`. Para clientes, o `pageId` pode ser `"clients"` (novo) ou `"customers"` (legado). O controller verifica ambos para compatibilidade retroativa.

## Dependencias

- `lib/auth-helpers` — `resolveUserAndTenant`, `checkPermission`, `UserDoc`
- `lib/billing-helpers` — `checkClientLimit`

## Relacao com outros recursos

Clientes nao tem relacao direta enforecada no backend (sem FK). No entanto:
- Propostas referenciam `clientId` — ao deletar um cliente, propostas existentes nao sao afetadas automaticamente (sem cascade)
- Transacoes podem referenciar `clientId` — mesma situacao
