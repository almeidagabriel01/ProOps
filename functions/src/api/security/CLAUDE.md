# CLAUDE.md — functions/src/api/security/

Documentação dos módulos de segurança transversal do backend.

## Arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `cors-policy.ts` | Lógica de CORS — parsing de origens permitidas, decisão de allow/deny |
| `url-security.ts` | Validação de URLs de saída — proteção contra SSRF |

---

## cors-policy.ts — Política de CORS

### Visão Geral

Módulo puro de lógica de CORS. Não registra middleware diretamente — fornece funções utilitárias que são consumidas no `api/index.ts` para configurar o middleware `cors`.

### Resolução de Origens Permitidas

`resolveAllowedCorsOrigins()` constrói um `Set<string>` de origens autorizadas a partir de múltiplas fontes, em ordem:

| Variável de Ambiente | Descrição |
|----------------------|-----------|
| `CORS_ALLOWED_ORIGINS` | Lista separada por vírgulas de origens (ex: `https://app.example.com,https://www.app.example.com`) |
| `NEXT_PUBLIC_APP_URL` | URL pública do app Next.js |
| `APP_URL` | URL alternativa do app |
| `VERCEL_URL` | URL de deployment Vercel (sem protocolo, ex: `myapp.vercel.app`) |
| `VERCEL_BRANCH_URL` | URL de branch Vercel |
| `NEXT_PUBLIC_VERCEL_URL` | URL Vercel pública |
| `VERCEL_PROJECT_PRODUCTION_URL` | URL de produção do projeto Vercel |

Em ambiente **não-produção**, `localhost:3000` e `127.0.0.1:3000` são adicionados automaticamente.

### Variantes `www`/sem `www`

`addOriginWithVariants()` adiciona automaticamente a variante www/sem-www para cada origem configurada:

- `https://app.example.com` → também adiciona `https://www.app.example.com`
- `https://www.app.example.com` → também adiciona `https://app.example.com`
- `localhost` e `127.0.0.1` → sem variante (domínios locais)

### Origens de Preview Dinâmico

`isDynamicPreviewOrigin()` permite automaticamente origens com sufixos:
- `*.vercel.app`
- `*.web.app`
- `*.firebaseapp.com`

Comportamento controlado por `CORS_ALLOW_DYNAMIC_PREVIEW_ORIGINS`:
- Produção: `false` por padrão (bloqueado)
- Dev/staging: `true` por padrão (permitido)

### Função de Decisão `evaluateCorsDecision()`

Centraliza toda a lógica de allow/deny. Retorna `CorsDecision`:

```typescript
type CorsDecision =
  | { allow: true; normalizedOrigin?: string }
  | { allow: false; reason: "invalid_origin" | "allowlist_required" | "origin_not_allowed" };
```

| Condição | Decisão | Razão |
|----------|---------|-------|
| Origin vazia/ausente | `allow: true` | Requisição server-to-server sem origin (ex: cron, Stripe webhook) |
| Origin com formato inválido | `allow: false` | `invalid_origin` |
| Lista de origens vazia em produção | `allow: false` | `allowlist_required` — misconfiguration crítica |
| Lista de origens vazia em dev + fallback enabled | `allow: true` | Modo fallback explícito via `ALLOW_CORS_FALLBACK=true` |
| Origin na allowlist | `allow: true` | - |
| Origin é preview dinâmico | `allow: true` | (somente fora de produção por padrão) |
| Qualquer outro caso | `allow: false` | `origin_not_allowed` |

### Variáveis de Ambiente de Controle

| Variável | Padrão | Efeito |
|----------|--------|--------|
| `CORS_ALLOWED_ORIGINS` | - | Lista principal de origens permitidas |
| `ALLOW_CORS_FALLBACK` | `false` | Permite CORS aberto em dev sem allowlist configurada |
| `CORS_ALLOW_DYNAMIC_PREVIEW_ORIGINS` | `true` em dev, `false` em prod | Permite `*.vercel.app`, `*.web.app`, `*.firebaseapp.com` |
| `NODE_ENV` | - | Controla comportamento produção vs desenvolvimento |

### Headers CORS Configurados no `api/index.ts`

```typescript
{
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "x-pdf-generator",
    "x-vercel-protection-bypass",
    "x-cron-secret",
    "x-hub-signature-256",
    "stripe-signature",
    "x-request-id",
  ],
  credentials: false,
  maxAge: 86400,  // 24 horas de cache do preflight
}
```

### Eventos de Segurança Emitidos

| Situação | Evento | Nível |
|----------|--------|-------|
| CORS negado (origin não permitida) | `cors_denied` | WARN |
| Allowlist vazia em produção | `cors_allowlist_required_missing` | ERROR |
| Fallback ativo em dev | `cors_fallback_non_production_enabled` | WARN |

Negações de CORS também incrementam o contador `cors_denied` e geram audit event no Firestore.

### Regras ao Modificar

- Nunca adicionar `credentials: true` sem revisar as implicações de segurança com cookies/sessions
- Em produção, sempre garantir que pelo menos `CORS_ALLOWED_ORIGINS` ou `NEXT_PUBLIC_APP_URL` estejam configuradas
- A função `normalizeOrigin()` é exportada e pode ser usada em testes unitários para validar parsing de origem

---

## url-security.ts — Validação de URLs de Saída (Anti-SSRF)

### Visão Geral

`validateOutboundUrl()` é uma função assíncrona de validação de URLs que o backend deve fazer requisições de saída. Protege contra ataques SSRF (Server-Side Request Forgery) que tentariam fazer o servidor acessar recursos internos (Firestore, metadata de instância GCP, serviços internos).

### Fluxo de Validação

```
URL recebida
  → Comprimento (max: 2048 chars por padrão)
  → Parse da URL (formato válido?)
  → Protocolo (apenas HTTP/HTTPS)
  → HTTP bloqueado (a menos que allowHttp: true)
  → Credenciais na URL (user:pass@host — bloqueado)
  → Hostname presente?
  → Allowlist de hosts (se configurada)
  → Hostname local? (localhost, *.local, *.internal)
  → Resolução DNS do hostname
  → IPs resolvidos são privados/reservados?
  → OK: retorna URL normalizada + IPs resolvidos
```

### Opções

```typescript
interface OutboundUrlValidationOptions {
  allowedHosts?: string[];      // Allowlist de hostnames permitidos (com suporte a subdomínios)
  allowHttp?: boolean;          // Permite HTTP (padrão: false — apenas HTTPS)
  allowLocalAddresses?: boolean; // Permite endereços locais/privados (padrão: false)
  maxUrlLength?: number;        // Comprimento máximo da URL (padrão: 2048)
}
```

### Faixas de IP Bloqueadas por Padrão

| Faixa | Descrição |
|-------|-----------|
| `0.0.0.0/8` | Endereço inválido |
| `10.0.0.0/8` | RFC 1918 — rede privada |
| `127.0.0.0/8` | Loopback |
| `169.254.0.0/16` | Link-local / metadata de instância GCP |
| `172.16.0.0/12` | RFC 1918 — rede privada |
| `192.168.0.0/16` | RFC 1918 — rede privada |
| `100.64.0.0/10` | CGNAT |
| `198.18.0.0/15` | Teste de benchmark |
| `224.0.0.0/4+` | Multicast e reservado |
| `::1` | IPv6 loopback |
| `fe80::/10` | IPv6 link-local |
| `fc00::/7` | IPv6 ULA (endereços únicos locais) |
| `2001:db8::/32` | IPv6 documentação |
| `::ffff:*/32` | IPv4-mapeado em IPv6 (verifica faixas IPv4) |

### Proteção Contra DNS Rebinding

O módulo resolve o hostname via DNS **antes** de retornar aprovação. Mesmo que o hostname pareça público, se resolver para um IP privado (ataque de DNS rebinding), a requisição é bloqueada.

### Retorno

```typescript
// Sucesso
{
  ok: true,
  url: URL,                // objeto URL parseado
  normalizedUrl: string,   // string da URL normalizada
  resolvedAddresses: string[] // IPs resolvidos (para logging)
}

// Falha
{
  ok: false,
  statusCode: 400 | 403,  // 400 = input inválido, 403 = política bloqueou
  reason: string
}
```

### Utilitários Exportados

| Função | Uso |
|--------|-----|
| `parseCommaSeparatedHosts()` | Parseia `ALLOWED_PROXY_HOSTS` env var em array de hostnames normalizados |
| `validateOutboundUrl()` | Validação principal — usar em qualquer ponto que faça fetch de URL externa |

### Onde é Usado

Atualmente consumido pelo `proxy.controller.ts` (endpoint `/v1/aux/proxy-image`) para validar URLs de imagens externas antes de fazer proxy. Deve ser usado em qualquer futuro endpoint que aceite URLs fornecidas pelo cliente.

### Regras ao Modificar

- Nunca passar `allowLocalAddresses: true` em código de produção — apenas para testes
- Nunca passar `allowHttp: true` sem justificativa documentada — requisições HTTP são vulneráveis a MITM
- Se adicionar novos endpoints que recebam URLs do cliente, **obrigatoriamente** usar `validateOutboundUrl()` antes de fazer qualquer `fetch()`
- A resolução DNS é assíncrona e pode falhar — o retorno `ok: false` com `statusCode: 400` e `reason: "Unable to resolve URL hostname"` deve ser tratado como input inválido, não como erro interno
