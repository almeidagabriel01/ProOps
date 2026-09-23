# CLAUDE.md — src/app/admin/

## Propósito

A rota `/admin` é o painel de super-administrador da plataforma ProOps: empresas
(tenants), planos e módulos, acesso ao painel de cada empresa ("Acessar Painel"),
ciclo de vida (desativar, reativar, excluir), métricas, faturamento,
observabilidade e auditoria.

**Esta rota é exclusiva para usuários com `role === "superadmin"`.**

---

## Estrutura de arquivos

```
src/app/admin/
├── layout.tsx                       # AdminGuard + abas das seções (AdminSectionTabs)
├── page.tsx                         # Empresas (cards) — rota /admin
├── _components/
│   ├── admin-guard.tsx              # Bloqueia não-superadmin
│   ├── admin-section-tabs.tsx       # Abas do topo (lê lib/admin-sections.ts)
│   ├── admin-skeleton.tsx
│   ├── tenant-card.tsx              # Card da empresa: editar, módulos, copiar, MFA, ciclo de vida
│   └── copy-data-dialog.tsx         # Copiar catálogo entre empresas
├── _hooks/useTenantManagement.ts    # Estado da página /admin (lista, busca, save, ciclo de vida)
├── _utils/tenant-save-plan.ts       # O que salvar ao editar (função pura)
├── overview/                        # /admin/overview — métricas + tabela
├── analytics/                       # /admin/analytics — KPIs e gráficos
├── billing/                         # /admin/billing — faturamento
├── observability/                   # /admin/observability — erros agrupados
├── audit/                           # /admin/audit — eventos de security_audit_events (com a coluna Quem)
└── setup-mfa/                       # /admin/setup-mfa — MFA do superadmin

src/components/admin/
├── tenant-dialog.tsx                # Criar/editar empresa
└── tenant-modules-dialog.tsx        # "Plano e módulos" (substitui o antigo Editar Limites)

src/lib/admin-sections.ts            # Seções do painel: abas do topo, dock e tab bar
src/components/layout/impersonation-bar.tsx  # Faixa do "Acessar Painel"
```

---

## Controle de acesso

- `layout.tsx` usa `AdminGuard` (client): quem não é superadmin vai para `/403`.
- O backend valida `isSuperAdminClaim` em toda rota `/v1/admin/*`. O controle no
  front é só UX.
- Firestore rules: `isSuperAdmin()` exige MFA. Superadmin sem MFA vê listas vazias
  (permission-denied) nas leituras diretas do client.

---

## Rota `/admin` — Empresas

- **Busca global:** o hook carrega `GET /v1/admin/tenants/index` (id, nome, plano,
  situação; 1 leitura por empresa) e, ao digitar, busca as linhas de billing das
  empresas que casam (`GET /v1/admin/tenants/billing?tenantIds=...`, até 30). Antes
  a busca filtrava só os 25 da página carregada.
- **Paginação** por cursor quando não há busca.
- **Nova empresa / editar:** `TenantDialog`.
- **Plano e módulos:** `TenantModulesDialog`.
- **Copiar dados:** `CopyDataDialog`.
- **Ciclo de vida:** desativar, reativar, excluir definitivamente (ver abaixo).
- **Acessar Painel:** impersonação (ver abaixo).

### Editar empresa (`handleSave` + `buildTenantSavePlan`)

O save compara o formulário com o que foi carregado e manda **só o que mudou**:

1. `TenantService.updateTenant()` com os campos alterados da empresa.
2. `AdminService.updateUserPlan()` se o plano mudou (e recompute de features).
3. `AdminService.updateAdminCredentials()` se e-mail, senha ou telefone mudaram.
4. `AdminService.updateUserSubscription()` só para contrato manual, quando a data
   ou o plano mudaram.

**Empresa que paga pelo Stripe** (`billingManagedBy === "stripe"`): plano, status
e vencimento ficam travados no formulário, e o backend recusa com 409
`STRIPE_MANAGED_SUBSCRIPTION`. Antes todo save de plano pago mandava
`isManualSubscription: true`, e o cron de assinaturas manuais rebaixava para free
quem pagava pelo Stripe.

Contrato manual: a data de vencimento é o interruptor (o cron move para
`past_due` e depois `canceled` + free). Enterprise nasce com 12 meses.

### Criar empresa

`POST /v1/admin/tenants`. Plano pago exige data de vencimento e vira contrato
manual gravado pelo writer único (`syncTenantPlanBillingSnapshot`), então o doc do
tenant nasce com `plan`, `subscriptionStatus` e `isManualSubscription`. Conta free
nasce com role/claim `free` e cai no modo demonstração como uma conta do cadastro.

### Copiar dados

`POST /v1/admin/tenants/copy-data` com `{ sourceTenantId, targetTenantId, replace }`.
Copia produtos, serviços, ambientes e sistemas (reescrevendo as referências).
Recusa origem igual ao destino e empresa inexistente. Sem `replace` os itens
**se somam** ao destino; com `replace` o catálogo antigo do destino é apagado
**depois** da cópia. O seletor de destino usa o índice completo, não a página.

### Plano e módulos (`TenantModulesDialog`)

`GET /v1/admin/tenants/:id/modules` devolve tier, capacidades (e as que vêm só do
plano), limites e add-ons com a origem (`stripe` | `courtesy`). Rótulos vêm do
catálogo (`CAPABILITY_LABELS`, `LIMIT_LABELS` em `plan-capabilities.ts`).
`POST|DELETE /v1/admin/tenants/:id/addons/:addonId` concede ou retira **cortesia**,
gravada no mesmo doc da compra (`addons/{tenantId}_{addonId}`, `source: "courtesy"`,
sem `stripeSubscriptionId`, então o `reconcileAddons` não a cancela). Add-on pago
não é alterado por aqui. Não existe override de limite por empresa, de propósito.

### Ciclo de vida da empresa

| Ação | Endpoint | Efeito |
|---|---|---|
| Desativar | `POST /v1/admin/tenants/:id/deactivate` | Cancela assinatura e add-ons no Stripe, desativa o Auth de todos os usuários e revoga os tokens, `accountStatus: "deactivated"`. Nada é apagado. |
| Reativar | `POST /v1/admin/tenants/:id/reactivate` | Reabilita os usuários. A assinatura cancelada não volta sozinha. |
| Excluir definitivamente | `POST /v1/admin/tenants/:id/purge` | Só empresa desativada, com o nome digitado. Cria `tenant_purge_jobs/{id}`; o trigger `onTenantPurgeJob` apaga em etapas. |

O que a exclusão apaga e o que preserva está em
`apps/functions/src/shared/tenant-collections.ts` (guard contra as rules). Notas
fiscais e `tenants/{id}/fiscal/` no Storage ficam pela guarda legal de 5 anos; o
doc residual do tenant fica com `accountStatus: "purged"` e `fiscalRetainUntil`,
e o writer único não reescreve empresa excluída (sem tenant "zumbi").

---

## "Acessar Painel" (impersonação)

`handleLoginAs` → `setViewingTenant(tenant)` → `/dashboard`. Bloqueado para conta
free (`canAccessTenantPanel`) e para empresa desativada.

- O front guarda a empresa em `sessionStorage` e manda `x-tenant-id` em toda
  chamada (`buildImpersonationHeaders` em `lib/viewing-tenant-session.ts`, usado
  pelo api-client, pela Lia e repassado pelo proxy).
- O backend (`api/middleware/impersonation.ts`) troca `req.user.tenantId` pela
  empresa vista e `masterId` pelo dono dela. **Todos** os módulos passam a agir
  na empresa vista, inclusive aux, planilhas, CRM, numeração, fiscal, Asaas e Lia.
- **Abre em somente leitura.** Escrita exige "Habilitar edição" na faixa do topo
  (`ImpersonationBar`), que manda `x-impersonation-write: 1`. Sem ele o backend
  responde 403 `IMPERSONATION_READ_ONLY` e a Lia recusa ferramentas que escrevem.
  `isReadOnly` do `TenantProvider` também fica true, e as telas escondem as ações.
  A edição vale só para aquela empresa e volta a leitura ao trocar ou sair.
- **Vê como o cliente:** o `PlanProvider` usa o plano (`tenant.plan`) e os
  add-ons da empresa vista, e o `requirePlanCapability` avalia o plano dela em
  modo `enforce`. Limites numéricos continuam com o bypass de superadmin.
- **Auditoria:** entrada (`super_admin_impersonation_started`), cada escrita
  (`super_admin_tenant_write`) e saída (`super_admin_impersonation_stopped`,
  inclusive a implícita ao entrar em `/admin`).
- Sair: botão "Sair" da faixa, ou abrir qualquer rota `/admin`.

---

## Auditoria (`/admin/audit`)

Mostra `security_audit_events`, que junta duas coisas: o que o super admin fez
em cada empresa e o que o backend recusou para os usuarios delas (conta
gratuita barrada, plano insuficiente, limite, rate limit, CORS, login). As duas
carregam o mesmo `tenantId`, entao a tela resolve **quem agiu**: o backend
(`withActors` em `admin.controller.ts`) busca `users/{uid}` dos eventos da
pagina e devolve nome, e-mail e papel, e a linha ganha selo quando o papel e
`superadmin`. Sem isso nao havia como separar "eu entrei pelo Acessar Painel"
de "o cliente tentou".

Os rotulos dos eventos e dos motivos vivem em `EVENT_LABELS` e `REASON_LABELS`
na propria pagina. Evento sem rotulo aparece cru (foi assim que
`BILLING_SUBSCRIPTION_BLOCK` / `FREE_TIER_FORBIDDEN_ROUTE` apareceu em
producao): ao criar um `eventType` novo, acrescente o rotulo ali.

## Última vez online

`tenants/{id}.lastSeenAt`. Responde "a conta que nao assinou voltou?" e "o
assinante ainda usa?", que os contadores de proposta e lancamento nao respondem.

**E por EVENTO, nao por tempo.** O frontend (`hooks/use-session-ping.ts`) chama
`POST /v1/session/ping` quando a plataforma abre autenticada (login, aba ou
janela nova: uma vez por aba por usuario, marca em `sessionStorage`) e quando a
pessoa volta para a aba, se o ultimo aviso daquela aba tem 5 minutos ou mais. A
hora gravada e a daquele instante, e a tela mostra **dia e horario exatos**
(`formatLastSeenExact`, sempre no fuso de Brasilia) com o tempo relativo abaixo.

Houve uma versao intermediaria que avisava uma vez por DIA por navegador: quem
entrava as 9h e voltava as 14h ficava registrado as 9h, o que so parecia certo
enquanto a tela arredondava para "ha menos de 1 hora". Limite que sobrou: quem
passa horas na mesma aba sem nunca sair dela aparece com a hora em que entrou.

A primeira versao gravava em TODA request autenticada, com janela de 15 min: era
barata, mas subestimava o ultimo acesso por construcao e punha escrita no caminho
de toda request. O unico tempo que sobrou e antirrepeticao de 1 min no backend
(`lib/tenant-last-seen.ts`), contra laco de recarga.

- **Super admin nao conta.** Abrir o painel de uma empresa marcaria como acesso
  dela algo que foi seu, justamente nas empresas sob investigacao.
- A gravacao **nunca cria** o doc do tenant (`update` + NOT_FOUND ignorado):
  criar ressuscitaria empresa excluida e mudaria a resolucao de plano de tenant
  legado, que vive em `companies`.
- `/v1/session/ping` esta em `FREE_TIER_ALLOWED_PREFIXES`: sem isso a conta
  gratuita levaria 402 e o caso que originou o pedido nunca seria registrado.
- Aparece no card e na tabela da Visao geral, destacado acima de 30 dias.

## Custo

- A lista de empresas **não** dispara sync com o Stripe (o cron diário
  `checkStripeSubscriptions` e o botão de sincronizar cobrem isso).
- Overview, analytics e billing ainda percorrem todas as páginas de billing
  (5 leituras por empresa). Com poucas empresas é barato; revisar se crescer.

---

## Services usados no módulo admin (`AdminService`)

| Método | Endpoint |
|---|---|
| `getTenantsBillingPage` / `getAllTenantsBilling` | `GET /v1/admin/tenants/billing` |
| `getTenantsBillingByIds` | `GET /v1/admin/tenants/billing?tenantIds=` |
| `getTenantsIndex` | `GET /v1/admin/tenants/index` |
| `createTenant` | `POST /v1/admin/tenants` |
| `deactivateTenant` / `reactivateTenant` / `purgeTenant` | `POST /v1/admin/tenants/:id/{deactivate,reactivate,purge}` |
| `copyTenantData` | `POST /v1/admin/tenants/copy-data` |
| `getTenantModules` | `GET /v1/admin/tenants/:id/modules` |
| `grantCourtesyAddon` / `revokeCourtesyAddon` | `POST/DELETE /v1/admin/tenants/:id/addons/:addonId` |
| `updateUserPlan` | `PUT /v1/admin/users/:id/plan` |
| `updateUserSubscription` | `PUT /v1/admin/users/:id/subscription` |
| `updateAdminCredentials` | `POST /v1/admin/credentials` |
| `startImpersonation` / `stopImpersonation` | `POST /v1/admin/impersonation/{start,stop}` |
| `getAuditEvents` | `GET /v1/admin/audit-events` |

Toda mutação do superadmin grava um evento em `security_audit_events`, com
`await` (no Cloud Run, write sem await se perde).

---

## Padrão para novos componentes admin

- Não verificar role no componente: o layout já garante superadmin.
- Chamadas via `AdminService`.
- Operação destrutiva sempre com `AlertDialog` explicando o efeito.
- Página nova do painel entra em `ADMIN_SECTIONS` (`lib/admin-sections.ts`).
