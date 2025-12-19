"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown } from "lucide-react";

// ============================================
// FORM CONTAINER - Main wrapper for forms
// ============================================

interface FormContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function FormContainer({
  className,
  children,
  ...props
}: FormContainerProps) {
  return (
    <div
      className={cn(
        "w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================
// FORM HEADER - Page title with back button
// ============================================

interface FormHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onBack?: () => void;
  badge?: React.ReactNode;
}

export function FormHeader({
  title,
  subtitle,
  icon: Icon,
  onBack,
  badge,
}: FormHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start gap-5">
        {onBack && (
          <button
            onClick={onBack}
            className="mt-1.5 w-11 h-11 rounded-xl bg-card border border-border/60 flex items-center justify-center hover:bg-muted hover:border-primary/40 transition-all duration-200 group shadow-sm cursor-pointer"
          >
            <svg
              className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {Icon && (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <Icon className="w-7 h-7 text-primary-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FORM SECTION - Card container for form groups
// ============================================

interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function FormSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
  ...props
}: FormSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border/50 bg-card overflow-hidden",
        "shadow-sm hover:shadow-md transition-shadow duration-300",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div
        className={cn(
          "px-6 py-5 border-b border-border/30 bg-gradient-to-r from-muted/50 to-transparent",
          collapsible &&
            "cursor-pointer select-none hover:from-muted/70 transition-colors"
        )}
        onClick={collapsible ? () => setIsOpen(!isOpen) : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {collapsible && (
            <ChevronDown
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          collapsible && !isOpen ? "max-h-0" : "max-h-[2000px]"
        )}
      >
        <div className="p-6 space-y-5">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// FORM GROUP - Row of form fields
// ============================================

interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}

export function FormGroup({
  cols = 2,
  className,
  children,
  ...props
}: FormGroupProps) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-5", gridCols[cols], className)} {...props}>
      {children}
    </div>
  );
}

// ============================================
// FORM ITEM - Label + Input wrapper
// ============================================

interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function FormItem({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
  ...props
}: FormItemProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={htmlFor}
          className={cn(
            "text-sm font-medium text-foreground",
            error && "text-destructive"
          )}
        >
          {label}
          {required && (
            <span className="text-destructive ml-1 text-base">*</span>
          )}
        </label>
        {hint && !error && (
          <span className="text-xs text-muted-foreground/70">{hint}</span>
        )}
      </div>

      {children}

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================
// FORM STATIC - Read-only display field
// ============================================

interface FormStaticProps {
  label: string;
  value?: React.ReactNode;
  placeholder?: string;
}

export function FormStatic({
  label,
  value,
  placeholder = "—",
}: FormStaticProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="h-12 px-4 rounded-xl bg-muted/40 border border-border/30 flex items-center text-sm">
        {value || (
          <span className="text-muted-foreground/50">{placeholder}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// FORM DIVIDER - Visual separator
// ============================================

export function FormDivider({ label }: { label?: string }) {
  if (label) {
    return (
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
      </div>
    );
  }
  return <div className="border-t border-border/50 my-2" />;
}

// ============================================
// FORM ACTIONS - Submit/Cancel buttons
// ============================================

interface FormActionsProps {
  onCancel?: () => void;
  isSubmitting?: boolean;
  isReadOnly?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  submitIcon?: React.ReactNode;
}

export function FormActions({
  onCancel,
  isSubmitting = false,
  isReadOnly = false,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  submitIcon,
}: FormActionsProps) {
  if (isReadOnly) {
    return (
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted transition-all duration-200"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6">
      <button
        type="button"
        onClick={onCancel}
        className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted transition-all duration-200"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          "h-12 px-8 rounded-xl text-sm font-semibold transition-all duration-300",
          "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
          "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
          "hover:scale-[1.02] active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-md",
          "flex items-center justify-center gap-2"
        )}
      >
        {isSubmitting ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Salvando...
          </>
        ) : (
          <>
            {submitIcon}
            {submitLabel}
          </>
        )}
      </button>
    </div>
  );
}
