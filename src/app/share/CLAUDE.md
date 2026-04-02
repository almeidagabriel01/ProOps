# CLAUDE.md — src/app/share/

## Propósito e contexto de negócio

Rotas públicas de visualização de documentos compartilhados via link. Permite que clientes externos (sem conta no sistema) acessem propostas comerciais e recibos/lançamentos financeiros gerados pelo tenant.

O fluxo é: o usuário autenticado gera um link de compartilhamento dentro do sistema, recebe uma URL com token de acesso temporário, e envia esse link para o cliente final.

## Quem pode acessar

Rotas completamente públicas — sem autenticação, sem Firebase Auth, sem middleware de proteção. O único controle de acesso é o token na URL, que expira no backend.

O middleware do Next.js (`middleware.ts`) deve ter estas rotas explicitamente excluídas da proteção de sessão.

## Estrutura de rotas

```
share/
├── [token]/page.tsx              # Proposta compartilhada
└── transaction/[token]/page.tsx  # Lançamento financeiro compartilhado
```

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `share/[token]/page.tsx` | Exibe proposta em formato PDF via `ProposalPdfViewer`. Modo `?print=1` para captura Puppeteer. |
| `share/transaction/[token]/page.tsx` | Exibe lançamento financeiro via `TransactionPdfViewer`. Modo `?print=1` semelhante. |
| `src/services/shared-proposal-service.ts` | Gera link + busca proposta pelo token público |
| `src/services/shared-transaction-service.ts` | Gera link + busca lançamento pelo token público |
| `src/services/pdf/download-shared-proposal-pdf.ts` | Download de PDF sem autenticação via `requiresAuth: false` |
| `src/services/pdf/download-shared-transaction-pdf.ts` | Download de PDF de recibo sem autenticação |
| `src/components/pdf/proposal-pdf-viewer.tsx` | Viewer de PDF da proposta |
| `src/components/pdf/transaction-pdf-viewer.tsx` | Viewer de PDF do lançamento |

## Modelo de dados

```typescript
// src/types/shared-proposal.ts
interface SharedProposal {
  id: string;
  proposalId: string;
  tenantId: string;
  token: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  viewedAt?: string;
  viewerInfo?: ViewerInfo[];   // IP, userAgent, timestamp de cada acesso
}

interface ShareLinkResponse {
  shareUrl: string;
  token: string;
  expiresAt: string;
}
```

A resposta pública do backend retorna a proposta/lançamento junto com dados do tenant (necessários para branding: logo, cor primária, nome).

## Chamadas de API

| Operação | Método | Service | Endpoint backend |
|----------|--------|---------|-----------------|
| Gerar link para proposta | `POST` | `SharedProposalService.generateShareLink` | `/v1/proposals/:id/share-link` |
| Buscar proposta pelo token | `GET` (público) | `SharedProposalService.getSharedProposal` | `/v1/share/:token` |
| Gerar link para lançamento | `POST` | `SharedTransactionService.generateShareLink` | `/v1/transactions/:id/share-link` |
| Buscar lançamento pelo token | `GET` (público) | `SharedTransactionService.getSharedTransaction` | `/v1/share/transaction/:token` |
| Download PDF proposta | `GET` (público) | `downloadSharedProposalPdf` | `/v1/share/:token/pdf` |
| Download PDF recibo | `GET` (público) | `downloadSharedTransactionPdf` | `/v1/share/transaction/:token/pdf` |

As chamadas públicas usam `callPublicApi` (sem token de autenticação no header), diferentemente do `callApi` padrão.

## Integração com outros módulos

- **Propostas** (`src/app/proposals/`) — gera o share link via `SharedProposalService.generateShareLink`
- **Lançamentos** (`src/app/transactions/`) — gera o share link via `SharedTransactionService.generateShareLink`
- **PDF backend** (`functions/src/api/routes/sharedProposals.ts`, `sharedTransactions.ts`) — rotas públicas que retornam dados e geram PDF via Playwright

## Padrões e gotchas

### Modo print (`?print=1`)
Quando o backend Playwright acessa a URL para gerar o PDF, adiciona `?print=1` na query string. Nesse modo a página renderiza apenas o conteúdo do `ProposalPdfViewer` em 794px fixo, sem cabeçalho, sem controles de zoom. O backend espera o sinal `data-pdf-transaction-ready="1"` (na página de transação) para saber que o conteúdo está pronto.

```tsx
if (isPrintMode) {
  return (
    <div className="bg-white w-[794px] m-0 p-0">
      <span data-pdf-transaction-ready="1" style={{ display: "none" }} />
      <TransactionPdfViewer ... />
    </div>
  );
}
```

### CSS print para Puppeteer
A página de proposta injeta CSS com `@media print` que oculta elementos `[data-pdf-ui]` (cabeçalho, controles de zoom). Não remova o atributo `data-pdf-ui` dos elementos de UI.

### Branding do tenant
O cabeçalho usa `tenant.primaryColor` para estilizar o botão de download via inline style. Se `primaryColor` for `null` ou `undefined`, cai no CSS variable `hsl(var(--primary))`.

### Zoom responsivo
Mobile: calcula escala automática `(window.innerWidth - 32) / 794` para caber o A4 na tela. ResizeObserver ajusta `marginBottom` para corrigir o espaço deixado pelo `transform: scale()`.

### Erros de token
O backend retorna HTTP 410 para links expirados e 404 para tokens inválidos. A página distingue as duas condições e exibe mensagens diferentes.

### `skipCatalogEnrichment`
A prop `skipCatalogEnrichment` é passada para `ProposalPdfViewer` — impede que a página tente buscar dados de catálogo do Firestore (sem autenticação, essa query falharia).

### Lançamentos com parcelas
`SharedTransactionService.getSharedTransaction` retorna também `relatedTransactions` — as demais parcelas do grupo, exibidas no `TransactionPdfViewer` para contexto do recibo.
