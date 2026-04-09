# Requirements: ProOps Testing Suite

**Defined:** 2026-04-06
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

## v2 Requirements

### Testes de Integração WhatsApp

- **WA-01**: E2E do webhook WhatsApp processa mensagens recebidas corretamente
- **WA-02**: E2E valida envio de notificações WhatsApp em fluxos críticos

### Testes de Acessibilidade

- **A11Y-01**: Páginas principais passam em auditoria de acessibilidade WCAG 2.1 AA

### Monitoramento de Cobertura

- **COV-01**: Relatório de cobertura de código gerado e exibido no CI

## Out of Scope

| Feature                                 | Reason                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| Testes unitários de componentes React   | Foco em confiança E2E, não cobertura granular de UI             |
| Load testing / stress test              | Não é objetivo do v1.0 — baseline de performance sim, carga não |
| Testes de mobile nativo                 | App é web-only                                                  |
| Visual regression testing (screenshots) | Alta manutenção, baixo ROI para esta fase                       |

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
| SEC-01      | Phase 7 | Complete |
| SEC-02      | Phase 7 | Complete |
| SEC-03      | Phase 7 | Complete |
| SEC-04      | Phase 7 | Complete |

**Coverage:**

- v1.0 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---

_Requirements defined: 2026-04-06_
_Last updated: 2026-04-06 — traceability filled after roadmap creation_
