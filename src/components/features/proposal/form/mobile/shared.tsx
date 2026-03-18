"use client";

import * as React from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Proposal } from "@/services/proposal-service";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Tone = "default" | "accent" | "success" | "warning";

const toneClasses: Record<Tone, string> = {
  default: "border-border/60 bg-card",
  accent:
    "border-sky-500/25 bg-linear-to-br from-sky-500/10 via-cyan-500/6 to-card",
  success:
    "border-emerald-500/25 bg-linear-to-br from-emerald-500/10 via-teal-500/6 to-card",
  warning:
    "border-amber-500/25 bg-linear-to-br from-amber-500/12 via-orange-500/6 to-card",
};

const iconToneClasses: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  accent: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
};

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatDateLabel(value?: string) {
  if (!value) return "Nao definido";

  const normalized = value.includes("T") ? value : `${value}T12:00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return "Nao definido";
  }

  return date.toLocaleDateString("pt-BR");
}

export function getProposalDownPaymentValue(
  formData: Partial<Proposal>,
  totalValue: number,
) {
  const downPaymentType = formData.downPaymentType || "value";
  const downPaymentPercentage = formData.downPaymentPercentage || 0;

  return downPaymentType === "percentage"
    ? (totalValue * downPaymentPercentage) / 100
    : formData.downPaymentValue || 0;
}

interface MobilePanelProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function MobilePanel({
  title,
  description,
  eyebrow,
  icon: Icon,
  tone = "default",
  className,
  bodyClassName,
  children,
}: MobilePanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]",
        toneClasses[tone],
        className,
      )}
    >
      <div className="border-b border-border/50 px-4 py-4">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                iconToneClasses[tone],
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          ) : null}

          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h3 className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn("space-y-4 px-4 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

interface MobileMetricProps {
  label: string;
  value: string;
  hint?: string;
  accent?: "sky" | "emerald" | "amber" | "slate";
  className?: string;
}

const metricAccentClasses = {
  slate: "border-border/60 bg-background/70",
  sky: "border-sky-500/20 bg-sky-500/8",
  emerald: "border-emerald-500/20 bg-emerald-500/8",
  amber: "border-amber-500/20 bg-amber-500/10",
};

export function MobileMetric({
  label,
  value,
  hint,
  accent = "slate",
  className,
}: MobileMetricProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        metricAccentClasses[accent],
        className,
      )}
    >
      <p className="break-words text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface MobileToggleCardProps {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: LucideIcon;
}

export function MobileToggleCard({
  title,
  description,
  checked,
  onCheckedChange,
  icon: Icon,
}: MobileToggleCardProps) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all",
        checked
          ? "border-primary/30 bg-primary/8 shadow-[0_14px_35px_-28px_rgba(14,165,233,0.9)]"
          : "border-border/60 bg-background/70",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border/70 bg-background text-muted-foreground",
        )}
      >
        {checked ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-3.5 w-3.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}
      </div>
    </button>
  );
}

interface MobileDisclosureProps {
  title: string;
  description?: string;
  meta?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function MobileDisclosure({
  title,
  description,
  meta,
  defaultOpen = false,
  className,
  children,
}: MobileDisclosureProps) {
  return (
    <details
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/60 bg-background/70",
        className,
      )}
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {title}
          </p>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {meta}
            </span>
          ) : null}
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-transform duration-200 group-open:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </span>
        </div>
      </summary>

      <div className="border-t border-border/60 px-4 py-4">{children}</div>
    </details>
  );
}

export function MobileFieldShell({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
          {required ? " *" : ""}
        </label>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function MobileEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
        {description}
      </p>
    </div>
  );
}
