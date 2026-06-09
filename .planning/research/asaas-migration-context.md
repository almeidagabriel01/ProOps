# Contexto: Migração MercadoPago → Asaas (PIX + Boleto)

> Colar este documento no início de uma nova sessão para implementar a migração completa.
> Escopo: remover MercadoPago inteiramente e substituir por Asaas para PIX e boleto.
> Cartão fora do escopo por ora.

---

## 1. Contexto de negócio

O ProOps é um ERP multi-tenant SaaS. Tenants conectam uma conta de pagamento para que seus clientes finais paguem lançamentos financeiros via link público (`/share/transaction/[token]`). O dinheiro vai direto para a conta do tenant — ProOps nunca toca no dinheiro.

**Situação atual:** integração com MercadoPago via OAuth marketplace (cada tenant conecta sua conta MP). Problemas crônicos de sandbox instável + onboarding complexo para o tenant.

**Decisão:** migrar para **Asaas** (subconta por tenant). O tenant cria/conecta uma subconta Asaas — o Asaas faz KYC — e fornece a API key da subconta para o ProOps armazenar. Escopo desta migração: **PIX e boleto apenas**. Cartão fica para depois.

---

## 2. Como o Asaas funciona (modelo de integração)

### Autenticação

Cada subconta Asaas tem uma API key própria (`$access_token` no header).

```
Header: access_token: $aact_XXXXXX  (sandbox)
Header: access_token: $PROD_KEY     (produção)
```

### Base URL

- Sandbox: `https://sandbox.asaas.com/api/v3`
- Produção: `https://api.asaas.com/api/v3`

### Criar cobrança PIX

```http
POST /payments
{
  "customer": "cus_XXXXXX",       // ID do cliente no Asaas (ou criar inline)
  "billingType": "PIX",
  "value": 150.00,
  "dueDate": "2026-06-01",
  "description": "Lançamento #123",
  "externalReference": "{transactionId}:{attemptId}"  // para idempotência
}
```

Resposta inclui `pixQrCode` (copia-cola) e `pixQrCodeImage` (base64 do QR).

### Criar cobrança Boleto

```http
POST /payments
{
  "customer": "cus_XXXXXX",
  "billingType": "BOLETO",
  "value": 150.00,
  "dueDate": "2026-06-01",
  "description": "Lançamento #123",
  "externalReference": "{transactionId}:{attemptId}",
  "postalService": false
}
```

Resposta inclui `bankSlipUrl` (PDF do boleto) e `invoiceUrl`.

### Criar/buscar cliente no Asaas

```http
POST /customers
{
  "name": "João Silva",
  "cpfCnpj": "12345678901",     // opcional mas recomendado para boleto
  "email": "joao@email.com"
}
```

Para boleto: CPF/CNPJ obrigatório. Para PIX: apenas nome + email.

### Webhook Asaas → ProOps

Asaas envia POST para URL configurada por subconta quando status muda.
Payload relevante:

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_XXXXXX",
    "externalReference": "txId:attemptId",
    "status": "RECEIVED",
    "value": 150.0,
    "netValue": 148.5,
    "billingType": "PIX"
  }
}
```

Eventos relevantes: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`.

Autenticidade: Asaas envia header `asaas-access-token` com a API key da subconta. Valide que a API key no header corresponde à subconta do tenant.

### Consultar status de cobrança

```http
GET /payments/{asaasPaymentId}
```

### Polling de confirmação PIX

Para o QR Code PIX, o cliente paga e o Asaas notifica via webhook. Para polling no frontend (similar ao que existe para MP), consultar `GET /payments/{id}` a cada N segundos.

---

## 3. Arquitetura atual (o que existe para MP)

### Stack

- Backend: `apps/functions/` — Firebase Cloud Functions V2 (Express), Node 22, TypeScript
- Frontend: `apps/web/` — Next.js App Router

### Fluxo atual MP (o que será substituído)

```
Tenant conecta MP via OAuth → tokens salvos em tenants/{id}.mercadoPago
Cliente abre /share/transaction/[token] → modal de pagamento
Modal chama GET /v1/share/:token/mp-config → publicKey + environment
Cliente escolhe PIX → POST /v1/share/:token/pay (method: "pix")
Backend cria preference no MP → retorna QR Code
Cliente escolhe Boleto → POST /v1/share/:token/pay (method: "boleto")
Backend cria preference no MP → retorna barcode
MP envia webhook → POST /webhooks/mercadopago (função separada)
Webhook marca transação como paga no Firestore
```

---

## 4. Arquivos críticos a modificar/remover

### Backend — MODIFICAR

| Arquivo                                                           | Tamanho aprox. | O que muda                                                                                                                                                                    |
| ----------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/functions/src/api/services/transaction-payment.service.ts`  | ~1350 linhas   | Arquivo principal. Substituir lógica PIX/boleto MP por Asaas. Remover `processCardPayment`. Remover `MercadoPagoApiError`. Renomear para `payment.service.ts` ou manter nome. |
| `apps/functions/src/api/services/mercadopago.service.ts`          | ~340 linhas    | Substituir por `asaas.service.ts` — CRUD da conexão Asaas por tenant (salvar API key, validar, desconectar)                                                                   |
| `apps/functions/src/api/controllers/payment-public.controller.ts` | ~300 linhas    | Remover `processCardPayment`. Manter `createPayment` e `getMpConfig` (renomear para `getPaymentConfig`). Atualizar mapeamento de erros.                                       |
| `apps/functions/src/lib/mercadopago-client.ts`                    | ~196 linhas    | **DELETAR** — era só para OAuth MP                                                                                                                                            |
| `apps/functions/src/mercadopagoWebhook.ts`                        | ~568 linhas    | **SUBSTITUIR** por `asaasWebhook.ts` — handler do webhook Asaas                                                                                                               |

### Backend — CRIAR

| Arquivo                                                  | Propósito                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/functions/src/api/services/asaas.service.ts`       | Gerencia conexão Asaas por tenant: salvar API key, testar conexão, desconectar |
| `apps/functions/src/api/controllers/asaas.controller.ts` | Endpoints para o tenant conectar/desconectar Asaas (settings)                  |
| `apps/functions/src/asaasWebhook.ts`                     | Cloud Function HTTP separada para receber webhooks do Asaas                    |

### Backend — VERIFICAR (rotas)

```
apps/functions/src/api/routes/
  mercadopago.routes.ts   → renomear para asaas.routes.ts ou payments.routes.ts
  payments.routes.ts      → verificar se existe (rotas públicas de pagamento)
```

### Frontend — MODIFICAR

| Arquivo                                                                         | O que muda                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/share/transaction/[token]/_components/payment-modal.tsx`      | Remover aba Cartão. Remover toda lógica MP-específica. Adaptar PIX/boleto para Asaas (sem mudança de UX para o cliente final — QR Code e boleto ficam iguais visualmente). |
| `apps/web/src/app/share/transaction/[token]/_components/card-payment-brick.tsx` | **DELETAR** — cartão fora do escopo                                                                                                                                        |
| `apps/web/src/services/mercadopago-service.ts`                                  | Substituir por `payment-service.ts` — tipos e chamadas para os novos endpoints                                                                                             |
| `apps/web/src/app/settings/` (página de configurações do tenant)                | Substituir seção "Conectar MercadoPago" por "Conectar Asaas"                                                                                                               |

### Frontend — CRIAR

| Arquivo                                                   | Propósito                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/app/settings/_components/asaas-connect.tsx` | Componente para o tenant inserir sua API key Asaas e salvar |

### Entry point

| Arquivo                       | O que muda                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/functions/src/index.ts` | Substituir export `stripeWebhook` → `mercadopagoWebhook` por `asaasWebhook`. Remover exports relacionados a MP OAuth. |

---

## 5. Modelo de dados Firestore

### Atual (MP)

```typescript
// tenants/{tenantId}
{
  mercadoPago: {
    userId: string,
    accessToken: string,      // token OAuth
    refreshToken: string,
    publicKey: string,
    expiresAt: string,
    liveMode: boolean,
    environment: "sandbox" | "production",
    connectedAt: string,
  },
  mercadoPagoEnabled: boolean,
}
```

### Novo (Asaas)

```typescript
// tenants/{tenantId}
{
  asaas: {
    apiKey: string,           // API key da subconta Asaas ($aact_XXX)
    environment: "sandbox" | "production",
    walletId?: string,        // ID da subconta (obtido via GET /myAccount)
    connectedAt: string,
    webhookUrl: string,       // URL configurada no Asaas para esta subconta
  },
  asaasEnabled: boolean,
}
```

**Importante:** a API key da subconta Asaas é o único segredo necessário. Não há OAuth, não há refresh token — é só uma key que o tenant copia do painel Asaas e cola na ProOps.

### Coleção de tentativas de pagamento (manter estrutura)

```typescript
// payment_attempts/{attemptId}
{
  tenantId: string,
  transactionId: string,
  token: string,            // share token
  method: "pix" | "boleto",
  status: "initiated" | "completed" | "failed",
  gateway: "asaas",         // novo campo
  gatewayPaymentId: string, // ID do Asaas (pay_XXXX)
  externalReference: string, // "{transactionId}:{attemptId}"
  environment: "sandbox" | "production",
  createdAt: string,
}
```

### Idempotência do webhook

```typescript
// webhookEvents/{asaasWebhookId}
// Mesma estrutura da Phase 23 do MP — usar mesmo padrão
{
  gateway: "asaas",
  status: "processing" | "processed" | "failed",
  createdAt: Timestamp,
  processedAt?: Timestamp,
}
```

---

## 6. Variáveis de ambiente

### Remover do `.env.erp-softcode` e `.env.erp-softcode-prod`

```
MERCADOPAGO_APP_ID
MERCADOPAGO_CLIENT_SECRET
MERCADOPAGO_OAUTH_REDIRECT_URI
MERCADOPAGO_STATE_SECRET
MERCADOPAGO_WEBHOOK_SECRET
MERCADOPAGO_PLATFORM_ACCESS_TOKEN
MERCADOPAGO_SANDBOX_PUBLIC_KEY
MERCADOPAGO_SANDBOX_ACCESS_TOKEN
MERCADOPAGO_SANDBOX_BUYER_EMAIL
```

### Adicionar

```bash
# Asaas
ASAAS_WEBHOOK_SECRET=<string aleatória para validar webhooks>
# Sandbox: usar API key de uma subconta Asaas de teste para validação
ASAAS_SANDBOX_API_KEY=
```

**Nota:** cada tenant armazena sua própria API key no Firestore (campo `asaas.apiKey`). As envs acima são apenas para configuração global da plataforma.

---

## 7. Endpoints a criar/modificar

### Endpoints públicos (sem auth — usados no share link)

```
GET  /v1/share/:token/payment-config   → retorna { gateway: "asaas", environment }
POST /v1/share/:token/pay              → cria PIX ou boleto
GET  /v1/share/:token/payment-status/:paymentId  → polling de status
```

### Endpoints autenticados (tenant — settings)

```
POST /v1/asaas/connect      → salva API key do Asaas, valida via GET /myAccount
GET  /v1/asaas/status       → retorna status de conexão (sem expor API key)
DELETE /v1/asaas/disconnect → remove dados Asaas do tenant
```

### Remover

```
GET  /v1/share/:token/mp-config       → substituído por /payment-config
POST /v1/share/:token/card            → cartão fora do escopo
GET  /v1/mercadopago/connect-url      → remover (era OAuth)
GET  /v1/mercadopago/callback         → remover
GET  /v1/mercadopago/status           → substituir por /v1/asaas/status
DELETE /v1/mercadopago/disconnect     → substituir por /v1/asaas/disconnect
```

---

## 8. Lógica do webhook Asaas (`asaasWebhook.ts`)

```typescript
// Cloud Function HTTP separada (não parte do monolito Express)
// URL: https://.../asaasWebhook

// 1. Receber POST do Asaas
// 2. Extrair header "asaas-access-token" (API key da subconta que enviou)
// 3. Buscar tenant pelo apiKey em tenants onde asaas.apiKey === headerApiKey
//    (criar índice Firestore: asaas.apiKey ASC)
// 4. Idempotência: usar payment.id como chave em webhookEvents/{asaasPaymentId}
// 5. Se event === "PAYMENT_RECEIVED" ou "PAYMENT_CONFIRMED":
//    a. Extrair externalReference: "{transactionId}:{attemptId}"
//    b. Buscar payment_attempts/{attemptId}
//    c. Atualizar transactions/{transactionId} → status: "paid"
//    d. Atualizar wallets (FieldValue.increment) — igual lógica atual
//    e. Atualizar payment_attempts → status: "completed", gatewayPaymentId
// 6. Retornar 200 sempre (Asaas não retenta em 4xx mas é boa prática)
```

**Atenção:** busca de tenant por `asaas.apiKey` requer índice Firestore:

```json
{
  "collectionGroup": "tenants",
  "fields": [{ "fieldPath": "asaas.apiKey", "order": "ASCENDING" }]
}
```

---

## 9. Lógica de criação de pagamento (`payment.service.ts`)

```typescript
// Criar cliente no Asaas (ou buscar por externalReference/cpfCnpj)
// Para PIX: POST /payments com billingType: "PIX"
// Para boleto: POST /payments com billingType: "BOLETO"
//   - Boleto exige CPF/CNPJ do pagador — buscar do cliente no Firestore
//   - Se não tiver CPF/CNPJ: retornar erro amigável pedindo o dado
// Salvar payment_attempts com gatewayPaymentId (pay_XXXX)
// Retornar { qrCode, qrCodeImage } para PIX
// Retornar { barcodeContent, boletoUrl, expiresAt } para boleto
```

---

## 10. UX do frontend (payment-modal.tsx)

Para o cliente final, a UX muda minimamente:

- Aba "Cartão" removida (apenas PIX e Boleto)
- QR Code PIX: igual ao atual (base64 da imagem + copia-cola)
- Boleto: link para PDF do boleto (bankSlipUrl do Asaas) + linha digitável
- Sandbox alert: substitui menção a MP por mensagem genérica de teste

Para o tenant (settings):

- Remover seção "Conectar MercadoPago"
- Adicionar seção "Conectar Asaas" com campo para API key + botão "Conectar"
- Instrução: "Acesse asaas.com → Minha Conta → Integração → API key"

---

## 11. Onboarding do tenant no Asaas

O tenant precisa:

1. Criar conta em asaas.com (ou sandbox.asaas.com para teste)
2. Completar KYC (Asaas faz — ProOps não precisa se envolver)
3. Ir em: Minha Conta → Integrações → Gerar API key
4. Colar a API key na ProOps (settings → Pagamentos Online)

O ProOps valida a key chamando `GET /myAccount` na API do Asaas antes de salvar. Se a key for inválida, retorna erro com instruções.

---

## 12. Testes necessários (Bug Fix Policy)

Para cada novo serviço/controller, criar testes em `apps/functions/src/`:

- `api/services/asaas.service.test.ts` — conectar, desconectar, validar key
- `api/controllers/asaas.controller.test.ts` — connect/status/disconnect endpoints
- `__tests__/asaasWebhook.test.ts` — PAYMENT_RECEIVED, idempotência, tenant não encontrado
- `api/services/payment.service.test.ts` — criar PIX, criar boleto, erros Asaas

Mocks necessários: `axios` (chamadas à API Asaas), `../../init` (db), `../../lib/logger`.

---

## 13. Ordem de implementação sugerida

1. **Backend: `asaas.service.ts`** — salvar/validar/remover API key do tenant no Firestore
2. **Backend: rotas de connect/disconnect** — `/v1/asaas/connect`, `/status`, `/disconnect`
3. **Backend: `payment.service.ts`** — criar PIX e boleto via Asaas API
4. **Backend: endpoints públicos** — `/payment-config` e `/pay` no share token
5. **Backend: `asaasWebhook.ts`** — função separada, idempotência, atualizar transação
6. **Backend: registrar função em `index.ts`** e remover `mercadopagoWebhook`
7. **Frontend: settings** — remover MP connect, adicionar Asaas connect
8. **Frontend: payment-modal** — remover aba cartão, adaptar PIX/boleto para Asaas
9. **Remover arquivos MP** — `mercadopago-client.ts`, `mercadopago.service.ts`, `mercadopagoWebhook.ts`, `card-payment-brick.tsx`
10. **Limpar env vars** — remover MERCADOPAGO\_\* do `.env.example` e `.env.erp-softcode`

---

## 14. Itens de atenção / armadilhas

- **Boleto exige CPF/CNPJ** no Asaas — se o cliente no Firestore não tiver esse dado, o endpoint de boleto deve pedir antes de criar
- **Webhook por subconta** — no Asaas, a URL de webhook é configurada por subconta no painel do Asaas. O tenant precisa configurar a URL da ProOps no painel Asaas após conectar. Considerar automatizar via API: `POST /webhooks` na API do Asaas durante o connect
- **Índice Firestore** para busca por `asaas.apiKey` deve ser criado antes do webhook funcionar em produção
- **Variável `gateway`** em `payment_attempts` — ao criar, salvar `gateway: "asaas"` para diferenciar de pagamentos MP antigos (que ficam históricos)
- **Transações pagas via MP** não devem ser afetadas — o webhook Asaas só toca em transações com `payment_attempts` criados pelo novo serviço
- **Segurança da API key** — armazenar criptografada no Firestore ou confiar na segurança nativa do Firestore + regras? O padrão atual do MP usa o token diretamente. Manter o mesmo padrão por ora.
- **Environment Asaas** — sandbox usa URL diferente de produção. Detectar pelo prefixo da API key: `$aact_` = sandbox, `$aasa_` = produção (verificar documentação atual do Asaas)

---

## 15. Comandos para a nova sessão

```bash
# Verificar estado do branch
git log --oneline -10
git status

# Build antes de qualquer mudança
cd apps/functions && npm run build

# Rodar testes
cd apps/functions && npx jest --no-coverage

# Deploy dev após implementar
npm run deploy:dev   # (na raiz)
```

## 16. Agentes recomendados

- `@backend` para toda a implementação de backend (services, controllers, webhook, routes)
- `@frontend` para payment-modal e settings page
- `@full-stack` se precisar coordenar os dois ao mesmo tempo
