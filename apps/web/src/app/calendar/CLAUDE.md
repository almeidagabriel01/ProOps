# CLAUDE.md — src/app/calendar/

## Propósito

Agenda operacional do tenant. Permite criar, visualizar, editar, reagendar e excluir compromissos. Suporta visualização em grade mensal, semanal, diária e lista. A integração com Google Calendar é opcional e controlada por feature flag de ambiente.

---

## Estrutura de arquivos

```
src/app/calendar/
└── page.tsx                    # Wrapper Client Component — delega para CalendarPage

src/components/features/calendar/
├── calendar-page.tsx           # Componente principal (toda a lógica e UI)
└── calendar-event-dialog.tsx   # Dialog de criação/edição de eventos

src/services/
└── calendar-service.ts         # Chamadas HTTP ao backend (/v1/calendar/*)

src/types/
└── calendar.ts                 # Tipos TypeScript do domínio
```

`page.tsx` é intencionalmente mínimo — apenas renderiza `<CalendarPage />`. Toda a lógica reside em `src/components/features/calendar/calendar-page.tsx`.

---

## Visita de obra

Evento com `projectId`/`projectStageId` é a visita de uma etapa de obra,
criado pela tela de Projetos (nunca pela Agenda: o backend não aceita o
vínculo no corpo). O diálogo avisa e leva à obra ("Abrir obra"), e mover,
cancelar ou excluir o evento aqui muda a data que a obra mostra. Ver
`app/projects/CLAUDE.md`.

## Visita de ordem de serviço

Evento com `serviceOrderId` é a visita de uma OS, criado e mantido pela OS
(data, técnico, título e endereço), com a cor roxa da Agenda e o técnico como
dono. O diálogo leva à OS ("Abrir OS"); mover o evento aqui ou no Google muda a
data da OS, e excluir ou cancelar a devolve para "aberta"
(`order-schedule-store.ts`). OS concluída não muda mais, nem pela Agenda.

## No celular

Abaixo de `md` (`useIsMobile`, porque a configuração do FullCalendar é JS):

- A agenda abre em **Lista** (`listWeek`), uma vez, na montagem; trocar de
  visão depois é livre.
- No **Mês** cada dia tem ~40px, e o chip de texto transbordava para o dia
  vizinho. O evento vira um **ponto** na cor dele (faixa, se atravessa dias),
  sem o fundo que o FullCalendar aplica inline (`.calendar-event--mobile`), e
  **tocar no dia** (ou no "+N") abre a visão **Dia** daquela data.
- Na **Semana** o chip esconde local e situação; o detalhe fica no diálogo.
- **O período (setas, "Hoje" e as abas de visão) fica logo acima dos
  compromissos**, presa no topo do `<main>` enquanto a lista rola. No meio do
  cabeçalho ela sumia assim que a pessoa rolava até a lista. É renderizada num
  lugar só, conforme `isMobile`, para não haver dois títulos de período no DOM.
  O card usa `overflow-clip` no celular, e não `hidden`: `hidden` faria dele um
  contêiner de rolagem, e a barra nunca grudaria.
- **Busca, fim de semana e situação moram na janela "Filtros"**; o botão mostra
  quantos filtros estão ligados. Os contadores ficam numa linha que rola de lado.
- Na Lista o título quebra em vez de cortar, e o "+N" do mês é só o número.
- O bloco do calendário tem `min-w-0` no celular: sem ele a linha de contadores
  impunha ~580px ao bloco, e a grade do mês saía da tela, cortada pelo card.

Guard: `tests/e2e/mobile/agenda-layout.spec.ts`. O desktop é o
`tests/e2e/layout/calendar-layout.spec.ts`, e nada disto muda de `md` para
cima.

## Biblioteca de Calendário

O componente usa **FullCalendar** (`@fullcalendar/react`) com os seguintes plugins:

| Plugin | Finalidade |
|--------|-----------|
| `@fullcalendar/daygrid` | Vista mensal em grade |
| `@fullcalendar/timegrid` | Vista semanal e diária com horários |
| `@fullcalendar/list` | Vista em lista |
| `@fullcalendar/interaction` | Drag-and-drop, resize, clique em células |

Locale: `pt-br` via `@fullcalendar/core/locales/pt-br`.

---

## Modelo de Dados

### `CalendarEvent` (src/types/calendar.ts)

```typescript
interface CalendarEvent {
  id: string
  tenantId: string
  ownerUserId: string
  createdByUserId: string
  updatedByUserId: string
  title: string
  description: string | null
  location: string | null
  status: "scheduled" | "completed" | "canceled" | "pending"
  color: string           // hex — um dos 6 valores predefinidos
  isAllDay: boolean
  startsAt: string | null // ISO 8601 — null quando isAllDay=true
  endsAt: string | null   // ISO 8601 — null quando isAllDay=true
  startDate: string | null // "YYYY-MM-DD" — null quando isAllDay=false
  endDate: string | null   // "YYYY-MM-DD" — null quando isAllDay=false
  startMs: number          // timestamp em ms para ordenação e filtros
  endMs: number
  googleSync: GoogleCalendarSyncMetadata
  createdAt: string
  updatedAt: string
}
```

### Eventos de dia inteiro vs. eventos com horário

O campo `isAllDay` determina qual par de campos usar:

| `isAllDay` | Campos de data usados | Campos ignorados |
|------------|----------------------|-----------------|
| `true` | `startDate`, `endDate` | `startsAt`, `endsAt` (null) |
| `false` | `startsAt`, `endsAt` | `startDate`, `endDate` (null) |

Ao construir o payload para o FullCalendar (`EventInput`), a page usa:
- `start: isAllDay ? startDate : startsAt`
- `end: isAllDay ? endDate : endsAt`

---

## Service Layer

`src/services/calendar-service.ts` expõe os seguintes métodos:

| Método | HTTP | Rota | Descrição |
|--------|------|------|-----------|
| `fetchEvents(options)` | GET | `/v1/calendar/events?startMs=&endMs=` | Busca eventos em um intervalo de tempo |
| `subscribeToEvents(options)` | — | polling | Polling a cada 15s, retorna `Unsubscribe` |
| `createEvent(payload)` | POST | `/v1/calendar/events` | Cria evento |
| `updateEvent(id, payload)` | PUT | `/v1/calendar/events/:id` | Atualiza evento |
| `deleteEvent(id)` | DELETE | `/v1/calendar/events/:id` | Remove evento |
| `getGoogleConnectionStatus()` | GET | `/v1/calendar/google/status` | Status da conexão Google |
| `getGoogleAuthUrl()` | GET | `/v1/calendar/google/auth-url` | URL OAuth para conectar Google |
| `disconnectGoogleCalendar()` | DELETE | `/v1/calendar/google/status` | Desconecta Google Calendar |

### Estratégia de atualização em tempo real

Não usa Firestore onSnapshot. A atualização é feita via **polling**: `subscribeToEvents` chama `fetchEvents` imediatamente e depois a cada `15_000ms`. Retorna uma função `Unsubscribe` que limpa o `setInterval`. O `useEffect` em `calendar-page.tsx` registra e cancela a subscription quando o `range` ou o `tenant.id` mudam.

### Intervalo de busca

O range padrão ao montar a página é:
- `startMs`: agora − 30 dias
- `endMs`: agora + 120 dias

O range é atualizado via `DatesSetArg` do FullCalendar (callback `datesSet`) quando o usuário navega para outro período.

---

## Integração com Google Calendar

### Feature flag

A integração é controlada pela variável de ambiente:

```
NEXT_PUBLIC_GOOGLE_CALENDAR_SYNC_ENABLED=true|false
```

O helper `isGoogleCalendarSyncEnabled()` em `src/lib/google-calendar-feature.ts` lê esse valor. Se `false` (padrão), toda a UI de Google Calendar fica oculta e as chamadas de API correspondentes não são feitas.

### Fluxo de conexão (quando habilitado)

1. Usuário clica em "Conectar agora" no painel lateral.
2. `CalendarService.getGoogleAuthUrl()` retorna a URL OAuth do Google.
3. O browser é redirecionado via `window.location.assign(authUrl)`.
4. Após o OAuth, o Google redireciona para `/calendar?googleCalendar=connected` (ou `=error`).
5. `CalendarPage` detecta o parâmetro de URL, exibe toast, atualiza o status e faz `router.replace('/calendar')` para limpar a URL.

### Status de sincronização por evento

Cada `CalendarEvent` carrega um `googleSync: GoogleCalendarSyncMetadata` com:
- `status: "disabled" | "synced" | "error" | "removed"`
- `lastError` — mensagem do último erro de sincronização
- `externalEventId` — ID do evento no Google Calendar

O chip do evento no calendário exibe um indicador "G" quando `status === "synced"`.

### Quem pode gerenciar a conexão da empresa

Somente usuários `isMaster` podem conectar/desconectar o Google Calendar da empresa (`canManageCompanyCalendar = isMaster`). Membros veem um aviso de leitura informando que a configuração é feita pelo master.

---

## Permissões

A página usa `usePagePermission("calendar")` para verificar:

| Variável | Permissão verificada | Efeito |
|----------|----------------------|--------|
| `canCreate` | `permissions.canCreate \|\| isMaster` | Permite abrir dialog de criação e clicar em células |
| `canEdit` | `permissions.canEdit \|\| isMaster` | Permite salvar edições e arrastar/redimensionar eventos |
| `canDelete` | `permissions.canDelete \|\| isMaster` | Exibe botão "Excluir" no dialog |

Membros sem `canCreate` não conseguem criar eventos (o handler `handleOpenCreateDialog` retorna cedo). Membros sem `canEdit` têm o drag-and-drop revertido automaticamente (`calendarEvent.revert()`).

### O backend também checa (desde 2026-09-03)

Até então o calendário era o único módulo cujo backend ignorava por completo o
que o master marcou: `calendar.controller.ts` usava um modelo próprio, por
**posse do evento** (`ownerUserId`), e nada mais. As tabelas acima eram, na
prática, só UI — a API aceitaria a chamada.

Agora a API cobra a permissão da página:

| Rota | Exige |
|---|---|
| `GET /v1/calendar/events` | `calendar.canView` |
| `POST /v1/calendar/events` | `calendar.canCreate` |
| `PUT /v1/calendar/events/:id` | `calendar.canEdit` |
| `DELETE /v1/calendar/events/:id` | `calendar.canDelete` |

### É UM calendário do tenant, não um por membro

Esse é o modelo do produto, confirmado em 2026-09-03: o master conecta a conta
Google **da empresa** e todo membro com acesso ao Calendário vê os mesmos
dados dessa conta; o que um marca aparece para os outros, master incluído.

Por isso **não existe checagem de posse do evento**. O gate é a permissão que
o master concedeu — `calendar.canEdit` / `canDelete` — mais o `tenantId`. A
posse não é critério de nada.

Isso não era assim até 2026-09-03, e as camadas discordavam:

- `canManageCalendarEvent` exigia `ownerUserId == uid`, com um escape que
  liberava qualquer evento sincronizado com o Google a qualquer membro — o que
  cobria a maioria dos eventos e deixava só os criados localmente presos ao
  autor. Uma diferença que ninguém pediu e que não aparecia na UI.
- A Firestore Rule de `calendar_events` restringia o membro a `ownerUserId ==
  uid`, enquanto `GET /v1/calendar/events` sempre devolveu o tenant inteiro.

Agora a Rule é de tenant, como nas outras coleções, e quem pode ver o
Calendário é decidido pela permissão que a API cobra. Escrita segue exclusiva
das Cloud Functions (`allow write: if false`). Guard:
`tests/firestore-rules/calendar-events.test.ts` — a coleção não tinha teste
nenhum, justamente a de regra mais sutil do arquivo.

---

## Componentes de UI Internos

### `CalendarStatPill`

Componente local (não exportado) que exibe estatísticas rápidas no header:

| Label | Dado | Tom |
|-------|------|-----|
| Hoje | Eventos que iniciam hoje | default |
| 7 dias | Eventos nos próximos 7 dias | default |
| Concluidos | Eventos com status completed | success |
| Cancelados | Eventos com status canceled | danger |

### `GoogleCalendarCompanyCard`

Componente local que exibe status da conexão Google e botões de conectar/reconectar/desconectar. Visível apenas quando `GOOGLE_CALENDAR_SYNC_ENABLED=true`.

### `UpcomingEventsCard`

Painel lateral com lista de próximos compromissos filtrada e ordenada. Clicando em um item abre o dialog de edição.

A lista rola por dentro (`overflow-y-auto`), e isso depende de o wrapper dela
no `<aside>` ser `flex flex-col`: sem isso o `flex-1` da lista não tem altura,
ela cresce até o fim do conteúdo e o Card corta o resto sem deixar rolar.

### Grade do mês e navegação

- **O mês cabe inteiro na altura da tela** (xl+, onde o calendário tem altura
  fixa): `dayMaxEvents={true}`, e o que não cabe no dia vira "+ mais". Na grade
  do mês o chip é uma linha só (hora, título e o "G"), com o resto no `title`;
  semana, dia e lista mantêm o chip completo. Com `dayMaxEvents={3}` e o chip de
  quatro linhas, as semanas cresciam além da tela e a última saía cortada.
  Abaixo de xl (altura `auto`) o teto continua 3.
- **Piso de 3.25rem por semana** (`.fc-daygrid-day-frame` no `globals.css`),
  o menor em que cabe um evento. Em tela baixa (1280x720) a grade rola em vez
  de esmagar as semanas, e a última chega inteira ao fim da rolagem; dia cheio
  mostra só o "+ mais". Subir o piso faz uma tela de 1600x713 voltar a rolar.
- **As setas cercam o título do período** e o rótulo diz o que pulam
  (`NAVIGATION_LABELS`: mês, semana ou dia, conforme a visão). O "Hoje" fica à
  parte e só acende quando o período mostrado não contém hoje.

Guard: `tests/e2e/layout/calendar-layout.spec.ts`.

### `CalendarEventDialog` (arquivo separado)

Dialog completo de criação/edição de eventos (`calendar-event-dialog.tsx`). Exporta também funções auxiliares puras:

| Função | Descrição |
|--------|-----------|
| `createEmptyCalendarFormValues()` | Valores iniciais com horário arredondado para próximos 30min |
| `buildCalendarFormValuesFromEvent(event)` | Converte `CalendarEvent` → `CalendarEventFormValues` |
| `buildCalendarPayloadFromForm(values)` | Converte form → `CalendarEventPayload` para a API |

### Cores disponíveis

```typescript
const COLOR_OPTIONS = [
  "#2563eb", // azul
  "#0f766e", // teal
  "#7c3aed", // roxo
  "#ea580c", // laranja
  "#e11d48", // vermelho
  "#0891b2", // ciano
]
```

---

## Filtros e Busca

| Filtro | Estado | Comportamento |
|--------|--------|---------------|
| Status | `statusFilter: CalendarEvent["status"][]` | Multiseleção — Agendado, Concluido, Cancelado |
| Busca por texto | `searchTerm` + `deferredSearch` | Filtra por title, location, description; usa `React.useDeferredValue` para não bloquear UI |
| Fins de semana | `showWeekends` | Toggle que passa para `FullCalendar.weekends` |

Os filtros são aplicados no `useMemo` de `visibleEvents` no lado do cliente, sobre os eventos já carregados.

---

## Relação com outras entidades

Os eventos de calendário **não têm vínculo direto** com propostas ou contatos no modelo atual. São entidades independentes do tenant, criadas manualmente pelo usuário. Não há importação automática de datas de proposta para o calendário.

---

## Casos especiais

- **Superadmin sem tenant**: exibe `<SelectTenantState title="Selecione uma empresa para ver o calendario" />`.
- **Drag-and-drop de eventos**: quando o usuário arrastar ou redimensionar um evento, `handleEventMove` chama imediatamente `CalendarService.updateEvent`. Em caso de erro, chama `calendarEvent.revert()` para desfazer a mudança visual.
- **`datesSet` callback**: atualiza `range` e `currentTitle` conforme o usuário navega. A mudança de `range` aciona o `useEffect` que recria a subscription de polling.
