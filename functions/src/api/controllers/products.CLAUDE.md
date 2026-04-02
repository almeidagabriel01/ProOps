# products.controller.ts e services.controller.ts — Documentacao

Ambos os controllers seguem o mesmo padrao de CRUD com permissoes, limite de plano e exclusao de imagens. A principal diferenca esta nos campos do documento e nos pricing models (apenas produtos tem `pricingModel` multi-niche).

## Arquivos fonte

- `functions/src/api/controllers/products.controller.ts`
- `functions/src/api/controllers/services.controller.ts`

## Rotas (core.routes.ts)

| Metodo | Path | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/products` | `createProduct` | autenticado + permissao |
| `PUT` | `/products/:id` | `updateProduct` | autenticado + permissao |
| `DELETE` | `/products/:id` | `deleteProduct` | autenticado + permissao |
| `POST` | `/services` | `createService` | autenticado + permissao |
| `PUT` | `/services/:id` | `updateService` | autenticado + permissao |
| `DELETE` | `/services/:id` | `deleteService` | autenticado + permissao |

---

## Limite de plano compartilhado

**Tanto produtos quanto servicos compartilham o mesmo contador `usage.products` e o mesmo limite `maxProducts` do plano.** Um tenant no plano `starter` com limite 120 tem 120 slots para o total de produtos + servicos combinados.

---

## Pricing Models (produtos — multi-niche)

O campo `pricingModel` e sanitizado pela funcao `sanitizePricingModel()` antes de qualquer escrita. Modos validos:

| Modo | Descricao | Campos adicionais |
|------|-----------|------------------|
| `standard` | Preco simples por unidade | nenhum |
| `curtain_meter` | Preco por metro (nichos de cortinas) | nenhum |
| `curtain_width` | Preco por largura (nichos de cortinas) | nenhum |
| `curtain_height` | Preco por faixa de altura | `tiers: SanitizedHeightTier[]` |

**`curtain_height` com `tiers`:**
- Maximo de 30 faixas (`MAX_HEIGHT_TIERS = 30`)
- Cada tier sanitizado por `sanitizeHeightTier`:
  - `maxHeight > 0`, `basePrice > 0`, `0 <= markup <= 1000`
  - `id` truncado em 120 chars; gerado como `tier-{index+1}` se ausente
- Tiers ordenados por `maxHeight` crescente
- Se `pricingModel.mode === "curtain_height"` mas `tiers` vazio → `400`

Qualquer modo desconhecido resulta em `{ mode: "standard" }` silenciosamente.

---

## Modelo de dados — colecao `products`

```typescript
{
  tenantId: string,
  name: string,
  description: string,
  price: string | number,
  markup: string,               // percentual de markup
  pricingModel: {
    mode: "standard" | "curtain_meter" | "curtain_width" | "curtain_height",
    tiers?: SanitizedHeightTier[],
  },
  manufacturer: string,
  category: string,
  inventoryValue: number,       // parseado e normalizado
  inventoryUnit: "unit" | "meter",
  stock: number,                // espelho de inventoryValue (compat)
  status: "active" | "inactive",
  images: string[],             // URLs do Firebase Storage
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

## Modelo de dados — colecao `services`

```typescript
{
  tenantId: string,
  name: string,
  description: string,
  price: string,
  category: string,
  status: "active" | "inactive",
  images: string[],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  // Campos legados removidos no update (FieldValue.delete()):
  // markup, manufacturer, stock
}
```

> O `updateService` remove explicitamente `markup`, `manufacturer` e `stock` com `FieldValue.delete()` para limpar dados de produtos que foram convertidos para servicos.

---

## `createProduct` — POST /products

**Validacoes:**
- `name` >= 2 caracteres
- `pricingModel` sanitizado; erro se `curtain_height` com tiers vazios
- `inventoryValue` parseado por `parseInventoryValue` (aceita number ou string com virgula decimal)
- `inventoryUnit` normalizado: somente `"meter"` ou `"unit"` (default `"unit"`)

**Verificacao de permissao:**
- Masters e superadmins: livre
- Membros: `checkPermission(userId, "products", "canCreate")`

**Limite de plano:**
- Lido de `targetMasterData.subscription?.limits?.maxProducts`
- Se `currentProducts >= maxProducts`: `402` (superadmin bypassa)

**Transacao atomica:**
1. Cria doc em `products/{newId}`
2. Incrementa `usage.products` no master
3. Incrementa `usage.products` em `companies/{tenantId}` (se existir)

**SuperAdmin em outro tenant:** mesmo padrao do clients.controller — busca o owner pelo `targetTenantId` para usar o `masterRef` correto.

**Respostas:**
- `201` `{ success: true, productId, message }`
- `400` validacao falhou
- `402` limite de plano
- `403` sem permissao

---

## `updateProduct` — PUT /products/:id

**Campos permitidos no safe update:**
`name`, `description`, `price`, `markup`, `pricingModel`, `manufacturer`, `category`, `images`, `image`, `status`, `inventoryUnit`

- `pricingModel` resanitizado se presente
- `inventoryValue`/`stock` sincronizados: se qualquer um for enviado, ambos recebem o mesmo valor normalizado
- `inventoryUnit` normalizado para `"meter"` ou `"unit"`

**Respostas:**
- `200` `{ success: true, message }`
- `400` ID invalido ou pricingModel invalido
- `403` tenant mismatch ou sem permissao
- `404` produto nao encontrado

---

## `deleteProduct` — DELETE /products/:id

**Antes de deletar:** chama `deleteProductImages(images, tenantId)` de `lib/storage-helpers` para remover as imagens do Firebase Storage.

**Transacao atomica:**
1. Deleta `products/{id}`
2. Decrementa `usage.products` no master correto
3. Decrementa `usage.products` em `companies/{tenantId}` (se existir)

**Respostas:**
- `200` `{ success: true, message: "Produto e imagens removidos." }`
- `403` acesso negado
- `404` produto nao encontrado

---

## `createService` — POST /services

Mesmo padrao do `createProduct`, mas:
- Sem `pricingModel`
- Usa `sanitizeServicePayload` para normalizar campos
- Requer `price` obrigatorio (retorna `400` se ausente)
- Mesmo limite de plano (`usage.products`)

**Body:**
```json
{
  "name": "string",
  "description": "string",
  "price": "string",
  "category": "string",
  "status": "active",
  "images": []
}
```

---

## `updateService` — PUT /services/:id

- Remove `markup`, `manufacturer`, `stock` do documento com `FieldValue.delete()`
- Usa `sanitizeServicePayload` para sanitizar campos recebidos

---

## `deleteService` — DELETE /services/:id

Identico ao `deleteProduct`: deleta imagens do Storage, depois deleta o documento em transacao decrementando `usage.products`.

---

## Multi-tenancy

Todos os endpoints verificam `productData.tenantId === tenantId` (ou `serviceData.tenantId`). SuperAdmin bypassa essa verificacao.

## Dependencias

- `lib/auth-helpers` — `resolveUserAndTenant`, `checkPermission`, `UserDoc`
- `lib/storage-helpers` — `deleteProductImages`

## Notas de performance

- O limite de plano e verificado fora da transacao (lendo `targetMasterData.subscription.limits.maxProducts`) — pode haver race condition em criacao concorrente de muitos produtos. Aceito como tradeoff de performance vs. consistencia estrita.
- A ordem de operacoes no Storage (deleção de imagens) acontece **antes** da transacao do Firestore. Se o Firestore falhar, as imagens ja foram deletadas. Bug conhecido, aceito pelo design atual.
