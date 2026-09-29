"use client";

import * as React from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { describeException, formatMinutes, todayInBrazil } from "@/lib/booking/booking-format";
import type { BookingException } from "@/services/booking-service";

interface BookingExceptionsEditorProps {
  exceptions: BookingException[];
  onChange: (exceptions: BookingException[]) => void;
  readOnly?: boolean;
  /** Expediente, para sugerir a faixa de uma exceção nova. */
  startMin: number;
  endMin: number;
}

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30);

/**
 * Dias e horários em que a empresa não atende: feriado, férias, um compromisso
 * que não está na Agenda. O link de agendamento não oferece horário que encoste
 * neles. O motivo é só para a empresa; o cliente nunca vê.
 */
export function BookingExceptionsEditor({
  exceptions,
  onChange,
  readOnly = false,
  startMin,
  endMin,
}: BookingExceptionsEditorProps) {
  const today = todayInBrazil();
  const update = (index: number, patch: Partial<BookingException>) =>
    onChange(exceptions.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const add = () =>
    onChange([
      ...exceptions,
      { id: "", date: today, allDay: true, startMin: null, endMin: null, note: null },
    ]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Exceções</Label>
        <p className="text-sm text-muted-foreground">
          Dias ou horários em que você não vai atender. O link não oferece esses horários.
        </p>
      </div>

      {exceptions.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <CalendarOff className="h-4 w-4 shrink-0" />
          Nenhuma exceção. Todos os dias do expediente ficam abertos.
        </p>
      ) : (
        <ul className="space-y-3">
          {exceptions.map((exception, index) => {
            const label = describeException(exception);
            return (
              <li key={exception.id || `nova-${index}`} className="space-y-3 rounded-lg border p-3" aria-label={label}>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={`booking-exception-date-${index}`}>Data</Label>
                    <DatePicker
                      id={`booking-exception-date-${index}`}
                      name={`booking-exception-date-${index}`}
                      value={exception.date}
                      clearable={false}
                      disabled={readOnly}
                      onChange={(e) => update(index, { date: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      id={`booking-exception-allday-${index}`}
                      checked={exception.allDay}
                      disabled={readOnly}
                      onCheckedChange={(allDay) =>
                        update(
                          index,
                          allDay
                            ? { allDay, startMin: null, endMin: null }
                            : { allDay, startMin: startMin, endMin: Math.min(startMin + 120, endMin) },
                        )
                      }
                    />
                    <Label htmlFor={`booking-exception-allday-${index}`} className="text-sm font-normal">
                      Dia inteiro
                    </Label>
                  </div>
                </div>

                {!exception.allDay && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`booking-exception-start-${index}`}>Das</Label>
                      <Select
                        id={`booking-exception-start-${index}`}
                        value={String(exception.startMin ?? startMin)}
                        disabled={readOnly}
                        disableSort
                        onChange={(e) => update(index, { startMin: Number(e.target.value) })}
                      >
                        {TIME_OPTIONS.slice(0, -1).map((m) => (
                          <option key={m} value={m}>
                            {formatMinutes(m)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`booking-exception-end-${index}`}>Até</Label>
                      <Select
                        id={`booking-exception-end-${index}`}
                        value={String(exception.endMin ?? endMin)}
                        disabled={readOnly}
                        disableSort
                        onChange={(e) => update(index, { endMin: Number(e.target.value) })}
                      >
                        {TIME_OPTIONS.slice(1).map((m) => (
                          <option key={m} value={m}>
                            {formatMinutes(m)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={`booking-exception-note-${index}`}>Motivo (só você vê)</Label>
                    <Input
                      id={`booking-exception-note-${index}`}
                      value={exception.note ?? ""}
                      maxLength={80}
                      placeholder="Feriado, férias, treinamento..."
                      disabled={readOnly}
                      onChange={(e) => update(index, { note: e.target.value || null })}
                    />
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover a exceção de ${label}`}
                      onClick={() => onChange(exceptions.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && exceptions.length < 100 && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar exceção
        </Button>
      )}
    </div>
  );
}
