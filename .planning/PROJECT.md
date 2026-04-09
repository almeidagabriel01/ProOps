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

## Current Milestone: v1.0 — Testing Suite

**Goal:** Implementar suite completa de testes E2E, performance e segurança para garantir confiança nos fluxos críticos do SaaS multi-tenant.

**Target features:**

- Infraestrutura de testes com Playwright + Firebase Emulators + seed data realista
- E2E funcional: Auth multi-tenant, Proposals/CRM, Módulo financeiro, Stripe/billing
- Performance: Lighthouse CI com benchmarks de Core Web Vitals e API response times
- Security: OWASP ZAP + validação de isolamento multi-tenant + Firestore rules audit
- CI: GitHub Actions pipeline rodando testes em PRs + scripts locais npm

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

_Last updated: 2026-04-08 — Phase 05 complete: Stripe billing E2E coverage (BILL-01 through BILL-05 passing)_
