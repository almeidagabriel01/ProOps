"use client";

import * as React from "react";
import { Clock3 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import {
  VISIT_DURATIONS,
  formatDuration,
  scheduleFormFrom,
  toScheduleInput,
  type ScheduleFormValues,
} from "@/lib/projects/stage-schedule";
import { ProjectsService } from "@/services/projects-service";
import type { ProjectStage } from "@/types/project";

interface StageScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stage: ProjectStage;
  /** Quem cuida da obra, para dizer que será avisado. */
  assigneeName: string | null;
}

/**
 * Marca (ou remarca) a visita de uma etapa. Vira um evento na Agenda, com o
 * endereço da obra e o link para ela; a data que a obra mostra vem de volta
 * pelo listener do projeto.
 */
export function StageScheduleDialog({ open, onOpenChange, projectId, stage, assigneeName }: StageScheduleDialogProps) {
  const [values, setValues] = React.useState<ScheduleFormValues>(() => scheduleFormFrom(stage.schedule));
  const [saving, setSaving] = React.useState(false);
  const rescheduling = Boolean(stage.schedule);

  React.useEffect(() => {
    if (open) setValues(scheduleFormFrom(stage.schedule));
  }, [open, stage.schedule]);

  const input = toScheduleInput(values);
  const durations = VISIT_DURATIONS.includes(values.durationMin as (typeof VISIT_DURATIONS)[number])
    ? VISIT_DURATIONS
    : [...VISIT_DURATIONS, values.durationMin].sort((a, b) => a - b);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input) return;
    setSaving(true);
    try {
      await ProjectsService.scheduleStage(projectId, stage.id, input);
      toast.success(rescheduling ? "Visita remarcada na Agenda." : "Visita marcada na Agenda.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao marcar a visita.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rescheduling ? "Remarcar" : "Marcar"} {stage.name}</DialogTitle>
          <DialogDescription>
            A visita entra na Agenda com o endereço da obra
            {assigneeName ? `, e ${assigneeName} recebe um aviso.` : "."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stageScheduleDate">Data</Label>
            <DatePicker
              id="stageScheduleDate"
              name="stageScheduleDate"
              value={values.date}
              clearable={false}
              onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="stageScheduleAllDay" className="text-sm">
              Dia inteiro
            </Label>
            <Switch
              id="stageScheduleAllDay"
              checked={values.isAllDay}
              onCheckedChange={(checked) => setValues((v) => ({ ...v, isAllDay: checked }))}
              disabled={saving}
            />
          </div>

          {!values.isAllDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stageScheduleTime">Início</Label>
                <Input
                  id="stageScheduleTime"
                  type="time"
                  value={values.time}
                  onChange={(e) => setValues((v) => ({ ...v, time: e.target.value }))}
                  icon={<Clock3 className="h-4 w-4" />}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stageScheduleDuration">Duração</Label>
                <Select
                  id="stageScheduleDuration"
                  value={String(values.durationMin)}
                  onChange={(e) => setValues((v) => ({ ...v, durationMin: Number(e.target.value) }))}
                  disableSort
                  disabled={saving}
                >
                  {durations.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {formatDuration(minutes)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !input}>
              {saving && <Loader size="sm" variant="button" className="mr-2" />}
              {rescheduling ? "Remarcar" : "Marcar na Agenda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
