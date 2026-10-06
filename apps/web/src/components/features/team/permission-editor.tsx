"use client";

import * as React from "react";
import { ChevronDown, Edit3, Eye, EyeOff, Lock, Search, Trash2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import { PERMISSION_AREAS, type PermissionExtra, type PermissionPageDef } from "@/lib/permissions/catalog";
import {
  PERMISSION_PAGES,
  getPermissionPageName,
  type MemberPermissions,
} from "@/lib/permissions/pages";
import { effectiveScope, effectiveValue, matchesPermissionSearch } from "@/lib/permissions/editor";
import { PermissionToggle } from "./permission-toggle";

export interface PermissionEditorProps {
  permissions: MemberPermissions;
  onChange: (pageId: string, key: string, value: boolean | string) => void;
  hasFinancial: boolean;
  disabled?: boolean;
  /** `${pageId}-${chave}` da gravação em andamento. */
  busyKey?: string | null;
}

/**
 * O editor de permissões de um membro, igual na criação e na edição: páginas
 * agrupadas por área, com busca, as quatro ações e, em "Mais opções", as ações
 * finas, os dados sensíveis e o alcance ("só os meus").
 *
 * Cada chave mostra o valor EFETIVO (com o fallback do catálogo): o dono vê o
 * que o membro pode hoje, mesmo numa chave que nunca foi gravada.
 */
export function PermissionEditor({ permissions, onChange, hasFinancial, disabled, busyKey }: PermissionEditorProps) {
  const { tenant } = useTenant();
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const name = React.useCallback(
    (page: PermissionPageDef) => getPermissionPageName(page, tenant?.niche),
    [tenant?.niche],
  );
  const visible = PERMISSION_PAGES.filter((page) => matchesPermissionSearch(page, name(page), search));
  const searching = search.trim().length > 0;

  const toggleExpanded = (pageId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar permissão (ex.: desconto, estoque, comissão)"
          aria-label="Buscar permissão"
          className="pl-9"
        />
      </div>

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma permissão encontrada.</p>
      )}

      {PERMISSION_AREAS.map((area) => {
        const pages = visible.filter((page) => page.area === area.id);
        if (pages.length === 0) return null;
        return (
          <section key={area.id} className="space-y-2" aria-label={area.label}>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{area.label}</h5>
            {pages.map((page) => (
              <PagePermissionCard
                key={page.id}
                page={page}
                pageName={name(page)}
                doc={permissions[page.id]}
                onChange={(key, value) => onChange(page.id, key, value)}
                locked={Boolean(page.requiresFinancial && !hasFinancial)}
                disabled={disabled}
                busyKey={busyKey}
                expanded={searching || expanded.has(page.id)}
                onToggleExpanded={() => toggleExpanded(page.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

interface PagePermissionCardProps {
  page: PermissionPageDef;
  pageName: string;
  doc: MemberPermissions[string] | undefined;
  onChange: (key: string, value: boolean | string) => void;
  locked: boolean;
  disabled?: boolean;
  busyKey?: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}

function PagePermissionCard({
  page,
  pageName,
  doc,
  onChange,
  locked,
  disabled,
  busyKey,
  expanded,
  onToggleExpanded,
}: PagePermissionCardProps) {
  const value = (key: string) => effectiveValue(page.id, doc, key);
  const canView = value("canView");
  const busy = (key: string) => busyKey === `${page.id}-${key}`;
  const blocked = disabled || locked;
  const actions = page.extras.filter((extra) => extra.kind === "action");
  const data = page.extras.filter((extra) => extra.kind === "data");
  const optionCount = page.extras.length + (page.scope ? 1 : 0);

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        canView && !locked ? "border-border bg-card" : "border-transparent bg-muted/30",
      )}
      data-permission-page={page.id}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-start gap-3 sm:flex-1">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              canView && !locked ? "bg-primary/10" : "bg-muted",
            )}
          >
            {locked ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : canView ? (
              <Eye className="h-5 w-5 text-primary" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className={cn("font-medium", !canView && "text-muted-foreground")}>{pageName}</p>
            <p className="text-xs text-muted-foreground">
              {locked ? "O plano da empresa não inclui o financeiro." : page.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end">
          <PermissionToggle
            enabled={canView}
            onChange={(v) => onChange("canView", v)}
            label="Ver"
            icon={Eye}
            disabled={blocked}
            loading={busy("canView")}
          />
          {!page.viewOnly && (
            <>
              <PermissionToggle
                enabled={value("canCreate")}
                onChange={(v) => onChange("canCreate", v)}
                label="Criar"
                icon={UserPlus}
                disabled={blocked || !canView}
                loading={busy("canCreate")}
              />
              <PermissionToggle
                enabled={value("canEdit")}
                onChange={(v) => onChange("canEdit", v)}
                label="Editar"
                icon={Edit3}
                disabled={blocked || !canView}
                loading={busy("canEdit")}
              />
              <PermissionToggle
                enabled={value("canDelete")}
                onChange={(v) => onChange("canDelete", v)}
                label="Excluir"
                icon={Trash2}
                disabled={blocked || !canView}
                loading={busy("canDelete")}
              />
            </>
          )}
        </div>
      </div>

      {optionCount > 0 && !locked && (
        <div className="border-t border-border/50">
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground sm:px-4"
          >
            Mais opções ({optionCount})
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
          {expanded && (
            <div className="space-y-4 px-3 pb-4 sm:px-4">
              {page.scope && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Alcance</p>
                  <Select
                    aria-label={`Alcance em ${pageName}`}
                    value={effectiveScope(page.id, doc) ?? page.scope.default}
                    onChange={(e) => onChange("scope", e.target.value)}
                    disabled={blocked || !canView || busy("scope")}
                    disableSort
                  >
                    {page.scope.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {page.scope.options.find((o) => o.value === (effectiveScope(page.id, doc) ?? page.scope!.default))
                      ?.description}
                  </p>
                </div>
              )}
              {actions.length > 0 && (
                <ExtraGroup
                  title="Ações"
                  extras={actions}
                  value={value}
                  onChange={onChange}
                  disabled={blocked || !canView}
                  busy={busy}
                />
              )}
              {data.length > 0 && (
                <ExtraGroup
                  title="O que ele vê"
                  hint="Vale em todas as telas onde o dado aparece, mesmo sem acesso a esta página."
                  extras={data}
                  value={value}
                  onChange={onChange}
                  disabled={blocked}
                  busy={busy}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ExtraGroupProps {
  title: string;
  hint?: string;
  extras: readonly PermissionExtra[];
  value: (key: string) => boolean;
  onChange: (key: string, value: boolean) => void;
  disabled?: boolean;
  busy: (key: string) => boolean;
}

function ExtraGroup({ title, hint, extras, value, onChange, disabled, busy }: ExtraGroupProps) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
        {extras.map((extra) => (
          <li key={extra.key} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{extra.label}</p>
              <p className="text-xs text-muted-foreground">{extra.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              {busy(extra.key) && <Loader size="sm" />}
              <Switch
                aria-label={extra.label}
                checked={value(extra.key)}
                onCheckedChange={(checked) => onChange(extra.key, checked)}
                disabled={disabled || busy(extra.key)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
