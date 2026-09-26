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
| Aprovar proposta | `POST` (público) | `SharedProposalService.approve` | `/v1/share/:token/approve` |

As chamadas públicas usam `callPublicApi` (sem token de autenticação no header), diferentemente do `callApi` padrão.

## Integração com outros módulos

- **Propostas** (`src/app/proposals/`) — gera o share link via `SharedProposalService.generateShareLink`
- **Lançamentos** (`src/app/transactions/`) — gera o share link via `SharedTransactionService.generateShareLink`
- **PDF backend** (`functions/src/api/routes/sharedProposals.ts`, `sharedTransactions.ts`) — rotas públicas que retornam dados e geram PDF via Playwright

## Aceite online (2026-09-25, revisto em 2026-09-26)

O cliente final ACEITA a proposta pelo próprio link, com nome, CPF/CNPJ e
aceite. `POST /v1/share/:token/accept`
(`functions/.../proposal-online-approval.controller.ts`).

**Onde fica:** `[token]/_components/proposal-response-panel.tsx`, um painel em
fluxo normal ACIMA do documento e repetido no FIM dele (o do fim só aparece
quando há o que fazer). A primeira versão era uma barra fixa no rodapé e
cobria o PDF. Fora do PDF por `data-pdf-ui`.

**O aceite não aprova.** A primeira versão aprovava direto do link, com
lançamentos, Drive e cobrança do sinal. O dono do produto trocou por aceite +
confirmação: uma proposta aceita às vezes ainda precisa de ajuste, e desfazer
lançamento é justamente o que o ERP protege. Quem mexe no financeiro é sempre
alguém da equipe.

- **Capacidade `onlineApproval`** (Pro e Enterprise). O `GET /v1/share/:token`
  devolve `onlineApproval: { canApprove, approved, expired, awaitingConfirmation,
  acceptance }`. Sem a capacidade, vencida, em rascunho, já aprovada ou com
  aceite pendente, o formulário não aparece; com aceite pendente a barra diz
  "a empresa vai confirmar".
- **O aceite fica na proposta** (`clientAcceptance`: nome, documento, data, IP,
  navegador, `status` e `contentHash`), fora do hash do PDF. Aceites anteriores
  vão para `clientAcceptanceHistory`. O link público nunca devolve esses campos
  (allowlist de `sanitizeSharedProposalPayload`).
- **Estados:** `pending` → `confirmed` (a empresa aprovou) | `discarded` (a
  empresa descartou para ajustar, ou recusou a proposta) | `invalidated` (a
  proposta mudou depois do aceite). Aceite antigo sem `status` conta como
  confirmado. Depois de descartado ou anulado, o cliente aceita de novo pelo
  mesmo link.
- **Confirmar é aprovar pelo caminho de sempre** (`PUT /v1/proposals/:id` com a
  coluna aprovada, da lista, do quadro ou do formulário): lançamentos, Drive e
  convite de nota vêm dali, e o `updateProposal` marca o aceite como
  confirmado. Não existe endpoint de "confirmar".
- **Editar o que o cliente viu anula o aceite.** `proposalContentHash` usa os
  mesmos campos do PDF (`PDF_IRRELEVANT_PROPOSAL_FIELDS`), tratando vazio, nulo
  e ausente como iguais, porque o formulário reenvia todos os campos. Se a
  empresa edita e aprova no mesmo salvamento, a aprovação vale, mas o aceite
  fica `invalidated`: o cliente aceitou outra versão.
- **Ajustar:** `POST /v1/proposals/:id/acceptance/discard` (permissão de editar
  propostas).
- **No ERP:** selo "Aceite do cliente" na lista (abre
  `_components/client-acceptance-dialog.tsx` em `/proposals`), no card do CRM e
  um aviso na visualização. A notificação `proposal_accepted` leva a
  `/proposals?aceite=<id>`, que abre o diálogo.
- **Sem cobrança no aceite.** Depois que a empresa confirma, o GET devolve
  `payment: { label }` ("Pagar entrada" ou "Pagar parcela") quando há receita
  em aberto e a empresa recebe online (`onlinePayments` + Asaas ligado). O
  botão chama `POST /v1/share/:token/payment-link`, que reaproveita o link
  público do lançamento (`SharedTransactionService.createShareLink`, que já
  devolve o link existente). Entrada primeiro; senão a próxima parcela.
- **Solicitar mudanças** (`POST /v1/share/:token/request-changes`): o cliente
  diz o que não ficou como o combinado, com justificativa obrigatória (10 a
  2.000 caracteres; nome opcional). Grava `clientChangeRequest` (`open` |
  `resolved`, com `contentHash`; os anteriores em `clientChangeRequestHistory`)
  e notifica `proposal_changes_requested`, que leva a `/proposals?ajuste=<id>`.
  O pedido se resolve sozinho quando a empresa salva a proposta com conteúdo
  diferente, aprova ou recusa; ou pelo "Marcar como resolvido"
  (`POST /v1/proposals/:id/change-request/resolve`). Com o pedido aberto, o
  cliente ainda pode aceitar, mas não abre outro pedido.
- **Ao vivo no ERP:** `hooks/use-client-responses.ts` escuta, em tempo real,
  só as propostas com aceite pendente ou pedido aberto (duas consultas por
  igualdade). A lista, o quadro e a visualização leem dele, então o selo e o
  diálogo aparecem sem F5; antes de o listener responder, vale o dado da lista
  (`hasPendingAcceptance` / `hasOpenChangeRequest` em `lib/client-acceptance.ts`).

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
O cabeçalho usa `tenant.primaryColor` como fundo do botão de download via inline style, com o texto por `computePrimaryForeground(cor)` (nunca branco fixo: empresa de cor branca some). Se `primaryColor` for `null` ou `undefined`, cai em `var(--primary)` / `var(--primary-foreground)`. Texto ou borda na cor da marca direto sobre o fundo da página (boleto, PIX) passa por `useThemeAdjustedColor`. Guard: `src/__tests__/tenant-color-contrast.test.ts`.

### Zoom responsivo
Mobile: calcula escala automática `(window.innerWidth - 32) / 794` para caber o A4 na tela. ResizeObserver ajusta `marginBottom` para corrigir o espaço deixado pelo `transform: scale()`.

### Erros de token
O backend retorna HTTP 410 para links expirados e 404 para tokens inválidos. A página distingue as duas condições e exibe mensagens diferentes.

### `skipCatalogEnrichment`
A prop `skipCatalogEnrichment` é passada para `ProposalPdfViewer` — impede que a página tente buscar dados de catálogo do Firestore (sem autenticação, essa query falharia).

### Lançamentos com parcelas
`SharedTransactionService.getSharedTransaction` retorna também `relatedTransactions` — as demais parcelas do grupo, exibidas no `TransactionPdfViewer` para contexto do recibo.
