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
  status: "scheduled" | "completed" | "canceled"
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
