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
├── layout.tsx                       # AdminGuard (a navegação entre seções é a dock)
├── page.tsx                         # Empresas (cards) — rota /admin
├── _components/
│   ├── admin-guard.tsx              # Bloqueia não-superadmin
│   ├── admin-skeleton.tsx
│   ├── tenant-card.tsx              # Card da empresa: editar, módulos, copiar, MFA, ciclo de vida, membros
│   └── copy-data-dialog.tsx         # Copiar catálogo entre empresas
├── _hooks/useTenantManagement.ts    # Estado da página /admin (lista, busca, save, ciclo de vida)
├── _utils/tenant-save-plan.ts       # O que salvar ao editar (função pura)
├── overview/                        # /admin/overview — métricas + tabela
├── analytics/                       # /admin/analytics — KPIs e gráficos
├── billing/                         # /admin/billing — faturamento
├── observability/                   # /admin/observability — erros agrupados
├── online/                          # /admin/online — quem está online agora e quem passou hoje
├── activity/                        # /admin/activity — atividade das empresas (telas, ações, jornada, erros)
├── audit/                           # /admin/audit — eventos de security_audit_events (com a coluna Quem)
└── setup-mfa/                       # /admin/setup-mfa — MFA do superadmin

src/components/admin/
├── tenant-dialog.tsx                # Criar/editar empresa
├── tenant-modules-dialog.tsx        # "Plano e módulos" (substitui o antigo Editar Limites)
├── tenant-members-dialog.tsx        # Membros da empresa, com o "Ver como membro"
├── activity/                        # Linha do tempo da atividade: formato, jornada, painel lateral
└── presence/                        # Bolinha e texto de presença (online, ausente, saiu)

src/lib/admin-sections.ts            # Seções do painel: fonte da dock e da tab bar do superadmin
src/components/layout/impersonation-bar.tsx  # Faixa do "Acessar Painel"
src/components/layout/member-view-switcher.tsx  # "Ver como" da faixa (empresa ou membro)
src/providers/viewing-member-provider.tsx    # Membro visto no "Ver como membro"
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

Contrato manual: a data de vencimento é o interruptor. Ela é o ÚLTIMO dia do
plano (inclusiva, fuso de Brasília); depois vêm 7 dias de carência em
`past_due`, com faixa vermelha para a empresa, e então `canceled` + free.
Enterprise nasce com 12 meses. Dono e admins recebem aviso pela central e por
e-mail em D-30, D-15, D-7 e D-1, e faixa amarela nos últimos 30 dias
(`plan-expiry-reminders.ts` no backend, `lib/billing/billing-banner.ts` no
front). O status que o diálogo mostra sai de `manualStatusFor`, a mesma regra
da API.

- **Plano pago sem data não salva**: sem ela não há aviso nem corte.
- **"Encerrar acesso agora"** (aba Assinatura, só contrato manual não free e
  não cancelado): `POST /v1/admin/tenants/:id/end-manual-access` leva a empresa
  direto a `canceled` + free, sem esperar a data nem a carência. O login
  continua (ela vê a tela de assinatura bloqueada); isso é diferente de
  desativar. Para devolver o acesso, escolha o plano e uma data futura.
  **Nada é apagado**: os dados da empresa ficam no tenant, só inacessíveis, e
  voltam como estavam quando o acesso volta. A empresa também não vira conta
  de demonstração: o papel continua pago, e o Demo é só do papel "free".
- **Teste dado pelo painel que vira assinatura no cartão:** o writer único
  (`syncTenantPlanBillingSnapshot`) tira `isManualSubscription` do tenant e dos
  usuários quando uma assinatura Stripe ATIVA ou em trial é vinculada. Sem isso
  o cron do plano manual cortaria quem paga e a sincronização diária pularia o
  Stripe. Evento de assinatura cancelada não mexe na marca.

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
- **De quem é o painel:** a faixa leva o selo "Dono" (e "painel de {dono}") ou
  "Membro", em qualquer largura, e o menu do avatar diz "Vendo: {empresa}, dono
  {nome}" ou "membro {nome}", com "Perfil de {nome}" no lugar de "Meu Perfil".
  O e-mail do menu continua sendo o do super admin.
- **Uma regra de dono só:** `lib/tenant-owner.ts` no backend, usada por
  `resolveTenantOwnerUid` (o "Dono" da lista de membros) e pela aba Acesso
  (`getAllTenantsBilling`). No front, `UserService.getTenantOwnerUser` lê o dono
  dessa lista. Até 2026-10 eram quatro regras: o Perfil buscava
  `role == "admin"` e, sem achar, mostrava qualquer usuário da empresa (o
  e-mail de um membro, no caso da AWA), e a aba Acesso podia mostrar um membro
  promovido a ADMIN como administrador.
- **Perfil:** mostra o dono, ou o membro visto, em somente leitura
  (`useProfileSubject`; ver `app/profile/CLAUDE.md`).

### "Ver como membro"

Abre o painel **como um membro da equipe** vê: dock, guarda de rota (`/403`),
botões, "só as minhas" de tarefas, OS e projetos, notificações e o que a API
responde. **Sempre somente leitura**, sem "Habilitar edição".

- **Entradas:** o botão "Membros" do card (`TenantMembersDialog`, lista de
  `GET /v1/admin/tenants/:id/members`; o dono leva ao Acessar Painel normal) e
  o seletor "Ver como" da faixa (`MemberViewSwitcher`), que troca entre a
  empresa e cada membro sem voltar ao `/admin`. A troca pela faixa recarrega a
  página: o que estava na tela foi lido com a identidade anterior.
- **Estado:** `ViewingMemberProvider` (acima do `PermissionsProvider`), com o
  membro em `sessionStorage` junto da empresa (`tenantId:uid`, então trocar de
  empresa descarta o membro). `buildImpersonationHeaders` manda
  `x-view-as-member` e, com membro, nunca o cabeçalho de escrita.
- **Recarga:** o provider só decide "não é superadmin, apaga o membro" depois
  que o login carregou (`isLoading` do `useAuth`). Até 2026-10 decidia antes,
  com o usuário ainda vazio, e toda troca pelo seletor da faixa (que recarrega
  a página) e todo F5 voltavam para a visão do dono. Guard:
  `providers/__tests__/viewing-member-provider.reload.test.tsx`.
- **Permissões:** o `PermissionsProvider` usa o papel e o mapa do membro
  (`buildMemberViewPermissions`, `lib/permissions/member-view.ts`). Ele cai no
  início que teria no login (`resolveMemberViewHome`).
- **Escopo de dados:** as leituras diretas do Firestore saem com o token do
  superadmin, que as rules liberam por inteiro. O "só as minhas" vem de
  `useEffectiveViewer()` (o membro visto, senão o usuário logado), nunca da
  rule. Consulta nova que filtre pela pessoa usa esse hook, não `user.id`.
- A Lia some nesse modo (ela grava conversa e histórico).
- **Auditoria:** `super_admin_member_view_started` / `_stopped`, com o membro.

---

## Auditoria (`/admin/audit`)

Mostra `security_audit_events`, que junta duas coisas: o que o super admin fez
em cada empresa e o que o backend recusou para os usuarios delas (conta
gratuita barrada, plano insuficiente, limite, rate limit, CORS, login). As duas
carregam o mesmo `tenantId`, entao a tela resolve **quem agiu**: o backend
(`withActors` em `lib/admin-actors.ts`) busca `users/{uid}` dos eventos da
pagina e devolve nome, e-mail e papel, e a linha ganha selo quando o papel e
`superadmin`. Sem isso nao havia como separar "eu entrei pelo Acessar Painel"
de "o cliente tentou".

Os rotulos dos eventos e dos motivos vivem em `EVENT_LABELS` e `REASON_LABELS`
na propria pagina. Evento sem rotulo aparece cru (foi assim que
`BILLING_SUBSCRIPTION_BLOCK` / `FREE_TIER_FORBIDDEN_ROUTE` apareceu em
producao): ao criar um `eventType` novo, acrescente o rotulo ali.

## Atividade das empresas (`/admin/activity`)

A auditoria é o rastro do super admin e das recusas do backend; esta tela é o
lado do cliente: o que os usuários de cada empresa fizeram no ERP. Coleção
`tenant_activity` (um doc por evento, 90 dias de TTL), lida por
`GET /v1/admin/activity` com cursor. Regras do backend e do catálogo em
`apps/functions/CLAUDE.md` (seção Error Observability, `tenant_activity`).

- **O que entra:** telas abertas (`useActivityTracking`, montado no shell
  autenticado), cliques em Assinar (com a origem: faixa da demonstração, tela
  de planos, landing, link de assinatura, acesso suspenso), aviso de plano
  visto e clicado, tentativa de alterar dados na demonstração, tela bloqueada,
  passos do tutorial, erros de API (4xx e 5xx, menos 401) e erros de tela. O
  servidor grava cadastro, entrada no ERP, checkout, teste grátis, assinatura,
  troca de plano, cancelamento e falha de pagamento.
- **O que nunca entra:** texto digitado, rótulo de botão, mensagem de erro,
  query string ou id cru na rota (vira `[id]`). O catálogo
  (`lib/activity/catalog.ts`, espelho do backend com paridade) fecha os tipos.
- **Super admin não é registrado**, nem no "Acessar Painel".
- **Onde abre:** a tela Atividade (todas as empresas, filtro por empresa e por
  tipo, "Erros" incluso) e o botão "Atividade" no card da empresa e no menu da
  Visão geral, que abrem o painel lateral (`TenantActivityDrawer`) com a
  jornada do cadastro à assinatura no topo e o filtro por usuário.
- Dias e horários no fuso de Brasília (`activity-format.ts`).

## Última vez online

`tenant_presence/{tenantId}.lastSeenAt`. Responde "a conta que nao assinou
voltou?" e "o assinante ainda usa?", que os contadores de proposta e lancamento
nao respondem.

**Colecao propria, nunca o doc `tenants/{id}`.** A primeira versao gravava no
doc da empresa, que o `TenantProvider` escuta em tempo real em toda aba aberta
de todo usuario dela: cada registro virava uma leitura por aba, um re-render da
tela inteira e uma nova busca de add-ons no `PlanProvider`. A listagem do painel
le a colecao nova com `getAll` (uma leitura por empresa da pagina) e usa o
`lastSeenAt` legado do doc da empresa como reserva (`pickLastSeen`, vale o mais
recente), para nao perder o que ja foi registrado enquanto a primeira versao
esteve no ar. Rules negam o navegador; so o backend le e grava.

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
- `/v1/session/ping` esta em `FREE_TIER_ALLOWED_PREFIXES`: sem isso a conta
  gratuita levaria 402 e o caso que originou o pedido nunca seria registrado.
- Aparece no card e na tabela da Visao geral, destacado acima de 30 dias.

## Online agora (`/admin/online`)

O "Último acesso" só sabe quando alguém ENTROU. Esta parte responde se a
pessoa continua lá: "entrou 10:15 e continua online" ou "entrou 10:15, saiu
10:20, ficou 5 min".

- **Aviso de presença:** cada aba do ERP chama `POST /v1/session/heartbeat` a
  cada minuto (`hooks/use-presence-heartbeat.ts`, montado no shell
  autenticado), com `active: true` quando a aba está à vista e houve
  interação nos últimos 5 minutos (`IDLE_AFTER_MS`). Voltar a mexer ou voltar
  para a aba avisa na hora, com no mínimo 15 s entre avisos.
- **Três estados**, calculados no backend (`lib/tenant-presence.ts`):
  - online: um aviso "em uso" nos últimos 2 minutos;
  - ausente: avisos chegando, mas sem uso (aba em segundo plano ou parada há 5 min);
  - offline: nenhum aviso há mais de 3 minutos. A sessão termina na hora do último aviso.
- **Onde fica:** `tenant_presence/{tenantId}` guarda a sessão da empresa, e
  `tenant_presence/{tenantId}/people/{uid}` a de cada pessoa, com nome e e-mail.
  Rules negam o navegador, como no último acesso; a exclusão definitiva apaga
  a subcoleção junto (`recursiveDelete`).
- **Histórico:** cada sessão encerrada vira `session_ended` na Atividade, na
  hora da saída e com a duração (id fixo pela sessão, então entra uma vez só).
  O encerramento é preguiçoso, sem rotina agendada: acontece no próximo aviso
  da pessoa ou quando o painel lê a presença (`closeStaleSessions`, no máximo
  uma vez por minuto por instância, chamado pela tela Online e pela lista de
  empresas). Uma sessão que acabou enquanto ninguém abria o painel entra na
  Atividade quando o painel abrir, com a hora certa de saída.
- **Onde aparece:** a tela Online (empresas e pessoas de hoje, primeiro quem
  está agora, atualiza a cada 30 s com a aba à vista), a linha "Agora:" do card
  e a coluna de último acesso da Visão geral.
- **Super admin não conta**, nem no "Ver como membro" (`req.user.impersonation`).
- `/v1/session/heartbeat` está em `FREE_TIER_ALLOWED_PREFIXES`, pelo mesmo
  motivo do ping: a conta gratuita também conta.
- **Custo:** uma transação (duas leituras, duas escritas) por pessoa por minuto
  enquanto o ERP está aberto, com antirrepetição de 45 s por pessoa contra
  várias abas. Guards: `apps/functions/src/lib/__tests__/tenant-presence.test.ts`,
  `hooks/__tests__/use-presence-heartbeat.test.tsx` e
  `app/admin/online/__tests__/online-page.test.tsx`.

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
| `startImpersonation` / `stopImpersonation` | `POST /v1/admin/impersonation/{start,stop}` (com `memberUid` no "Ver como membro") |
| `getTenantMembers` | `GET /v1/admin/tenants/:id/members` |
| `getAuditEvents` | `GET /v1/admin/audit-events` |
| `getTenantActivity` | `GET /v1/admin/activity` |
| `getPresence` | `GET /v1/admin/presence` |

Toda mutação do superadmin grava um evento em `security_audit_events`, com
`await` (no Cloud Run, write sem await se perde).

---

## Padrão para novos componentes admin

- Não verificar role no componente: o layout já garante superadmin.
- Chamadas via `AdminService`.
- Operação destrutiva sempre com `AlertDialog` explicando o efeito.
- Página nova do painel entra em `ADMIN_SECTIONS` (`lib/admin-sections.ts`), que
  alimenta a dock (desktop) e a tab bar do celular. Não existe mais barra de
  abas no topo. No celular só as 4 primeiras ficam na barra e o resto vai para o
  "Mais": seção nova de uso diário e rótulo curto (até ~11 caracteres, ~72px a
  360px) vai nas quatro primeiras; o guard é
  `components/layout/__tests__/superadmin-navigation.test.tsx`.

## Celular

O painel segue as regras de responsividade do ERP (`CLAUDE.md` da raiz): o
desktop não muda, toda diferença é aditiva com prefixo.

- **Padding da página:** o `<main>` do shell já aplica `p-4 md:p-8`. A raiz de
  cada página do painel usa `p-6 max-md:p-0` (ou `md:p-6 max-md:p-0`); sem isso
  o conteúdo ficava com ~280px a 360px.
- **Tabelas largas viram lista abaixo de `md`:** a da Visão geral (8 colunas) e a
  de Faturamento (6 colunas) têm uma `<ul className="md:hidden">` de cards e a
  tabela dentro de `hidden md:block`. Tabela nova do painel com mais de ~4
  colunas segue o mesmo padrão, ou esconde colunas secundárias com
  `hidden md:table-cell` (ranking de atividade, ocorrências).
- **Gráficos (Recharts)** não leem classe do Tailwind: largura de eixo, fonte e
  raio vêm de `useIsMobile()`.
- **Toque:** botões de ícone ganham `max-md:h-10 max-md:w-10`; nada de ação que
  só aparece no hover. Tooltip de informação vira texto visível abaixo de `md`.
- **Guard:** `tests/e2e/mobile/admin-no-overflow.spec.ts`, logado como super
  admin, mede as 9 rotas e confere que os filtros da Visão geral aparecem
  inteiros (card com `overflow-hidden` corta em vez de vazar, e a medida de
  overflow sozinha não enxerga isso).
