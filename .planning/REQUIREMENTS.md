# Requirements: ProOps Testing Suite

**Defined:** 2026-04-06
**Updated:** 2026-04-08 — v2.0 requirements added
**Core Value:** Propostas e gestão financeira funcionando com confiança — ciclo proposta → aprovação → cobrança não pode quebrar.

## v1.0 Requirements

### Infraestrutura de Testes

- [ ] **INFRA-01**: Dev consegue rodar `npm run test:e2e` localmente contra Firebase Emulators com um único comando
- [ ] **INFRA-02**: Dev consegue rodar `npm run test:performance` localmente para gerar relatório Lighthouse
- [ ] **INFRA-03**: Dev consegue rodar `npm run test:security` localmente para gerar relatório OWASP ZAP
- [ ] **INFRA-04**: Playwright está configurado com TypeScript, fixtures reutilizáveis e Page Object Model para páginas principais
- [ ] **INFRA-05**: Seed data factory popula Firebase Emulators com dados realistas (2 tenants, users com roles diferentes, proposals, transactions, wallets) de forma determinística
- [ ] **INFRA-06**: GitHub Actions executa E2E, performance e security automaticamente em cada PR
- [ ] **INFRA-07**: Pipeline CI gera e armazena relatórios de testes como artefatos downloadáveis

### Auth & Multi-Tenant

- [ ] **AUTH-01**: E2E valida que usuário consegue fazer login com email e senha via Firebase Auth
- [ ] **AUTH-02**: E2E valida que sessão persiste após refresh da página (cookie `__session`)
- [ ] **AUTH-03**: E2E valida que usuário consegue fazer logout limpando sessão
- [ ] **AUTH-04**: E2E valida que custom claims Firebase (`tenantId`, `role`, `masterId`) estão corretos após login
- [ ] **AUTH-05**: E2E valida que rotas protegidas redirecionam usuário não autenticado para login
- [ ] **AUTH-06**: E2E valida que Tenant A não consegue ler, criar nem modificar dados do Tenant B (isolamento crítico)

### Proposals / CRM

- [x] **PROP-01**: E2E valida que usuário consegue criar uma nova proposta com dados válidos
- [x] **PROP-02**: E2E valida que usuário consegue editar uma proposta existente
- [x] **PROP-03**: E2E valida que usuário consegue deletar uma proposta
- [x] **PROP-04**: E2E valida que proposta gera PDF corretamente via endpoint backend
- [x] **PROP-05**: E2E valida que link público de proposta é acessível sem autenticação
- [x] **PROP-06**: E2E valida que proposta muda de status (rascunho → enviada → aprovada/rejeitada)

### Módulo Financeiro

- [x] **FIN-01**: E2E valida que usuário consegue criar uma transação com dados válidos
- [x] **FIN-02**: E2E valida que usuário consegue editar uma transação existente
- [x] **FIN-03**: E2E valida que usuário consegue deletar uma transação
- [x] **FIN-04**: E2E valida que usuário consegue criar uma carteira e transferir saldo entre carteiras
- [x] **FIN-05**: E2E valida que saldo da carteira é atualizado corretamente após operações (atomic Firestore)
- [x] **FIN-06**: E2E valida que usuário consegue criar transação parcelada e baixar parcelas individualmente

### Stripe & Billing

- [x] **BILL-01**: E2E valida que tenant consegue assinar um plano e que features são desbloqueadas conforme o plano
- [x] **BILL-02**: E2E valida que webhook Stripe `subscription.created` atualiza status do tenant corretamente
- [x] **BILL-03**: E2E valida que webhook Stripe `subscription.cancelled` revoga acesso ao plano
- [x] **BILL-04**: E2E valida que tenant no plano free recebe bloqueio ao atingir limite de criação (ex: max proposals)
- [x] **BILL-05**: E2E valida que cron de overage WhatsApp calcula e registra cobrança correta para o mês

### Performance

- [ ] **PERF-01**: Lighthouse CI mede LCP ≤ 2.5s, FID ≤ 100ms, CLS ≤ 0.1 nas páginas críticas (dashboard, proposals, transactions)
- [ ] **PERF-02**: Pipeline CI falha se métricas Lighthouse degradarem além dos thresholds configurados
- [ ] **PERF-03**: Baseline de response time dos endpoints críticos está documentado e validado (proposals list, transactions list ≤ 500ms p95)

### Security

- [x] **SEC-01**: OWASP ZAP scan automatizado identifica e reporta vulnerabilidades da aplicação
- [x] **SEC-02**: Firestore rules tests validam que tenant isolation é aplicado em todas as coleções críticas
- [x] **SEC-03**: Firestore rules tests validam que usuário sem claims não acessa nenhuma coleção
- [x] **SEC-04**: Firestore rules tests validam que usuário de Tenant A não acessa documentos do Tenant B

## v2.0 Requirements

### Contacts & Products CRUD

- [ ] **CONT-01**: E2E valida que usuário consegue criar um novo contato com dados válidos
- [ ] **CONT-02**: E2E valida que usuário consegue editar um contato existente
- [ ] **CONT-03**: E2E valida que usuário consegue deletar um contato
- [ ] **PROD-01**: E2E valida que usuário consegue criar um novo produto com dados válidos
- [ ] **PROD-02**: E2E valida que usuário consegue editar um produto existente
- [ ] **PROD-03**: E2E valida que usuário consegue deletar um produto

### Auth Registration

- [ ] **REG-01**: E2E valida que um novo tenant consegue se registrar via formulário de signup
- [ ] **REG-02**: E2E valida que após registro o tenant recebe custom claims corretos (`tenantId`, `role`, `masterId`) no Firebase Auth
- [ ] **REG-03**: E2E valida que após registro o tenant consegue acessar o dashboard normalmente

### Financial Gaps

- [x] **FIN-07**: E2E valida CRUD completo de transações do tipo `expense` (diferente do income já coberto)
- [x] **FIN-08**: E2E valida pagamento seletivo de parcelas — pagar algumas parcelas de um grupo sem pagar todas
- [ ] **FIN-09**: E2E valida que aprovar uma proposta dispara `syncApprovedProposalTransactions` e cria as transações correspondentes no módulo financeiro com os valores e estrutura corretos

### Performance Expansion

- [ ] **PERF-04**: Lighthouse CI mede Core Web Vitals na página /contacts (LCP ≤ 2.5s, CLS ≤ 0.1)
- [ ] **PERF-05**: Lighthouse CI mede Core Web Vitals na página /products (LCP ≤ 2.5s, CLS ≤ 0.1)
- [ ] **PERF-06**: Baseline de response time para endpoints de contacts e products está documentado e validado (≤ 500ms p95)

## v3.0 Requirements

### Frontend Chat UI

- [x] **CHAT-01**: User can open the Lia panel from the floating trigger button (bottom-right)
- [x] **CHAT-02**: User can close the panel; it slides out with Tailwind animation
- [x] **CHAT-03**: User types a message and sees the response streamed token by token in real time
- [x] **CHAT-04**: User sees "Lia está digitando..." indicator during active streaming
- [x] **CHAT-05**: User sees tool execution results in compact, expandable LiaToolResultCards
- [x] **CHAT-06**: User is shown a confirmation dialog before Lia executes any delete action
- [x] **CHAT-07**: User sees usage badge (used/limit) in the panel header
- [x] **CHAT-08**: Free plan tenants cannot see or access the Lia panel
- [x] **CHAT-09**: Chat history persists across sessions for Pro/Enterprise tenants

### AI Billing & Security

- [x] **AIBI-01**: Free plan tenant is blocked with 403 before the stream starts
- [x] **AIBI-02**: Tenant with inactive subscription is blocked with 403 before stream starts
- [x] **AIBI-03**: Tenant at message limit receives 429 with `resetAt`; input is disabled in UI
- [x] **AIBI-04**: User can view AI usage section on the billing page (progress bar + reset date)
- [x] **AIBI-05**: User sees in-app warning when reaching 80% of their monthly message limit
- [x] **AIBI-06**: Firestore rules restrict `aiUsage` (read-only) and `aiConversations` (owner-only)

### AI Tests & QA

- [x] **AIQA-01**: E2E AI-01 to AI-03 validate plan-based access and usage badge display
- [x] **AIQA-02**: E2E AI-04 to AI-07 validate tool execution, module gating, and plan limit enforcement
- [x] **AIQA-03**: E2E AI-08 validates message limit blocks input and shows reset date
- [x] **AIQA-04**: E2E AI-10 to AI-12 validate cross-tenant isolation, role permissions, and delete confirmation
- [x] **AIQA-05**: Seed data creates `ai-test` pro tenant with admin + member users and all modules active
- [x] **AIQA-06**: Lia smoke test runs automatically in CI on every PR

## Backlog Requirements

### Testes de Integração WhatsApp

- **WA-01**: E2E do webhook WhatsApp processa mensagens recebidas corretamente
- **WA-02**: E2E valida envio de notificações WhatsApp em fluxos críticos

### Testes de Acessibilidade

- **A11Y-01**: Páginas principais passam em auditoria de acessibilidade WCAG 2.1 AA

### Monitoramento de Cobertura

- **COV-01**: Relatório de cobertura de código gerado e exibido no CI

## v4.0 Requirements

### Billing Foundation

- [ ] **BILL-06**: Sistema de billing usa escritor único e transacional — todos os caminhos de escrita (webhooks, controller, cron) chamam uma única função que escreve ambas as formas de dados (top-level fields + nested `subscription.*`) atomicamente via `db.runTransaction()`
- [ ] **BILL-07**: Cache de estado de assinatura usa LRU com limite de 500 entradas e TTL de 30s, substituindo o Map global ilimitado atual
- [x] **BILL-08**: Todos os eventos Stripe processados com idempotência via `stripe_events/{eventId}` — replay duplicado retorna 200 sem reprocessar

### Subscription State UI

- [ ] **STATE-01**: Tenant em `past_due` vê banner vermelho persistente no topo do layout com CTA "Atualizar pagamento" que abre portal Stripe; não pode ser dispensado permanentemente
- [ ] **STATE-02**: Tenant com `cancelAtPeriodEnd: true` vê banner amarelo com data de cancelamento formatada e botão "Reativar assinatura"
- [ ] **STATE-03**: Tenant em `past_due` que clica "Cancelar assinatura" vê AlertDialog com aviso de cancelamento imediato; ao confirmar, controller chama `stripe.subscriptions.cancel()` (cancelamento imediato — acesso encerra agora). Tenant `active`/`trialing` mantém o fluxo at-period-end existente. O botão de cancelar permanece habilitado; não há bloqueio 409.
- [ ] **STATE-04**: Tenant com `cancelAtPeriodEnd: true` consegue reativar assinatura com 1 clique via endpoint `POST /api/stripe/subscription/reactivate`

### Addon State

- [ ] **ADDON-01**: Badge "Cancelando em X" some de addons cujo `currentPeriodEnd` já passou ou que estão incluídos no plano atual do tenant
- [ ] **ADDON-02**: Cron diário limpa automaticamente addons com `currentPeriodEnd` vencido, marcando `status: 'canceled', cancelAtPeriodEnd: false`

### Login Redirect

- [x] **LOGIN-01**: Após login bem-sucedido, usuário é sempre redirecionado para `/dashboard` (ou `/admin` se superadmin), independente de parâmetros `?redirect=` na URL

### MercadoPago Webhook

- [x] **MPWH-01**: Webhook MP registra todos os eventos recebidos com log estruturado (headers filtrados, action, resultado de validação HMAC, resultado do lookup de transação) visível no Cloud Logging
- [x] **MPWH-02**: Webhook MP processa pagamentos com idempotência via `webhookEvents/{eventId}` — duplicatas retornam 200 sem reprocessar
- [ ] **MPWH-03**: Webhook MP resolve a transação corretamente via fallback `external_reference` (chamada `GET /v1/payments/{id}`) quando busca direta por `mpPaymentId` não encontra resultado
- [ ] **MPWH-04**: Webhook MP persiste `mpFeeAmount`, `mpNetAmount`, `mpGrossAmount` na transação após pagamento confirmado pelo MP

### MP Fee Disclosure

- [ ] **MPFEE-01**: Admin configura taxas MP por método de pagamento nas configurações do tenant (PIX, débito, crédito à vista, crédito parcelado); taxas usadas para cálculo de preview
- [ ] **MPFEE-02**: Ao criar lançamento via Checkout Pro, usuário vê preview "Você receberá líquido R$ X (taxa MP estimada R$ Y, ~Z%)" antes de confirmar
- [ ] **MPFEE-03**: Detalhe da transação paga via MP exibe bloco Bruto/Taxa/Líquido com valores reais persistidos pelo webhook

## Out of Scope

| Feature                                 | Reason                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| Testes unitários de componentes React   | Foco em confiança E2E, não cobertura granular de UI             |
| Load testing / stress test              | Não é objetivo do v1.0 — baseline de performance sim, carga não |
| Testes de mobile nativo                 | App é web-only                                                  |
| Visual regression testing (screenshots) | Alta manutenção, baixo ROI para esta fase                       |
| AUTH-05: Redirect params preserved through auth bounce | Deprecado pelo LOGIN-01 (v4.0): login sempre vai para /dashboard; usuário perde o destino original após bounce de sessão expirada — comportamento aceito para eliminar redirect loops |
| MP fee em propostas                     | Mudança no pipeline de PDF, risco de regressão — defer v5+      |
| MP fee no dashboard (card agregado)     | Requer campos populados em dados reais — defer v4.x após deploy do MPWH-04 |
| Replay de webhook MP via admin UI       | Requer lógica de rollback não implementada — defer v5+          |

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| INFRA-01    | Phase 1 | Pending  |
| INFRA-02    | Phase 1 | Pending  |
| INFRA-03    | Phase 1 | Pending  |
| INFRA-04    | Phase 1 | Pending  |
| INFRA-05    | Phase 1 | Pending  |
| INFRA-06    | Phase 1 | Pending  |
| INFRA-07    | Phase 1 | Pending  |
| AUTH-01     | Phase 2 | Pending  |
| AUTH-02     | Phase 2 | Pending  |
| AUTH-03     | Phase 2 | Pending  |
| AUTH-04     | Phase 2 | Pending  |
| AUTH-05     | Phase 2 | Pending  |
| AUTH-06     | Phase 2 | Pending  |
| PROP-01     | Phase 3 | Complete |
| PROP-02     | Phase 3 | Complete |
| PROP-03     | Phase 3 | Complete |
| PROP-04     | Phase 3 | Complete |
| PROP-05     | Phase 3 | Complete |
| PROP-06     | Phase 3 | Complete |
| FIN-01      | Phase 4 | Complete |
| FIN-02      | Phase 4 | Complete |
| FIN-03      | Phase 4 | Complete |
| FIN-04      | Phase 4 | Complete |
| FIN-05      | Phase 4 | Complete |
| FIN-06      | Phase 4 | Complete |
| BILL-01     | Phase 5 | Complete |
| BILL-02     | Phase 5 | Complete |
| BILL-03     | Phase 5 | Complete |
| BILL-04     | Phase 5 | Complete |
| BILL-05     | Phase 5 | Complete |
| PERF-01     | Phase 6 | Pending  |
| PERF-02     | Phase 6 | Pending  |
| PERF-03     | Phase 6 | Pending  |
| SEC-01      | Phase 7  | Complete |
| SEC-02      | Phase 7  | Complete |
| SEC-03      | Phase 7  | Complete |
| SEC-04      | Phase 7  | Complete |
| CONT-01     | Phase 8  | Pending  |
| CONT-02     | Phase 8  | Pending  |
| CONT-03     | Phase 8  | Pending  |
| PROD-01     | Phase 8  | Pending  |
| PROD-02     | Phase 8  | Pending  |
| PROD-03     | Phase 8  | Pending  |
| REG-01      | Phase 9  | Pending  |
| REG-02      | Phase 9  | Pending  |
| REG-03      | Phase 9  | Pending  |
| FIN-07      | Phase 10 | Complete |
| FIN-08      | Phase 10 | Complete |
| FIN-09      | Phase 10 | Pending  |
| PERF-04     | Phase 11 | Pending  |
| PERF-05     | Phase 11 | Pending  |
| PERF-06     | Phase 11 | Pending  |

| CHAT-01     | Phase 15 | Complete |
| CHAT-02     | Phase 15 | Complete |
| CHAT-03     | Phase 15 | Complete |
| CHAT-04     | Phase 15 | Complete |
| CHAT-05     | Phase 15 | Complete |
| CHAT-06     | Phase 15 | Complete |
| CHAT-07     | Phase 15 | Complete |
| CHAT-08     | Phase 15 | Complete |
| CHAT-09     | Phase 15 | Complete |
| AIBI-01     | Phase 16 | Complete |
| AIBI-02     | Phase 16 | Complete |
| AIBI-03     | Phase 16 | Complete |
| AIBI-04     | Phase 16 | Complete |
| AIBI-05     | Phase 16 | Complete |
| AIBI-06     | Phase 16 | Complete |
| AIQA-01     | Phase 17 | Complete |
| AIQA-02     | Phase 17 | Complete |
| AIQA-03     | Phase 17 | Complete |
| AIQA-04     | Phase 17 | Complete |
| AIQA-05     | Phase 17 | Complete |
| AIQA-06     | Phase 17 | Complete |

| BILL-06  | Phase 19 | Pending  |
| BILL-07  | Phase 19 | Pending  |
| BILL-08  | Phase 19 | Complete |
| STATE-01 | Phase 20 | Pending  |
| STATE-02 | Phase 20 | Pending  |
| STATE-03 | Phase 20 | Pending  |
| STATE-04 | Phase 21 | Pending  |
| ADDON-01 | Phase 21 | Pending  |
| ADDON-02 | Phase 21 | Pending  |
| LOGIN-01 | Phase 22 | Complete |
| MPWH-01  | Phase 23 | Complete |
| MPWH-02  | Phase 23 | Complete |
| MPWH-03  | Phase 23 | Pending  |
| MPWH-04  | Phase 23 | Pending  |
| MPFEE-01 | Phase 24 | Pending  |
| MPFEE-02 | Phase 24 | Pending  |
| MPFEE-03 | Phase 24 | Pending  |

**Coverage:**

- v1.0 requirements: 34 total (all mapped)
- v2.0 requirements: 15 total (all mapped)
- v3.0 requirements: 21 total (all mapped)
- v4.0 requirements: 17 total (all mapped)
- Unmapped: 0 ✓

---

_Requirements defined: 2026-04-06_
_Last updated: 2026-05-07 — v4.0 requirements added (phases 19–24): BILL-06–08, STATE-01–04, ADDON-01–02, LOGIN-01, MPWH-01–04, MPFEE-01–03. AUTH-05 moved to Out of Scope (superseded by LOGIN-01)._
