"use client";

import * as React from "react";
import {
  Clock3,
  MapPin,
  NotebookPen,
  Palette,
  Trash2,
  Type,
} from "lucide-react";
import { Loader } from "@/components/ui/loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { isGoogleCalendarSyncEnabled } from "@/lib/google-calendar-feature";
import type {
  CalendarEvent,
  CalendarEventFormValues,
  CalendarEventPayload,
} from "@/types/calendar";

const COLOR_OPTIONS = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#ea580c",
  "#e11d48",
  "#0891b2",
];

const GOOGLE_CALENDAR_SYNC_ENABLED = isGoogleCalendarSyncEnabled();

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function toLocalDateTimeInputValue(isoValue?: string | null): string {
  if (!isoValue) return "";
  const date = new Date(isoValue);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDatePartFromLocalDateTime(value: string): string {
  return value.includes("T") ? value.slice(0, 10) : "";
}

function getTimePartFromLocalDateTime(value: string): string {
  return value.includes("T") ? value.slice(11, 16) : "";
}

function mergeLocalDateAndTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

export function createEmptyCalendarFormValues(): CalendarEventFormValues {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  const end = new Date(rounded);
  end.setHours(end.getHours() + 1);

  const startDate = `${rounded.getFullYear()}-${String(rounded.getMonth() + 1).padStart(2, "0")}-${String(
    rounded.getDate(),
  ).padStart(2, "0")}`;

  return {
    title: "",
    description: "",
    location: "",
    status: "scheduled",
    color: COLOR_OPTIONS[0],
    isAllDay: false,
    startsAt: toLocalDateTimeInputValue(rounded.toISOString()),
    endsAt: toLocalDateTimeInputValue(end.toISOString()),
    startDate,
    endDate: addDays(startDate, 1),
  };
}

export function buildCalendarFormValuesFromEvent(
  event: CalendarEvent,
): CalendarEventFormValues {
  return {
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    status: event.status,
    color: event.color,
    isAllDay: event.isAllDay,
    startsAt: toLocalDateTimeInputValue(event.startsAt),
    endsAt: toLocalDateTimeInputValue(event.endsAt),
    startDate: event.startDate || "",
    endDate:
      event.endDate || (event.startDate ? addDays(event.startDate, 1) : ""),
  };
}

export function buildCalendarPayloadFromForm(
  values: CalendarEventFormValues,
): CalendarEventPayload {
  if (values.isAllDay) {
    const startDate = values.startDate;
    const endDate = values.endDate || addDays(startDate, 1);

    return {
      title: values.title.trim(),
      description: values.description.trim() || null,
      location: values.location.trim() || null,
      status: values.status,
      color: values.color,
      isAllDay: true,
      startDate,
      endDate,
      startsAt: null,
      endsAt: null,
    };
  }

  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    location: values.location.trim() || null,
    status: values.status,
    color: values.color,
    isAllDay: false,
    startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
    endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
    startDate: null,
    endDate: null,
  };
}

interface CalendarEventDialogProps {
  open: boolean;
  mode: "create" | "edit";
  values: CalendarEventFormValues;
  event?: CalendarEvent | null;
  canEdit: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (
    field: keyof CalendarEventFormValues,
    value: string | boolean,
  ) => void;
  onSubmit: () => void;
  onDelete: () => void;
}

export function CalendarEventDialog({
  open,
  mode,
  values,
  event,
  canEdit,
  isSubmitting,
  isDeleting,
  onOpenChange,
  onChange,
  onSubmit,
  onDelete,
}: CalendarEventDialogProps) {
  const googleStatusLabel = GOOGLE_CALENDAR_SYNC_ENABLED && event?.googleSync
    ? event.googleSync.status === "synced"
      ? "Sincronizado"
      : event.googleSync.status === "error"
        ? "Falha no sync"
        : event.googleSync.status === "removed"
          ? "Removido do Google"
          : "Sem sync"
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border-border/60 p-0">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-sky-500/10 via-transparent to-emerald-500/10 px-6 pt-6 pb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl">
                {mode === "create" ? "Novo compromisso" : "Editar compromisso"}
              </DialogTitle>
              <DialogDescription className="mt-2">
                {GOOGLE_CALENDAR_SYNC_ENABLED
                  ? "Organize compromissos, marque o status e mantenha o Google Agenda em sincronia quando estiver conectado."
                  : "Organize compromissos, marque o status e mantenha a agenda operacional atualizada em um fluxo local."}
              </DialogDescription>
            </div>
            {googleStatusLabel ? (
              <Badge
                variant={
                  event?.googleSync.status === "error"
                    ? "destructive"
                    : event?.googleSync.status === "synced"
                      ? "success"
                      : "outline"
                }
              >
                {googleStatusLabel}
              </Badge>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="field-gap">
                <label className="text-sm font-medium text-foreground/90">
                  Titulo
                </label>
                <Input
                  value={values.title}
                  onChange={(event) => onChange("title", event.target.value)}
                  placeholder="Ex: Visita tecnica na obra"
                  icon={<Type className="h-4 w-4" />}
                  disabled={!canEdit || isSubmitting}
                />
              </div>
            </div>

            <div className="field-gap">
              <label className="text-sm font-medium text-foreground/90">
                Status
              </label>
              <Select
                value={values.status}
                onChange={(event) => onChange("status", event.target.value)}
                disabled={!canEdit || isSubmitting}
              >
                <option value="scheduled">Agendado</option>
                <option value="completed">Concluido</option>
                <option value="canceled">Cancelado</option>
              </Select>
            </div>

            <div className="field-gap">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Dia inteiro</p>
                  <p className="text-xs text-muted-foreground">
                    Use para compromissos sem horario especifico.
                  </p>
                </div>
                <Switch
                  checked={values.isAllDay}
                  onCheckedChange={(checked) => onChange("isAllDay", checked)}
                  disabled={!canEdit || isSubmitting}
                />
              </div>
            </div>

            {values.isAllDay ? (
              <>
                <div className="field-gap">
                  <label className="text-sm font-medium text-foreground/90">
                    Data inicial
                  </label>
                  <DatePicker
                    id="calendarStartDate"
                    name="calendarStartDate"
                    value={values.startDate}
                    onChange={(event) => onChange("startDate", event.target.value)}
                    disabled={!canEdit || isSubmitting}
                  />
                </div>
                <div className="field-gap">
                  <label className="text-sm font-medium text-foreground/90">
                    Data final
                  </label>
                  <DatePicker
                    id="calendarEndDate"
                    name="calendarEndDate"
                    value={values.endDate}
                    onChange={(event) => onChange("endDate", event.target.value)}
                    disabled={!canEdit || isSubmitting}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2 field-gap">
                  <label className="text-sm font-medium text-foreground/90">
                    Inicio
                  </label>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                    <div className="min-w-0">
                      <DatePicker
                        id="calendarStartsAtDate"
                        name="calendarStartsAtDate"
                        value={getDatePartFromLocalDateTime(values.startsAt)}
                        onChange={(event) =>
                          onChange(
                            "startsAt",
                            mergeLocalDateAndTime(
                              event.target.value,
                              getTimePartFromLocalDateTime(values.startsAt),
                            ),
                          )
                        }
                        disabled={!canEdit || isSubmitting}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        type="time"
                        value={getTimePartFromLocalDateTime(values.startsAt)}
                        onChange={(event) =>
                          onChange(
                            "startsAt",
                            mergeLocalDateAndTime(
                              getDatePartFromLocalDateTime(values.startsAt),
                              event.target.value,
                            ),
                          )
                        }
                        icon={<Clock3 className="h-4 w-4" />}
                        disabled={!canEdit || isSubmitting}
                      />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2 field-gap">
                  <label className="text-sm font-medium text-foreground/90">
                    Fim
                  </label>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                    <div className="min-w-0">
                      <DatePicker
                        id="calendarEndsAtDate"
                        name="calendarEndsAtDate"
                        value={getDatePartFromLocalDateTime(values.endsAt)}
                        onChange={(event) =>
                          onChange(
                            "endsAt",
                            mergeLocalDateAndTime(
                              event.target.value,
                              getTimePartFromLocalDateTime(values.endsAt),
                            ),
                          )
                        }
                        disabled={!canEdit || isSubmitting}
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        type="time"
                        value={getTimePartFromLocalDateTime(values.endsAt)}
                        onChange={(event) =>
                          onChange(
                            "endsAt",
                            mergeLocalDateAndTime(
                              getDatePartFromLocalDateTime(values.endsAt),
                              event.target.value,
                            ),
                          )
                        }
                        icon={<Clock3 className="h-4 w-4" />}
                        disabled={!canEdit || isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="md:col-span-2 field-gap">
              <label className="text-sm font-medium text-foreground/90">
                Local
              </label>
              <Input
                value={values.location}
                onChange={(event) => onChange("location", event.target.value)}
                placeholder="Cliente, showroom, escritorio..."
                icon={<MapPin className="h-4 w-4" />}
                disabled={!canEdit || isSubmitting}
              />
            </div>

            <div className="md:col-span-2 field-gap">
              <label className="text-sm font-medium text-foreground/90">
                Observacoes
              </label>
              <Textarea
                value={values.description}
                onChange={(event) => onChange("description", event.target.value)}
                placeholder="Anote briefing, contexto, documentos ou detalhes importantes."
                disabled={!canEdit || isSubmitting}
              />
            </div>

            <div className="md:col-span-2 field-gap">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground/90">
                <Palette className="h-4 w-4" />
                Cor do compromisso
              </div>
              <div className="flex flex-wrap gap-3">
                {COLOR_OPTIONS.map((color) => {
                  const isActive = values.color === color;

                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onChange("color", color)}
                      disabled={!canEdit || isSubmitting}
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
                        isActive
                          ? "scale-105 border-foreground/25 shadow-lg"
                          : "border-border/60 hover:scale-[1.02]"
                      }`}
                      aria-label={`Selecionar cor ${color}`}
                    >
                      <span
                        className="h-6 w-6 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {GOOGLE_CALENDAR_SYNC_ENABLED && event?.googleSync?.lastError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Ultimo erro de sincronizacao: {event.googleSync.lastError}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <NotebookPen className="h-4 w-4" />
            {canEdit
              ? GOOGLE_CALENDAR_SYNC_ENABLED
                ? "Clique em salvar para atualizar o calendario e o Google Agenda."
                : "Clique em salvar para atualizar o calendario."
              : "Modo somente leitura."}
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" && canEdit ? (
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isDeleting || isSubmitting}
              >
                {isDeleting ? (
                  <Loader size="sm" variant="button" className="mr-2" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {isDeleting ? "Excluindo..." : "Excluir"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isDeleting}
            >
              Fechar
            </Button>
            {canEdit ? (
              <Button onClick={onSubmit} disabled={isSubmitting || isDeleting}>
                {isSubmitting ? "Salvando..." : "Salvar compromisso"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
