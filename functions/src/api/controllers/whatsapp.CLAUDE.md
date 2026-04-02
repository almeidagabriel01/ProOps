# CLAUDE.md — WhatsApp Controller & Servicos

## Arquivos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `functions/src/api/controllers/whatsapp.controller.ts` | Handlers HTTP: verify challenge e webhook |
| `functions/src/api/routes/whatsapp.routes.ts` | Registro de rotas |
| `functions/src/api/services/whatsapp/whatsapp.api.ts` | Envio de mensagens para a API da Meta |
| `functions/src/api/services/whatsapp/whatsapp.session.ts` | Sessoes, rate limit por numero, contagem de uso |
| `functions/src/api/services/whatsapp/whatsapp.flows.ts` | Handlers de cada acao do menu |
| `functions/src/api/services/whatsapp/whatsapp.db.ts` | Queries Firestore para o bot |
| `functions/src/api/services/whatsapp/whatsapp.utils.ts` | Assinatura HMAC, normalizacao de telefone, config da API |
| `functions/src/api/services/whatsapp/whatsapp.types.ts` | Tipos TypeScript da integracao |

---

## Rotas

| Método | Caminho | Handler | Auth |
|--------|---------|---------|------|
| `GET` | `/webhooks/whatsapp` | `verifyChallenge` | Nenhuma — Meta envia token |
| `POST` | `/webhooks/whatsapp` | `handleWebhook` | Assinatura HMAC (`x-hub-signature-256`) |

---

## Variaveis de ambiente obrigatorias

| Variavel | Uso |
|----------|-----|
| `WHATSAPP_APP_SECRET` | Verificacao de assinatura HMAC do webhook (SHA-256) |
| `WHATSAPP_VERIFY_TOKEN` | Token de challenge para ativacao do webhook na Meta |
| `WHATSAPP_ACCESS_TOKEN` | Bearer token para chamadas a `graph.facebook.com/v18.0` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numerico do numero de telefone no WhatsApp Business |
| `WHATSAPP_MONTHLY_LIMIT` | Limite mensal de mensagens por tenant (default: 2000) |
| `WHATSAPP_MINUTE_LIMIT` | Limite por minuto por telefone (default: 10) |
| `WHATSAPP_DAILY_LIMIT` | Limite diario por telefone (default: 200) |
| `WHATSAPP_PDF_ALLOWED_HOSTS` | Hosts permitidos para download de PDF (default: Firebase Storage) |

---

## Verify Challenge (GET /webhooks/whatsapp)

Fluxo de ativacao do webhook pela Meta:

```
GET /webhooks/whatsapp
  ?hub.mode=subscribe
  &hub.verify_token=<WHATSAPP_VERIFY_TOKEN>
  &hub.challenge=<string_aleatoria>
```

Resposta esperada: HTTP 200 com o valor de `hub.challenge` no body. Qualquer outro token retorna 403.

---

## Verificacao de assinatura HMAC

Toda requisicao POST da Meta inclui o header `x-hub-signature-256: sha256=<hash>`.

`verifyWhatsAppSignature(rawBody, signature, appSecret)` em `whatsapp.utils.ts`:

1. Extrai o hash do header (formato `sha256=<hex>`)
2. Calcula `HMAC-SHA256(rawBody, WHATSAPP_APP_SECRET)`
3. Compara com `crypto.timingSafeEqual` (previne timing attacks)
4. O `rawBody` e o Buffer bruto preservado pelo middleware Express em `req.rawBody`

Retorna 401 se a assinatura for invalida.

---

## Fluxo do webhook (POST /webhooks/whatsapp)

```
Meta POST /webhooks/whatsapp
  └─ 1. Verificar assinatura HMAC
  └─ 2. Ignorar eventos que nao sejam mensagens (ex: status updates)
  └─ 3. Extrair numero do remetente (from)
  └─ 4. Rate limit por numero (checkRateLimit)
  └─ 5. Normalizar numero → buscar phoneNumberIndex/{phone}
  └─ 6. Validar usuario (users/{userId}) e tenant
  └─ 7. Verificar role do usuario via Auth claims
  └─ 8. Verificar user.status !== "inactive"
  └─ 9. Verificar tenantData.whatsappEnabled === true
  └─ 10. Verificar limite mensal (checkUsage)
  └─ 11. Resolver acao pelo texto ou pelo interactiveId
  └─ 12. Executar handler do flow
  └─ 13. incrementUsage(tenantId)
  └─ Retornar 200 OK (Meta exige sempre 200, mesmo em erros)
```

**Importante:** O webhook SEMPRE retorna HTTP 200. Se retornar 4xx/5xx, a Meta vai retentar o envio indefinidamente. Erros sao logados mas nao propagados para o status HTTP.

---

## Resolucao de usuario por numero de telefone

Estrutura no Firestore: `phoneNumberIndex/{normalizedPhone}` com `{ userId, tenantId }`.

Normalizacao de numero em `normalizePhoneNumber(value)`:
- Remove nao-digitos
- Numeros com 10 ou 11 digitos: prefixo `55` adicionado (Brasil)
- Numeros com 12 digitos comecando com `55`: adiciona `9` apos o DDI+DDD (portabilidade)

Validacoes apos busca:
- `phoneIndexData.tenantId` deve bater com `user.tenantId` — mismatch = numero desvinculado
- `claimTenantId` (do Firebase Auth) deve bater com `indexedTenantId` — mismatch = bloqueio + log de aviso
- `user.status !== "inactive"` — usuarios inativos nao tem acesso

---

## Controle de acesso financeiro

Apenas roles `admin`, `master`, `wk` e `superadmin` podem acessar dados financeiros pelo WhatsApp.

| Acao | Roles permitidos |
|------|-----------------|
| Ver propostas | Todos |
| Resumo financeiro do dia | admin, master, wk, superadmin |
| Saldo atual | admin, master, wk, superadmin |
| Ultimos lancamentos | admin, master, wk, superadmin |
| Contas da semana | admin, master, wk, superadmin |
| PDF de proposta | Todos |
| Link de lancamento | Todos |

Tentativas nao autorizadas sao logadas via `logAction(..., "unauthorized_access_attempt", ...)`.

---

## Menu interativo

O bot usa mensagens interativas da Meta (tipo `list` para usuarios com acesso financeiro, tipo `button` para os demais).

### IDs de botoes/lista e handlers

| `interactiveId` | Handler |
|-----------------|---------|
| `menu_proposals` | `handleListProposals` |
| `menu_financial` | `handleFinancialDaySummary` |
| `menu_balance` | `handleCurrentBalance` |
| `menu_transactions` | `handleListRecentTransactions` |
| `menu_weekly_bills` | `handleWeeklySummary` |
| `proposal_pdf_{proposalId}` | `handleSendPdf` |
| `transaction_link_{transactionId}` | `handleSendTransactionLink` |

### Textos reconhecidos (sem botao)
- `"1"` ou variantes de `"ver propostas"` → propostas
- `"2"` ou variantes de `"financeiro de hoje"` → resumo do dia
- `"3"` ou variantes de `"saldo"` → saldo
- `"#<proposalId>"` → envia PDF direto pelo ID
- Numero digitado apos listar propostas → envia PDF da proposta na posicao

Operacoes de escrita (`cadastrar`, `editar`, `criar`, `alterar`, `excluir`) retornam mensagem informando que devem ser feitas no sistema.

---

## Flows (`whatsapp.flows.ts`)

### `handleListProposals`
- Busca 10 propostas do tenant ordenadas por `updatedAt desc`
- Envia lista interativa com botoes `proposal_pdf_{id}`
- Session: `lastAction: "idle"` (nao usa awaiting_proposal_selection mais)

### `handleSendPdf`
- Busca proposta por ID validando `tenantId`
- Cria shared link via `SharedProposalService.createShareLink`
- Envia URL do link por mensagem de texto (nao envia PDF direto, evita timeout)

### `handleFinancialDaySummary`
- Calcula "hoje" em BRT (UTC-3) — todos os tenants sao brasileiros
- Queries em `transactions` com range de `createdAt` + fallback
- Retorna entradas, saidas e resultado do dia

### `handleCurrentBalance`
- Soma `balance` de todas as carteiras ativas do tenant
- Fallback para campo `amount` em dados legados

### `handleWeeklySummary`
- Calcula inicio/fim da semana atual (segunda a domingo)
- Busca `status in ["pending", "overdue"]` e filtra por `dueDate` em memoria

### `handleListRecentTransactions`
- Busca 150 (limitN * 15) transacoes mais recentes
- Agrupa por `proposalGroupId` e `installmentGroupId` em memoria
- Retorna os 10 primeiros grupos/standalone
- Envia lista interativa com botoes `transaction_link_{id}`

### `handleSendTransactionLink`
- Cria shared link via `SharedTransactionService.createShareLink`
- Envia URL por mensagem de texto

---

## Sessoes (`whatsapp.session.ts`)

### Coleção `whatsappSessions/{phoneNumber}`

```
phoneNumber: string
userId: string
lastAction: "idle" | "awaiting_proposal_selection"
proposalsShown: { id: string, index: number }[]
expiresAt: Timestamp   // 10 minutos de inatividade
updatedAt: Timestamp
```

Sessoes expiradas sao recriadas como novas (sem estado anterior). Limpeza de sessoes com `expiresAt` > 24h atras acontece no cron `checkDueDates`.

### Rate limit por numero (`checkRateLimit`)

Usa Firestore Transaction para leitura+escrita atomica em `whatsappRateLimit/{phoneNumber}`:

- **Por minuto:** janela deslizante de 60s — limite default 10 mensagens
- **Por dia:** janela deslizante de 24h — limite default 200 mensagens

Se ultrapassar qualquer limite: mensagem de aviso + retorna `false` (sem processar a acao).

---

## Uso mensal e overage (`whatsapp.session.ts`)

### Coleção `whatsappUsage/{tenantId}/months/{YYYY-MM}`

```
companyId: string
month: string                     // "YYYY-MM"
totalMessages: number
includedMessages: number          // min(totalMessages, includedLimit)
includedLimit: number             // limite do plano
overageMessages: number           // max(0, totalMessages - includedLimit)
eightyPercentAlertSent: boolean
limitReachedAlertSent: boolean
stripeReported: boolean           // true apos cron reportar ao Stripe
updatedAt: Timestamp
```

### `checkUsage(tenantId, limit, allowOverage)`
- Se `allowOverage === true`: sempre retorna `true` (overage permitido, sera cobrado depois)
- Caso contrario: retorna `false` se `totalMessages >= limit`

### `incrementUsage(tenantId, limit, userPhone)`
- Incrementa `totalMessages`, recalcula `overageMessages` e `includedMessages`
- Dispara alerta para o usuario em 80% do limite (uma unica vez)
- Dispara alerta ao atingir o limite (uma unica vez)

### Tenant doc campos relacionados

```
whatsappEnabled: boolean           // deve ser true para usar
whatsappMonthlyLimit: number       // override do limite global
whatsappAllowOverage: boolean      // habilita cobranca de overage via Stripe Meters
```

---

## Envio de mensagens (`whatsapp.api.ts`)

Todas as funcoes usam `getWhatsAppApiConfig()` para obter token e phoneNumberId. Se a config estiver ausente/invalida, a funcao retorna silenciosamente (sem lancar erro) para nao quebrar o fluxo do webhook.

### `sendWhatsAppMessage(to, body)`
Mensagem de texto simples. Endpoint: `POST graph.facebook.com/v18.0/{phoneNumberId}/messages`

### `sendWhatsAppPdf(to, pdfBuffer, fallbackLink, caption)`
1. Tenta upload do buffer como media: `POST .../media` (multipart/form-data)
2. Se upload OK: envia documento com `id: mediaId`
3. Se upload falhar: envia com `link: fallbackLink` (fallback)

### `sendWhatsAppInteractiveMessage(to, interactivePayload)`
Mensagem com botoes ou lista. O `interactivePayload` segue o schema da Meta API.

### Formatacao de numero de saida (`formatOutboundNumber`)
Numeros com 12 digitos comecando com `55` (sem o 9): insere o `9` apos DDI+DDD.

---

## Normalizacao do token de acesso

`normalizeWhatsAppAccessToken(rawValue)` em `whatsapp.utils.ts` lida com varios formatos de env var:
- Remove aspas e espacos em branco
- Remove prefixo `WHATSAPP_ACCESS_TOKEN=` (se copiado com o nome da variavel)
- Faz parse de JSON `{ "access_token": "..." }` se o valor for um objeto JSON
- Remove prefixo `Bearer ` automaticamente

---

## Segurança de URLs de PDF

`WHATSAPP_PDF_ALLOWED_HOSTS` controla quais hosts podem ser acessados para download de PDF:
- Default: `firebasestorage.googleapis.com`, `firebasestorage.app`, `storage.googleapis.com`
- `validateOutboundUrl` bloqueia IPs privados, localhost e metadata endpoints de cloud
- Timeout de 5 segundos para HEAD/GET ao validar acessibilidade
- Limite de 10MB por PDF

---

## Coleções Firestore usadas pelo WhatsApp

| Coleção | Uso |
|---------|-----|
| `phoneNumberIndex/{phone}` | Mapeamento telefone → userId + tenantId |
| `whatsappSessions/{phone}` | Sessoes de conversa (TTL 10 min) |
| `whatsappRateLimit/{phone}` | Rate limit por minuto e por dia |
| `whatsappUsage/{tenantId}/months/{YYYY-MM}` | Contagem mensal por tenant |
| `whatsappLogs` | Log de acoes do bot (tipo, detalhes, timestamp) |

---

## Billing de Overage

O cron `reportWhatsappOverage` (dia 1, 03:00 BRT) reporta o campo `overageMessages` ao Stripe via `stripe.billing.meterEvents.create`. Ver detalhes completos em `functions/src/CLAUDE.md`.

O endpoint manual de debug fica em `POST /internal/cron/whatsapp-overage-report` com header `x-cron-secret`.

---

## Pontos de atencao

- O webhook SEMPRE responde 200 para a Meta — nunca lancar erro HTTP
- `phoneNumberIndex` e populado quando o usuario cadastra seu telefone no sistema — sem esse doc o usuario nao consegue usar o bot
- Dados financeiros so sao retornados para roles `admin`, `master`, `wk`, `superadmin`
- O `interactiveId` e sanitizado: apenas `[a-zA-Z0-9_-]{1,128}` e aceito
- O ID de proposta informado via `#<id>` passa pela mesma regex de sanitizacao
- `logAction` trunca details em 2000 chars para evitar documentos gigantes no Firestore
