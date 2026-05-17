# ProOps

## What This Is

ProOps é uma plataforma SaaS multi-tenant de gestão empresarial voltada para pequenas e médias empresas brasileiras. Oferece gestão de propostas comerciais, CRM, módulo financeiro (transações, carteiras, parcelas), gestão de equipes, e integrações com Stripe, WhatsApp e Google Calendar. O sistema suporta múltiplos nichos de negócio (automação residencial, cortinas) com lógica específica por niche.

## Core Value

Propostas e gestão financeira funcionando com confiança — se tudo mais falhar, o ciclo proposta → aprovação → cobrança não pode quebrar.

## Requirements

### Validated

- FIN-01: Transaction creation E2E — Validated in Phase 04: financial-module-e2e
- FIN-02: Transaction edit E2E — Validated in Phase 04: financial-module-e2e
- FIN-03: Transaction delete E2E — Validated in Phase 04: financial-module-e2e
- FIN-04: Wallet creation + balance transfer E2E — Validated in Phase 04: financial-module-e2e
- FIN-05: Wallet balance atomicity verification E2E — Validated in Phase 04: financial-module-e2e
- FIN-06: Installment group E2E (API create + UI mark-as-paid) — Validated in Phase 04: financial-module-e2e
- BILL-01: Active subscription allows proposal creation E2E — Validated in Phase 05: stripe-billing-e2e
- BILL-02: Expired subscription blocks proposal creation E2E — Validated in Phase 05: stripe-billing-e2e
- BILL-03: Stripe webhook subscription state transition E2E — Validated in Phase 05: stripe-billing-e2e
- BILL-04: Plan limit enforcement (402 + error body) E2E — Validated in Phase 05: stripe-billing-e2e
- BILL-05: WhatsApp overage cron E2E — Validated in Phase 05: stripe-billing-e2e
- AIBI-01: Free tier 403 at AI chat endpoint — Validated in Phase 16: lia-seguranca-billing
- AIBI-02: Inactive subscription 403 at AI chat endpoint — Validated in Phase 16: lia-seguranca-billing
- AIBI-03: Monthly limit 429 + UI input disabled — Validated in Phase 16: lia-seguranca-billing
- LOGIN-01: Post-login redirect ignores ?redirect= param, superadmin routes to /admin, session-expired toast — Validated in Phase 22: login-redirect-hardening
- AIBI-04: AI usage card on billing/subscription page — Validated in Phase 16: lia-seguranca-billing
- AIBI-05: Near-limit warning banner in Lia panel — Validated in Phase 16: lia-seguranca-billing
- AIBI-06: Firestore deny-write rules for aiUsage + aiConversations — Validated in Phase 16: lia-seguranca-billing
- BILL-06: All billing-state writes route through single transactional writer (syncTenantPlanBillingSnapshot) — Validated in Phase 19: single-writer-billing-foundation
- BILL-07: LRU cache bounds enforced (max 500, ttl 30s) — Validated in Phase 19: single-writer-billing-foundation
- BILL-08: Stripe webhook idempotency — duplicate events return 200 without re-executing business logic — Validated in Phase 19: single-writer-billing-foundation

- AUTH-01: Login flow E2E — Validated in Phase 02: auth-multitenant
- AUTH-02: Session expiration redirect E2E — Validated in Phase 02: auth-multitenant
- AUTH-03: Route guard protection E2E — Validated in Phase 02: auth-multitenant
- AUTH-04: Tenant isolation frontend E2E — Validated in Phase 02: auth-multitenant
- AUTH-05: Redirect params preserved through auth bounce — Validated in Phase 02: auth-multitenant
- AUTH-06: Backend API tenant isolation assertion (403/404 only) — Validated in Phase 02: auth-multitenant

### Active

_(Definidos no Milestone v1.0 — veja REQUIREMENTS.md)_

### Out of Scope

- Testes unitários de componentes isolados — foco em confiança E2E, não cobertura granular
- Testes de load massivo — performance foco em Core Web Vitals e API baseline, não stress test

## Context

**Codebase existente (brownfield):**

- Next.js 16 App Router no frontend (Vercel), Firebase Cloud Functions V2 no backend (Cloud Run, southamerica-east1)
- ~25 route segments no frontend, 13 grupos de rotas no backend, ~20 controllers
- Firestore como banco principal com DENY-by-default security rules
- Multi-tenant com custom claims Firebase: `tenantId`, `role`, `masterId`
- Zero testes atualmente — primeiro milestone é inteiramente infraestrutura + testes

**Integrações críticas:**

- Stripe: webhooks com signature verification, gestão de planos e overage billing WhatsApp
- WhatsApp: webhooks + cron de overage billing (1º de cada mês)
- PDF: geração server-side via Playwright/Chromium headless
- Google Calendar: via googleapis

**Ambiente de testes definido:**

- Firebase Emulators (Auth:9099, Firestore:8080, Functions:5001) como base
- Cenários realistas com seed data completo simulando fluxos reais de negócio
- Playwright para E2E, Lighthouse CI para performance, OWASP ZAP para segurança

## Constraints

- **Tech Stack**: Next.js 16 + Firebase — testes E2E devem usar Playwright (não Cypress) para compatibilidade com App Router
- **Ambiente**: Firebase Emulators para isolamento — testes não podem depender de dados reais do ambiente dev
- **CI**: GitHub Actions — pipeline deve rodar em tempo razoável (<15 min para E2E full suite)
- **Multi-tenant**: Toda validação de segurança DEVE cobrir isolamento entre tenants — risco crítico de vazamento de dados

## Key Decisions

| Decision                                   | Rationale                                                                          | Outcome   |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | --------- |
| Playwright como framework E2E              | Melhor suporte para Next.js App Router, TypeScript nativo, network mocking robusto | — Pending |
| Firebase Emulators como ambiente de testes | Isolamento determinístico, sem custos, testes reproduzíveis                        | — Pending |
| OWASP ZAP para security scanning           | Padrão da indústria, suporte a autenticação, integração CI                         | — Pending |
| Lighthouse CI para performance             | Integrado ao GitHub Actions, métricas Core Web Vitals, thresholds configuráveis    | — Pending |

## Milestone History

### v1.0 — Testing Suite (Complete)

**Goal:** Implementar suite completa de testes E2E, performance e segurança para garantir confiança nos fluxos críticos do SaaS multi-tenant.

**Delivered:**

- Infraestrutura de testes com Playwright + Firebase Emulators + seed data realista
- E2E funcional: Auth multi-tenant, Proposals/CRM, Módulo financeiro, Stripe/billing
- Performance: Lighthouse CI com benchmarks de Core Web Vitals e API response times
- Security: OWASP ZAP + validação de isolamento multi-tenant + Firestore rules audit
- CI: GitHub Actions pipeline rodando testes em PRs + scripts locais npm

## Milestone History (cont.)

### v3.0 — AI Assistant (Complete)

**Goal:** Implementar a Lia (assistente IA) completa: backend SSE + Gemini, tool system com 29 ações, chat UI com streaming e confirmação, segurança & billing (ai-auth middleware, AI_LIMITS, Firestore rules), e E2E suite AI-01 a AI-12.

## Current Milestone: v4.0 — Billing & Payment Hardening

**Goal:** Corrigir 7 falhas críticas de billing, Stripe e MercadoPago que causam estados inconsistentes, perda de acesso e pagamentos não processados em produção.

**Target features:**

- Addon fantasma cleanup (P1) — badge stale eliminado, cron de limpeza diário, script one-shot
- Stripe cancel/past_due hardening (P2) — escritor único de billing, race condition, cache LRU, idempotência de webhook
- Login sempre → /dashboard (P3) — remover consumo de ?redirect= no auth
- Banners de estado (P4) — banner past_due (vermelho) e cancelAtPeriodEnd (amarelo) com CTAs
- Bloquear cancelamento durante past_due (P5) — 409 no controller, UI desabilitada
- MP webhook instrumentação e fix (P6) — logs estruturados, auditoria, fix por hipótese confirmada
- Disclosure de taxa MP (P7) — preview em lançamentos, propostas, settings com tabela de %, detalhe/lista/dashboard

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-05-11 — Phase 22 complete: Login Redirect Hardening (LOGIN-01 validated — open-redirect surface closed, redirect= param stripped, session-expired toast, E2E spec rewritten)._
