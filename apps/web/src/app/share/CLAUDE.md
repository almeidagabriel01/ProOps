# CLAUDE.md — src/app/share/

## Propósito e contexto de negócio

Rotas públicas de visualização de documentos compartilhados via link. Permite que clientes externos (sem conta no sistema) acessem propostas comerciais e recibos/lançamentos financeiros gerados pelo tenant.

O fluxo é: o usuário autenticado gera um link de compartilhamento dentro do sistema, recebe uma URL com token de acesso temporário, e envia esse link para o cliente final.

## Quem pode acessar

Rotas completamente públicas — sem autenticação, sem Firebase Auth, sem middleware de proteção. O único controle de acesso é o token na URL, que expira no backend.

O proxy do Next.js (`src/proxy.ts`) deve ter estas rotas explicitamente excluídas da proteção de sessão.

## Estrutura de rotas

```
share/
├── [token]/page.tsx              # Proposta compartilhada
├── transaction/[token]/page.tsx  # Lançamento financeiro compartilhado
├── project/[token]/page.tsx      # Entrega da obra (projeto de instalação): conferir, ver a data das visitas e aceitar
├── os/[token]/page.tsx           # Comprovante da ordem de serviço (peças, fotos, assinatura); é o que o PDF da OS imprime
├── pmoc/[token]/page.tsx         # PMOC do prédio: plano e relatório de execução por período; é o que os PDFs do PMOC imprimem
├── visita/[token]/page.tsx       # Link de agendamento: escolher horário e pedir a visita
├── portal/[token]/page.tsx       # Portal do cliente: propostas, pagamentos, obra e notas de um contato
└── contador/[token]/page.tsx     # Link do contador: DRE, lançamentos e notas da empresa, só leitura
```

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `share/[token]/page.tsx` | Exibe proposta em formato PDF via `ProposalPdfViewer`. Modo `?print=1` para captura Playwright. |
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
| Aceitar proposta | `POST` (público) | `SharedProposalService.accept` | `/v1/share/:token/accept` |
| Pedir mudanças | `POST` (público) | `SharedProposalService.requestChanges` | `/v1/share/:token/request-changes` |
| Link de pagamento da proposta aprovada | `POST` (público) | `SharedProposalService.paymentLink` | `/v1/share/:token/payment-link` |
| Buscar a entrega da obra | `GET` (público) | `SharedProjectService.get` | `/v1/share/project/:token` |
| Aceitar a entrega da obra | `POST` (público) | `SharedProjectService.accept` | `/v1/share/project/:token/accept` |
| Horários livres do link de agendamento | `GET` (público) | `BookingService.publicView` | `/v1/public/booking/:token` |
| Pedir a visita | `POST` (público) | `BookingService.submit` | `/v1/public/booking/:token` |
| Abrir o PMOC (plano e relatório) | `GET` (público) | `PmocService.view` | `/v1/share/pmoc/:token?from=&to=` |
| Abrir o portal do cliente | `GET` (público) | `ClientPortalService.publicView` | `/v1/share/portal/:token` |
| Abrir um item do portal | `POST` (público) | `ClientPortalService.openItem` | `/v1/share/portal/:token/open` |

As chamadas públicas usam `callPublicApi` (sem token de autenticação no header), diferentemente do `callApi` padrão.

## Integração com outros módulos

- **Propostas** (`src/app/proposals/`) — gera o share link via `SharedProposalService.generateShareLink`
- **Lançamentos** (`src/app/transactions/`) — gera o share link via `SharedTransactionService.generateShareLink`
- **PDF backend** (`functions/src/api/routes/shared-proposals.routes.ts`, `shared-transactions.routes.ts`) — rotas públicas que retornam dados e geram PDF via Playwright

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
- **Histórico dos pedidos para o cliente:** o estado do link traz
  `changeRequests` (o atual e os de `clientChangeRequestHistory`, do mais novo
  ao mais antigo, montados por `publicChangeRequestHistory`), só com nome,
  mensagem, data e status (`open` | `resolved`, com a data da resolução); IP,
  navegador e quem resolveu nunca saem. Com pelo menos um pedido, o painel mostra
  "Histórico de solicitações (N)", que abre o modal com cada pedido e o selo "Em
  análise" ou "Resolvida", e o painel do topo aparece mesmo sem outra ação. Um
  pedido recém-enviado entra no topo da lista sem recarregar. O campo é opcional
  no tipo do front: com backend antigo o botão só não aparece.
- **Ao vivo no ERP:** `hooks/use-client-responses.ts` escuta, em tempo real,
  só as propostas com aceite pendente ou pedido aberto (duas consultas por
  igualdade). A lista, o quadro e a visualização leem dele, então o selo e o
  diálogo aparecem sem F5; antes de o listener responder, vale o dado da lista
  (`hasPendingAcceptance` / `hasOpenChangeRequest` em `lib/client-acceptance.ts`).

## Link de agendamento (`visita/[token]`)

O cliente escolhe o tipo de visita, o dia e o horário livre, e deixa nome,
telefone e, se quiser, e-mail, endereço e observação. **O pedido não marca a
visita**: ele entra na Agenda como "a confirmar" e a empresa responde (regra no
`apps/functions/CLAUDE.md`, seção Link de agendamento). A tela diz isso antes e
depois de enviar.

- Mora sob `/share` e não em `/visita` de propósito: herda a árvore sem
  sessão do `providers.tsx`, o `noindex` e a exceção do redirect do apex, que
  uma rota nova precisaria repetir em quatro lugares.
- **Dois passos num cartão só**: "Dia e horário" (calendário do mês, em grade
  de domingo a sábado, e os horários do dia separados em Manhã, Tarde e Noite)
  e "Seus dados" (o formulário, com "Trocar horário" que volta sem perder o que
  foi digitado). A coluna da esquerda tem a empresa, o tipo de visita com a
  duração, a escolha feita e o "Como funciona" (só a partir de `lg`). O
  calendário substituiu uma faixa de dias com rolagem lateral.
- Só dia com horário livre é botão; os outros ficam apagados e fora do
  teclado. As setas de mês param no primeiro e no último mês com horário. As
  exceções da empresa chegam aqui só como horário que falta: a visão pública
  não as devolve.
- Um 409 (alguém pegou o horário no meio do caminho) volta para o calendário,
  recarrega os horários e pede outro.
- **Cor da empresa em variáveis CSS** no contêiner: `--brand` e `--brand-fg`
  para o que é preenchido, e `--brand-line` (`useThemeAdjustedColor`) para
  borda, anel e os tons feitos com `color-mix`. Uma empresa de cor branca ou
  preta continua com o dia e o horário escolhidos visíveis nos dois temas.
- Captcha pelo `lib/captcha.ts` (interativo) e um campo isca `website`, fora da
  árvore acessível, que o backend usa para responder "ok" a robô sem gravar.
- O botão de envio usa `brandButtonStyle`, como os outros daqui.

Guards: `visita/[token]/_components/__tests__/public-booking.test.tsx` e
`src/__tests__/booking-link-path.test.ts` (o link da configuração e o do e-mail
caem nesta rota).

## Portal do cliente (`portal/[token]`)

Uma página por contato, com um link fixo que a empresa manda uma vez (Pro e
Enterprise, `clientPortal`). Regra do backend em `apps/functions/CLAUDE.md`,
seção Portal do cliente.

- **O portal não substitui as páginas daqui, ele aponta para elas.** Cada item
  chama `POST .../open`, que devolve o link da proposta, do lançamento ou da
  obra (criado só nesse clique), e a página navega para lá. Aceitar, pagar e
  confirmar a entrega continuam onde já estavam.
- **A obra mostra a próxima visita marcada** (`nextVisit`: etapa não concluída,
  a data mais próxima que ainda não passou), sem o id do evento da Agenda.
- **Nota fiscal abre direto no PDF do Focus**, que dispensa login; não existe
  página nossa para ela.
- **`/share/portal/exemplo` é o portal fictício da demonstração**
  (`lib/client-portal/example.ts`): dado fixo, sem API, e os itens não abrem.
  A conta free chega nele pelo botão do contato, que não cria link.
- A empresa gera, troca e desliga o link na ficha do contato
  (`components/features/client-portal/client-portal-button.tsx`, ao lado das
  abas), só com a edição de Contatos. "Gerar novo link" derruba o anterior na
  hora: é o que se faz quando o link foi parar com quem não devia.

Guards: `portal/[token]/_components/__tests__/public-client-portal.test.tsx` e
`components/features/client-portal/__tests__/client-portal-button.test.tsx`.

## Link do contador (`contador/[token]`)

O financeiro da empresa em leitura para o contador, sem login e sem contar
como usuário: DRE (caixa e competência), lançamentos, notas emitidas e notas
de entrada, cada aba com exportação em Excel e CSV. O contador escolhe o
período (os prontos do DRE ou um mês específico dos últimos 12); abre no mês
passado, que é o que ele costuma fechar. Regra do backend no
`apps/functions/CLAUDE.md`, seção Link do contador.

- As abas de nota seguem o plano da empresa (`sections` do backend).
- PDF e XML das notas são links para `.../documents/...?kind=`, com o tipo na
  query, nunca no fim do caminho: o proxy manda caminho terminado em `/pdf`
  para a função de PDF.
- O link é gerado no botão "Link do contador" da tela do DRE
  (`app/dre/_components/accountant-link-button.tsx`), só por dono e
  administradores. `/share/contador/exemplo` é a versão fictícia da
  demonstração (`lib/accountant/example.ts`), sem API e sem link de arquivo.

Guards: `contador/[token]/_components/__tests__/public-accountant.test.tsx` e
`app/dre/__tests__/accountant-link-button.test.tsx`.

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

### CSS print para Playwright
A página de proposta injeta CSS com `@media print` que oculta elementos `[data-pdf-ui]` (cabeçalho, controles de zoom). Não remova o atributo `data-pdf-ui` dos elementos de UI.

### Branding do tenant
Todo botão pintado com a cor da empresa (baixar PDF no cabeçalho, aceitar, pagar, e o "Pagar" das parcelas dentro do `TransactionPdfViewer`) usa `brandButtonStyle(cor)` (`utils/color-utils.ts`): texto por `computePrimaryForeground`, nunca branco fixo, e borda cinza quando a cor é quase branca, senão o botão some no papel branco. Foi assim que o "Pagar" do recibo sumiu para uma empresa de cor branca. Sem cor, cai em `var(--primary)` / `var(--primary-foreground)`. Texto ou borda na cor da marca direto sobre o fundo da página (boleto, PIX) passa por `useThemeAdjustedColor`. Guard: `src/__tests__/tenant-color-contrast.test.ts`.

### Zoom responsivo
Mobile: calcula escala automática `(window.innerWidth - 32) / 794` para caber o A4 na tela. ResizeObserver ajusta `marginBottom` para corrigir o espaço deixado pelo `transform: scale()`.

### Erros de token
O backend retorna HTTP 410 para links expirados e 404 para tokens inválidos. A página distingue as duas condições e exibe mensagens diferentes.

### `skipCatalogEnrichment`
A prop `skipCatalogEnrichment` é passada para `ProposalPdfViewer` — impede que a página tente buscar dados de catálogo do Firestore (sem autenticação, essa query falharia).

### Lançamentos com parcelas
`SharedTransactionService.getSharedTransaction` retorna também `relatedTransactions` — as demais parcelas do grupo, exibidas no `TransactionPdfViewer` para contexto do recibo.
