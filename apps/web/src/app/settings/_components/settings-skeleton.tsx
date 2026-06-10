import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FormContainer,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";

/**
 * Loading skeletons for the /settings area. `SettingsShellSkeleton` mirrors
 * `settings/layout.tsx` (title + sidebar + content column) so the protected-route
 * loading state (which renders OUTSIDE the settings layout) matches the loaded
 * page. The section skeletons mirror each sub-route's content.
 */

function SettingsNavSkeleton() {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-8">
      {/* Navigation card */}
      <div className="rounded-xl border border-border/60 bg-card p-2">
        <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:gap-3 lg:overflow-visible">
          {/* Group "Conta" — 1 item */}
          <div className="flex flex-row gap-1 lg:flex-col lg:gap-0.5">
            <Skeleton className="mx-3 mb-1 hidden h-3 w-14 lg:block" />
            <div className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          {/* Group "Organização" — 2 items */}
          <div className="flex flex-row gap-1 lg:flex-col lg:gap-0.5">
            <Skeleton className="mx-3 mb-1 hidden h-3 w-20 lg:block" />
            <div className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>

      {/* User identity chip */}
      <div className="hidden items-center gap-3 rounded-xl border border-border/60 bg-card p-3 lg:flex">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </aside>
  );
}

export function SettingsShellSkeleton({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Gerencie sua conta, segurança e preferências.
        </p>
      </div>
      <div className="border-t border-border/60 mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
        <SettingsNavSkeleton />
        <div className="min-w-0 lg:-mt-8">{children}</div>
      </div>
    </div>
  );
}

/**
 * Card-only skeleton for the security section (the "Métodos de verificação"
 * card). Rendered by TwoFactorSection while its status loads — it lives INSIDE
 * the page's FormContainer + FormHeader, so it must not repeat them.
 */
export function SecurityCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-2/3 max-w-sm" />
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 py-5 first:pt-0 last:pb-0"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="space-y-2 pt-0.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Full content skeleton for /settings/security. */
export function SettingsSecuritySkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />
      <SecurityCardSkeleton />
    </FormContainer>
  );
}

/**
 * Card-only skeleton for the payments section (the Asaas connect card).
 * Rendered inside the page's FormContainer + FormHeader.
 */
export function PaymentsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <Skeleton className="h-10 w-44 rounded-md" />
      </CardContent>
    </Card>
  );
}

/** Full content skeleton for /settings/payments. */
export function SettingsPaymentsSkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />
      <PaymentsCardSkeleton />
    </FormContainer>
  );
}
