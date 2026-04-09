"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import type {
  CalendarApi,
  DatesSetArg,
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import {
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Link2,
  LoaderCircle,
  RefreshCcw,
  Search,
  Unlink2,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isGoogleCalendarSyncEnabled } from "@/lib/google-calendar-feature";
import { toast } from "@/lib/toast";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePagePermission } from "@/hooks/usePagePermission";
import { usePermissions } from "@/providers/permissions-provider";
import { CalendarService } from "@/services/calendar-service";
import type {
  CalendarEvent,
  CalendarEventFormValues,
  GoogleCalendarConnectionStatus,
} from "@/types/calendar";
import {
  buildCalendarFormValuesFromEvent,
  buildCalendarPayloadFromForm,
  CalendarEventDialog,
  createEmptyCalendarFormValues,
} from "./calendar-event-dialog";

const STATUS_LABELS: Record<CalendarEvent["status"], string> = {
  scheduled: "Agendado",
  completed: "Concluido",
  canceled: "Cancelado",
};

const STATUS_BADGES: Record<
  CalendarEvent["status"],
  "default" | "success" | "destructive"
> = {
  scheduled: "default",
  completed: "success",
  canceled: "destructive",
};

const GOOGLE_CALENDAR_SYNC_ENABLED = isGoogleCalendarSyncEnabled();

function formatDateTime(dateValue: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function formatDateOnly(dateValue: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  }).format(new Date(dateValue));
}

function formatRangeLabel(startMs: number, endMs: number): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `${formatter.format(new Date(startMs))} - ${formatter.format(new Date(endMs))}`;
}

function toDateOnlyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function buildFormValuesFromSelection(selection: DateSelectArg): CalendarEventFormValues {
  if (selection.allDay) {
    return {
      ...createEmptyCalendarFormValues(),
      isAllDay: true,
      startDate: selection.startStr.slice(0, 10),
      endDate: selection.endStr.slice(0, 10),
    };
  }

  const start = selection.start;
  const end = selection.end || new Date(start.getTime() + 60 * 60 * 1000);

  const toInputValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const hours = String(value.getHours()).padStart(2, "0");
    const minutes = String(value.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return {
    ...createEmptyCalendarFormValues(),
    isAllDay: false,
    startsAt: toInputValue(start),
    endsAt: toInputValue(end),
  };
}

function buildPayloadFromCalendarMove(
  event:
    | EventDropArg["event"]
    | EventResizeDoneArg["event"],
  current: CalendarEvent,
) {
  if (event.allDay) {
    const startDate = event.startStr.slice(0, 10);
    const endDate = event.endStr
      ? event.endStr.slice(0, 10)
      : toDateOnlyFromDate(new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000));

    return {
      title: current.title,
      description: current.description,
      location: current.location,
      status: current.status,
      color: current.color,
      isAllDay: true,
      startDate,
      endDate,
      startsAt: null,
      endsAt: null,
    };
  }

  return {
    title: current.title,
    description: current.description,
    location: current.location,
    status: current.status,
    color: current.color,
    isAllDay: false,
    startsAt: event.start ? event.start.toISOString() : current.startsAt,
    endsAt: event.end ? event.end.toISOString() : current.endsAt,
    startDate: null,
    endDate: null,
  };
}

type CalendarViewType =
  | "dayGridMonth"
  | "timeGridWeek"
  | "timeGridDay"
  | "listWeek";

function CalendarStatPill(props: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    props.tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : props.tone === "danger"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        : "border-border/60 bg-muted/35 text-foreground";

  return (
    <div
      className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm ${toneClass}`}
    >
      {props.icon ? <span className="opacity-75">{props.icon}</span> : null}
      <span className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">
        {props.label}
      </span>
      <span className="text-sm font-semibold">{props.value}</span>
    </div>
  );
}

function GoogleCalendarCompanyCard(props: {
  status: GoogleCalendarConnectionStatus;
  isLoading: boolean;
  isConnecting: boolean;
  canManage: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Google Agenda da empresa</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Sincronizacao central da agenda operacional com a conta Google principal.
          </p>
        </div>
        {props.isLoading ? (
          <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
        ) : props.status.connected ? (
          <Badge variant="success" className="shrink-0">
            Conectado
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            Desconectado
          </Badge>
        )}
      </div>

      {props.status.connected ? (
        <>
          <div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/7 px-4 py-3.5">
            <p className="text-sm font-medium text-foreground">
              {props.status.email || "Conta principal da empresa conectada"}
            </p>
            {props.status.lastSuccessfulSyncAt ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Ultimo sync: {formatDateTime(props.status.lastSuccessfulSyncAt)}
              </p>
            ) : null}
          </div>

          {props.status.lastSyncError ? (
            <div className="rounded-[22px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Ultimo erro: {props.status.lastSyncError}
            </div>
          ) : null}

          {props.canManage ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={props.onConnect} disabled={props.isConnecting}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reconectar
              </Button>
              <Button
                variant="destructive"
                onClick={props.onDisconnect}
                disabled={props.isLoading}
              >
                <Unlink2 className="mr-2 h-4 w-4" />
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="rounded-[22px] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              A conexão da agenda da empresa é administrada por um usuário master.
            </div>
          )}
        </>
      ) : (
        <>
          <div className="rounded-[22px] border border-border/60 bg-muted/20 px-4 py-4">
            <div className="flex items-start gap-3">
              <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Conecte a agenda principal da empresa</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Os compromissos do ProOps podem sincronizar com o Google Agenda
                  assim que a integração for ativada.
                </p>
              </div>
            </div>
          </div>
          {props.canManage ? (
            <Button onClick={props.onConnect} disabled={props.isConnecting} className="w-full">
              {props.isConnecting ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Conectar agora
            </Button>
          ) : (
            <div className="rounded-[22px] border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Peca para um usuario master conectar a agenda da empresa.
            </div>
          )}
        </>
      )}
    </section>
  );
}

function UpcomingEventsCard(props: {
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0">
        <p className="text-sm font-semibold tracking-tight">Proximos compromissos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Lista viva baseada na visualizacao e nos filtros ativos.
        </p>
      </div>

      <div className="calendar-panel-scrollbar mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {props.events.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum compromisso visivel neste recorte.
          </div>
        ) : (
          props.events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => props.onOpenEvent(event)}
              className="group w-full rounded-[22px] border border-border/60 bg-background/75 px-4 py-3.5 text-left transition hover:border-primary/30 hover:bg-primary/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <p className="truncate font-medium">{event.title}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {event.isAllDay
                        ? formatDateOnly(event.startDate || event.createdAt)
                        : formatDateTime(event.startsAt || event.createdAt)}
                    </span>
                    {event.location ? (
                      <span className="truncate rounded-full bg-muted px-2 py-1">
                        {event.location}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_BADGES[event.status]}>
                    {STATUS_LABELS[event.status]}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isMaster } = usePermissions();
  const permissions = usePagePermission("calendar");

  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [range, setRange] = React.useState(() => {
    const now = Date.now();
    return {
      startMs: now - 30 * 24 * 60 * 60 * 1000,
      endMs: now + 120 * 24 * 60 * 60 * 1000,
    };
  });
  const [statusFilter, setStatusFilter] = React.useState<
    CalendarEvent["status"][]
  >(["scheduled", "completed", "canceled"]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const deferredSearch = React.useDeferredValue(searchTerm);
  const [showWeekends, setShowWeekends] = React.useState(true);
  const [currentView, setCurrentView] =
    React.useState<CalendarViewType>("dayGridMonth");
  const [currentTitle, setCurrentTitle] = React.useState("");
  const [isLoadingEvents, setIsLoadingEvents] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [googleStatus, setGoogleStatus] =
    React.useState<GoogleCalendarConnectionStatus>({
      enabled: GOOGLE_CALENDAR_SYNC_ENABLED,
      connected: false,
    });
  const [isLoadingGoogle, setIsLoadingGoogle] = React.useState(
    GOOGLE_CALENDAR_SYNC_ENABLED,
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"create" | "edit">(
    "create",
  );
  const [activeEvent, setActiveEvent] = React.useState<CalendarEvent | null>(
    null,
  );
  const [formValues, setFormValues] = React.useState<CalendarEventFormValues>(
    createEmptyCalendarFormValues(),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = React.useState(false);
  const calendarRef = React.useRef<FullCalendar | null>(null);

  const canCreate = permissions.canCreate || isMaster;
  const canEdit = permissions.canEdit || isMaster;
  const canDelete = permissions.canDelete || isMaster;
  const canManageCompanyCalendar = isMaster;

  const upsertEvent = React.useCallback((nextEvent: CalendarEvent) => {
    setEvents((current) => {
      const filtered = current.filter((event) => event.id !== nextEvent.id);
      filtered.push(nextEvent);
      filtered.sort((a, b) => a.startMs - b.startMs);
      return filtered;
    });
  }, []);

  const removeEvent = React.useCallback((eventId: string) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
  }, []);

  const refreshEvents = React.useCallback(async () => {
    if (!tenant?.id) {
      setEvents([]);
      return;
    }

    const nextEvents = await CalendarService.fetchEvents({
      rangeStartMs: range.startMs,
      rangeEndMs: range.endMs,
    });
    setEvents(nextEvents);
  }, [tenant?.id, range.endMs, range.startMs]);

  const handleManualRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshEvents();
    } catch {
      toast.error("Não foi possível atualizar os compromissos.");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshEvents]);

  React.useEffect(() => {
    if (!tenant?.id) {
      setEvents([]);
      setIsLoadingEvents(false);
      return;
    }

    setIsLoadingEvents(true);

    const unsubscribe = CalendarService.subscribeToEvents({
      rangeStartMs: range.startMs,
      rangeEndMs: range.endMs,
      callback: (nextEvents) => {
        setEvents(nextEvents);
        setIsLoadingEvents(false);
      },
      onError: () => {
        setIsLoadingEvents(false);
        toast.error("Não foi possível carregar os compromissos.");
      },
    });

    return () => unsubscribe();
  }, [tenant?.id, user?.id, range.startMs, range.endMs]);

  React.useEffect(() => {
    if (!GOOGLE_CALENDAR_SYNC_ENABLED) {
      setGoogleStatus({ enabled: false, connected: false });
      setIsLoadingGoogle(false);
      return;
    }

    let active = true;

    async function loadGoogleStatus() {
      if (!tenant?.id || !user?.id) {
        if (active) {
          setGoogleStatus({ enabled: true, connected: false });
          setIsLoadingGoogle(false);
        }
        return;
      }

      setIsLoadingGoogle(true);

      try {
        const status = await CalendarService.getGoogleConnectionStatus();
        if (active) {
          setGoogleStatus(status);
        }
      } catch (error) {
        if (active) {
          setGoogleStatus({ enabled: true, connected: false });
        }
        console.error("[CalendarPage] Error loading Google status:", error);
      } finally {
        if (active) {
          setIsLoadingGoogle(false);
        }
      }
    }

    void loadGoogleStatus();

    return () => {
      active = false;
    };
  }, [tenant?.id, user?.id]);

  React.useEffect(() => {
    if (!GOOGLE_CALENDAR_SYNC_ENABLED) {
      return;
    }

    const googleCalendarStatus = searchParams.get("googleCalendar");
    if (!googleCalendarStatus) {
      return;
    }

    if (googleCalendarStatus === "connected") {
      toast.success("Google Agenda conectado com sucesso.");
    } else {
      toast.error("Não foi possível concluir a conexão com o Google Agenda.");
    }

    void CalendarService.getGoogleConnectionStatus()
      .then((status) => setGoogleStatus(status))
      .catch(() => undefined)
      .finally(() => setIsLoadingGoogle(false));

    router.replace("/calendar");
  }, [router, searchParams]);

  const visibleEvents = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return events.filter((event) => {
      if (!statusFilter.includes(event.status)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [event.title, event.location || "", event.description || ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [events, statusFilter, deferredSearch]);

  const upcomingEvents = React.useMemo(() => {
    const now = Date.now();
    return visibleEvents.filter((event) => event.endMs >= now);
  }, [visibleEvents]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;

    return {
      today: visibleEvents.filter(
        (event) => event.startMs >= todayStart && event.startMs < tomorrowStart,
      ).length,
      week: visibleEvents.filter(
        (event) => event.startMs >= todayStart && event.startMs < weekEnd,
      ).length,
      completed: visibleEvents.filter((event) => event.status === "completed")
        .length,
      canceled: visibleEvents.filter((event) => event.status === "canceled")
        .length,
    };
  }, [visibleEvents]);

  const calendarEvents = React.useMemo<EventInput[]>(
    () =>
      visibleEvents.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.isAllDay ? event.startDate || undefined : event.startsAt || undefined,
        end: event.isAllDay ? event.endDate || undefined : event.endsAt || undefined,
        allDay: event.isAllDay,
        backgroundColor:
          event.status === "canceled" ? `${event.color}18` : `${event.color}20`,
        borderColor: event.color,
        textColor: event.status === "canceled" ? "#9ca3af" : undefined,
        extendedProps: {
          status: event.status,
          location: event.location,
          googleSyncStatus: event.googleSync.status,
        },
      })),
    [visibleEvents],
  );

  function handleOpenCreateDialog(selection?: DateSelectArg) {
    if (!canCreate) return;
    setDialogMode("create");
    setActiveEvent(null);
    setFormValues(
      selection ? buildFormValuesFromSelection(selection) : createEmptyCalendarFormValues(),
    );
    setDialogOpen(true);
  }

  function handleOpenEditDialog(event: CalendarEvent) {
    setDialogMode("edit");
    setActiveEvent(event);
    setFormValues(buildCalendarFormValuesFromEvent(event));
    setDialogOpen(true);
  }

  async function handleSubmitEvent() {
    if (!canCreate && dialogMode === "create") return;
    if (!canEdit && dialogMode === "edit") return;

    const payload = buildCalendarPayloadFromForm(formValues);
    if (!payload.title) {
      toast.error("Informe um titulo para o compromisso.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (dialogMode === "create") {
        const createdEvent = await CalendarService.createEvent(payload);
        upsertEvent(createdEvent);
        toast.success("Compromisso criado.");
      } else if (activeEvent) {
        const updatedEvent = await CalendarService.updateEvent(
          activeEvent.id,
          payload,
        );
        upsertEvent(updatedEvent);
        toast.success("Compromisso atualizado.");
      }

      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEvent() {
    if (!activeEvent || !canDelete) return;

    setIsDeleting(true);

    try {
      await CalendarService.deleteEvent(activeEvent.id);
      removeEvent(activeEvent.id);
      toast.success("Compromisso excluido.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleGoogleConnect() {
    if (!GOOGLE_CALENDAR_SYNC_ENABLED) {
      toast.info("A integracao com Google Agenda esta temporariamente desabilitada.");
      return;
    }

    setIsConnectingGoogle(true);

    try {
      const authUrl = await CalendarService.getGoogleAuthUrl();
      window.location.assign(authUrl);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a conexão com o Google.",
      );
      setIsConnectingGoogle(false);
    }
  }

  async function handleGoogleDisconnect() {
    if (!GOOGLE_CALENDAR_SYNC_ENABLED) {
      return;
    }

    setIsLoadingGoogle(true);

    try {
      await CalendarService.disconnectGoogleCalendar();
      await refreshEvents();
      setGoogleStatus({ enabled: true, connected: false });
      toast.success("Google Agenda desconectado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível desconectar o Google Agenda.",
      );
    } finally {
      setIsLoadingGoogle(false);
    }
  }

  async function handleEventMove(
    calendarEvent: EventDropArg | EventResizeDoneArg,
  ) {
    if (!canEdit) {
      calendarEvent.revert();
      return;
    }

    const current = events.find((item) => item.id === calendarEvent.event.id);
    if (!current) {
      calendarEvent.revert();
      return;
    }

    try {
      await CalendarService.updateEvent(
        current.id,
        buildPayloadFromCalendarMove(calendarEvent.event, current),
      );
      toast.success("Compromisso reagendado.");
    } catch (error) {
      calendarEvent.revert();
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível reagendar o compromisso.",
      );
    }
  }

  function getCalendarApi(): CalendarApi | null {
    return calendarRef.current?.getApi() || null;
  }

  function handleCalendarViewChange(view: string) {
    const nextView = view as CalendarViewType;
    setCurrentView(nextView);
    getCalendarApi()?.changeView(nextView);
  }

  function handleCalendarNavigation(action: "prev" | "next" | "today") {
    const api = getCalendarApi();
    if (!api) return;

    if (action === "prev") {
      api.prev();
      return;
    }

    if (action === "next") {
      api.next();
      return;
    }

    api.today();
  }

  function renderEventContent(content: EventContentArg) {
    const status = String(content.event.extendedProps.status || "scheduled");
    const location = String(content.event.extendedProps.location || "").trim();
    const syncStatus = String(
      content.event.extendedProps.googleSyncStatus || "disabled",
    );

    return (
      <div className="calendar-event-chip">
        <div className="calendar-event-chip__header">
          <span className="calendar-event-chip__title">{content.event.title}</span>
          {GOOGLE_CALENDAR_SYNC_ENABLED && syncStatus === "synced" ? (
            <span
              className="calendar-event-chip__sync"
              title="Sincronizado com Google Agenda"
            >
              G
            </span>
          ) : null}
        </div>
        {content.timeText ? (
          <span className="calendar-event-chip__time">{content.timeText}</span>
        ) : null}
        {location ? (
          <span className="calendar-event-chip__meta">{location}</span>
        ) : null}
        <span
          className={`calendar-event-chip__status calendar-event-chip__status--${status}`}
        >
          {STATUS_LABELS[status as CalendarEvent["status"]]}
        </span>
      </div>
    );
  }

  if (user?.role === "superadmin" && !tenant) {
    return <SelectTenantState title="Selecione uma empresa para ver o calendario" />;
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden xl:h-[calc(100dvh-8rem)]">
      <Card className="calendar-surface flex min-h-0 flex-1 overflow-hidden rounded-[32px] border-border/60 bg-card/95 shadow-[0_28px_90px_rgba(15,23,42,0.08)]">
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-border/60 px-5 py-3 xl:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-col items-start gap-2">
                      <h1 className="text-[2rem] font-semibold tracking-[-0.045em] text-foreground">
                        Calendario <span className="text-muted-foreground">operacional</span>
                      </h1>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Visualize, organize e reagende compromissos sem perder contexto.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <CalendarStatPill
                      label="Hoje"
                      value={stats.today}
                      icon={<CalendarClock className="h-3.5 w-3.5" />}
                    />
                    <CalendarStatPill
                      label="7 dias"
                      value={stats.week}
                      icon={<CalendarRange className="h-3.5 w-3.5" />}
                    />
                    <CalendarStatPill
                      label="Concluidos"
                      value={stats.completed}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      tone="success"
                    />
                    <CalendarStatPill
                      label="Cancelados"
                      value={stats.canceled}
                      icon={<XCircle className="h-3.5 w-3.5" />}
                      tone="danger"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="flex h-10 items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-3"
                        onClick={() => handleCalendarNavigation("today")}
                      >
                        Hoje
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleCalendarNavigation("prev")}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleCalendarNavigation("next")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex h-10 items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 text-sm text-foreground">
                      <CalendarRange className="h-4 w-4 text-muted-foreground" />
                      <span>{currentTitle || formatRangeLabel(range.startMs, range.endMs)}</span>
                    </div>

                    <Tabs
                      value={currentView}
                      onValueChange={handleCalendarViewChange}
                      className="w-auto"
                    >
                      <TabsList className="h-10 rounded-full bg-muted/35 p-1">
                        <TabsTrigger value="dayGridMonth" className="rounded-full px-3 py-1">
                          Mes
                        </TabsTrigger>
                        <TabsTrigger value="timeGridWeek" className="rounded-full px-3 py-1">
                          Semana
                        </TabsTrigger>
                        <TabsTrigger value="timeGridDay" className="rounded-full px-3 py-1">
                          Dia
                        </TabsTrigger>
                        <TabsTrigger value="listWeek" className="rounded-full px-3 py-1">
                          Lista
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="w-full min-w-[280px] sm:flex-1 sm:max-w-[360px] xl:max-w-[420px]">
                        <Input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Buscar por titulo, local ou observacao"
                          icon={<Search className="h-4 w-4" />}
                          className="h-10 rounded-full border-border/60 bg-background/80 py-2 shadow-none focus:shadow-lg"
                        />
                      </div>

                      <div className="flex h-10 items-center justify-between rounded-full border border-border/60 bg-muted/20 px-3 text-sm sm:min-w-[170px]">
                        <span className="text-muted-foreground">Fim de semana</span>
                        <Switch checked={showWeekends} onCheckedChange={setShowWeekends} />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-border/60 bg-background/80"
                        onClick={handleManualRefresh}
                        disabled={isRefreshing || isLoadingEvents}
                        title="Atualizar compromissos"
                      >
                        <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>

                      {canCreate ? (
                        <Button
                          onClick={() => handleOpenCreateDialog()}
                          className="h-10 rounded-full px-4"
                        >
                          Novo compromisso
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
                      {(["scheduled", "completed", "canceled"] as CalendarEvent["status"][]).map(
                        (status) => {
                          const enabled = statusFilter.includes(status);
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() =>
                                setStatusFilter((current) =>
                                  current.includes(status)
                                    ? current.filter((item) => item !== status)
                                    : [...current, status],
                                )
                              }
                              className={`inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3 text-sm transition ${
                                enabled
                                  ? "cursor-pointer border-primary/30 bg-primary/10 text-primary"
                                  : "cursor-pointer border-border/60 bg-background/80 text-muted-foreground"
                              }`}
                            >
                              {STATUS_LABELS[status]}
                            </button>
                          );
                        },
                      )}
                      {isLoadingEvents ? (
                        <span className="text-sm text-muted-foreground">
                          Atualizando compromissos...
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 px-3 pb-3 pt-2 xl:px-4 xl:pb-4">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                locale={ptBrLocale}
                initialView="dayGridMonth"
                height="100%"
                contentHeight="100%"
                editable={canEdit}
                selectable={canCreate}
                selectMirror
                weekends={showWeekends}
                events={calendarEvents}
                eventContent={renderEventContent}
                datesSet={(arg: DatesSetArg) => {
                  setCurrentView(arg.view.type as CalendarViewType);
                  setCurrentTitle(arg.view.title);
                  setRange({
                    startMs: arg.start.getTime() - 14 * 24 * 60 * 60 * 1000,
                    endMs: arg.end.getTime() + 45 * 24 * 60 * 60 * 1000,
                  });
                }}
                headerToolbar={false}
                buttonText={{
                  today: "Hoje",
                  month: "Mes",
                  week: "Semana",
                  day: "Dia",
                  list: "Lista",
                }}
                dayMaxEvents={3}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                nowIndicator
                select={(selection) => handleOpenCreateDialog(selection)}
                eventClick={(arg: EventClickArg) => {
                  const event = events.find((item) => item.id === arg.event.id);
                  if (event) {
                    handleOpenEditDialog(event);
                  }
                }}
                eventDrop={handleEventMove}
                eventResize={handleEventMove}
              />

              {isLoadingEvents ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/28 backdrop-blur-[1px]">
                  <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/92 px-4 py-2.5 text-sm text-muted-foreground shadow-sm">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Carregando compromissos...
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-border/60 bg-muted/[0.16] xl:w-[360px] xl:border-l xl:border-t-0">
            {GOOGLE_CALENDAR_SYNC_ENABLED ? (
              <div className="shrink-0 border-b border-border/60 px-5 py-4">
                <GoogleCalendarCompanyCard
                  status={googleStatus}
                  isLoading={isLoadingGoogle}
                  isConnecting={isConnectingGoogle}
                  canManage={canManageCompanyCalendar}
                  onConnect={handleGoogleConnect}
                  onDisconnect={handleGoogleDisconnect}
                />
              </div>
            ) : null}
            <div className="min-h-0 flex-1 px-5 py-4">
              <UpcomingEventsCard
                events={upcomingEvents}
                onOpenEvent={handleOpenEditDialog}
              />
            </div>
          </aside>
        </div>
      </Card>

      <CalendarEventDialog
        open={dialogOpen}
        mode={dialogMode}
        values={formValues}
        event={activeEvent}
        canEdit={dialogMode === "create" ? canCreate : canEdit}
        isSubmitting={isSubmitting}
        isDeleting={isDeleting}
        onOpenChange={setDialogOpen}
        onChange={(field, value) =>
          setFormValues((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSubmit={handleSubmitEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
