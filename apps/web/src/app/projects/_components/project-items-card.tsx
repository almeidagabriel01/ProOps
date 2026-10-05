"use client";

import * as React from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader } from "@/components/ui/loader";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { pick } from "@/lib/niches/vocabulary";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ProjectsService } from "@/services/projects-service";
import type { ProjectItem, ProjectItemStatus } from "@/types/project";
import {
  PROJECT_ITEM_STATUSES,
  PROJECT_ITEM_STATUS_ACTIONS,
  PROJECT_ITEM_STATUS_LABELS,
  applyItemOverlay,
  countProjectItems,
  dropFromItemOverlay,
  filterProjectItems,
  formatProjectItemMeasure,
  formatProjectItemQuantity,
  groupProjectItems,
  pruneItemOverlay,
  type ItemStatusOverlay,
  type ProjectItemFilter,
} from "../_lib/project-items";

const STATUS_STYLES: Record<ProjectItemStatus, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  purchase_requested: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  in_stock: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400",
  installed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
};

interface ProjectItemsCardProps {
  projectId: string;
  /** Sem proposta (projeto avulso), não há lista para trazer. */
  proposalId: string | null;
  items: ProjectItem[];
  /** Editar Projetos, fora do modo de demonstração. */
  canEdit: boolean;
}

/**
 * Os produtos da obra, para quem compra e quem instala: cada item com a
 * situação (pendente, compra solicitada, em estoque, instalado). Sem valor
 * nenhum, porque o técnico também usa esta tela. A situação muda na hora e o
 * servidor confirma pelo listener do projeto.
 */
export function ProjectItemsCard({ projectId, proposalId, items: serverItems, canEdit }: ProjectItemsCardProps) {
  const niche = useCurrentNicheConfig();
  const place = niche.vocabulary.place;
  const [overlay, setOverlay] = React.useState<ItemStatusOverlay>({});
  const [filter, setFilter] = React.useState<ProjectItemFilter>("all");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [importing, setImporting] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  React.useEffect(() => {
    setOverlay((o) => pruneItemOverlay(serverItems, o));
    // Item que sumiu da lista também sai da seleção.
    setSelected((current) => {
      const ids = new Set(serverItems.map((i) => i.id));
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [serverItems]);

  const items = React.useMemo(() => applyItemOverlay(serverItems, overlay), [serverItems, overlay]);
  const counts = countProjectItems(items);
  const groups = groupProjectItems(filterProjectItems(items, filter));

  if (serverItems.length === 0 && !proposalId) return null;

  const setStatus = async (ids: string[], status: ProjectItemStatus) => {
    if (ids.length === 0) return;
    setOverlay((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, status])) }));
    try {
      await ProjectsService.updateItemsStatus(projectId, ids, status);
      return true;
    } catch (error) {
      setOverlay((o) => dropFromItemOverlay(o, ids));
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar os itens.");
      return false;
    }
  };

  const applyBulk = async (status: ProjectItemStatus) => {
    setBulkBusy(true);
    const ok = await setStatus([...selected], status);
    setBulkBusy(false);
    if (ok) setSelected(new Set());
  };

  const importItems = async () => {
    setImporting(true);
    try {
      const { count } = await ProjectsService.importItems(projectId);
      if (count === 0) toast.info("A proposta desta obra não tem produtos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao trazer os itens da proposta.");
    } finally {
      setImporting(false);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleGroup = (ids: string[], checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <section aria-label="Itens da obra" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="flex items-center gap-2 font-semibold">
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
            Itens da obra
          </p>
          {counts.total > 0 && (
            <span className="text-sm text-muted-foreground">
              {counts.installed} de {counts.total} instalados, {counts.pending}{" "}
              {counts.pending === 1 ? "pendente" : "pendentes"}
            </span>
          )}
        </div>
        {counts.total > 0 && (
          <Progress value={counts.percent} aria-label={`${counts.percent}% dos itens instalados`} />
        )}
      </div>

      {serverItems.length === 0 ? (
        <div className="space-y-3 rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            A lista de produtos da proposta ainda não está nesta obra.
          </p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => void importItems()} disabled={importing}>
              {importing && <Loader size="sm" variant="button" />}
              {importing ? "Trazendo..." : "Trazer itens da proposta"}
            </Button>
          )}
        </div>
      ) : (
        <>
          <SegmentedControl
            id="Filtrar itens da obra"
            value={filter}
            onChange={(v) => setFilter(v as ProjectItemFilter)}
            options={[
              { value: "all", label: "Todos", count: counts.total },
              { value: "pending", label: "Pendentes", count: counts.pending },
              { value: "installed", label: "Instalados", count: counts.installed },
            ]}
          />

          {canEdit && selected.size > 0 && (
            <div
              role="group"
              aria-label="Ação nos itens selecionados"
              className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <span className="text-sm font-medium">
                {selected.size} {selected.size === 1 ? "item selecionado" : "itens selecionados"}
              </span>
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {PROJECT_ITEM_STATUSES.filter((s) => s !== "pending").map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant="outline"
                    disabled={bulkBusy}
                    onClick={() => void applyBulk(status)}
                  >
                    {PROJECT_ITEM_STATUS_ACTIONS[status]}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filter === "installed" ? "Nenhum item instalado ainda." : "Nenhum item pendente."}
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const ids = group.items.map((i) => i.id);
                const allSelected = ids.every((id) => selected.has(id));
                const heading = group.placeName ?? `Sem ${place.singular} ${pick(place, "definido", "definida")}`;
                return (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <Checkbox
                          checked={allSelected}
                          aria-label={`Selecionar os itens de ${heading}`}
                          onCheckedChange={(checked) => toggleGroup(ids, checked)}
                        />
                      )}
                      <p className="min-w-0 text-sm">
                        {group.groupName && <span className="text-muted-foreground">{group.groupName}: </span>}
                        <span className="font-medium">{heading}</span>
                      </p>
                    </div>
                    <ul className="divide-y rounded-lg border">
                      {group.items.map((item) => {
                        const measure = formatProjectItemMeasure(item, niche.pricing);
                        const details = [item.manufacturer, measure, formatProjectItemQuantity(item.quantity)].filter(
                          Boolean,
                        );
                        return (
                          <li
                            key={item.id}
                            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              {canEdit && (
                                <Checkbox
                                  className="mt-0.5"
                                  checked={selected.has(item.id)}
                                  aria-label={`Selecionar ${item.name}`}
                                  onCheckedChange={(checked) => toggle(item.id, checked)}
                                />
                              )}
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "break-words text-sm font-medium",
                                    item.status === "installed" && "text-muted-foreground",
                                  )}
                                >
                                  {item.name}
                                </p>
                                <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
                              </div>
                            </div>
                            {canEdit ? (
                              <Select
                                aria-label={`Situação de ${item.name}`}
                                value={item.status}
                                onChange={(e) => void setStatus([item.id], e.target.value as ProjectItemStatus)}
                                disableSort
                                className="sm:w-48"
                              >
                                {PROJECT_ITEM_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {PROJECT_ITEM_STATUS_LABELS[status]}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                  STATUS_STYLES[item.status],
                                )}
                              >
                                {PROJECT_ITEM_STATUS_LABELS[item.status]}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
