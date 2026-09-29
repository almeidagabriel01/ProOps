import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FormContainer,
  FormHeaderSkeleton,
} from "@/components/ui/form-components";
import { TeamSkeleton } from "@/app/team/_components/team-skeleton";

/**
 * Loading skeletons for the /settings area. `SettingsShellSkeleton` mirrors
 * `settings/layout.tsx` (title + sidebar + content column) so the protected-route
 * loading state (which renders OUTSIDE the settings layout) matches the loaded
 * page. The section skeletons mirror each sub-route's content.
 */

export function SettingsNavSkeleton() {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-8">
      {/* Navigation card */}
      <div className="rounded-xl border border-border/60 bg-card p-2">
        <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:gap-3 lg:overflow-visible">
          {/* As larguras acompanham o nav real: abaixo de lg os rótulos são
              menores e o de pagamentos é encurtado, senão o esqueleto some do
              formato do conteúdo que chega. */}
          {/* Group "Conta" — 1 item */}
          <div className="flex flex-row gap-1 lg:flex-col lg:gap-0.5">
            <Skeleton className="mx-3 mb-1 hidden h-3 w-14 lg:block" />
            <div className="flex items-center gap-2 px-2 py-2 lg:gap-3 lg:px-3">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-16 lg:w-24" />
            </div>
          </div>
          {/* Group "Organização" — 2 items */}
          <div className="flex flex-row gap-1 lg:flex-col lg:gap-0.5">
            <Skeleton className="mx-3 mb-1 hidden h-3 w-20 lg:block" />
            <div className="flex items-center gap-2 px-2 py-2 lg:gap-3 lg:px-3">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-12 lg:w-16" />
            </div>
            <div className="flex items-center gap-2 px-2 py-2 lg:gap-3 lg:px-3">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-20 lg:w-32" />
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
    <div className="w-full max-w-6xl mx-auto px-0 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-72" />
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
    <Card data-testid="settings-skeleton-security">
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
    <Card data-testid="settings-skeleton-payments">
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

/** Full content skeleton for /settings/team. */
export function SettingsTeamSkeleton() {
  return (
    <div data-testid="settings-skeleton-team" className="contents">
      <TeamSkeleton />
    </div>
  );
}

/**
 * Card-only skeleton for /settings/proposals: header with the master switch,
 * then the code preview box, the two numeric fields and the save button.
 */
export function ProposalNumberingCardSkeleton() {
  return (
    <Card data-testid="settings-skeleton-proposals">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
              <Skeleton className="h-5 w-52" />
            </div>
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-4 w-2/3 max-w-sm" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </CardContent>
    </Card>
  );
}

/** Full content skeleton for /settings/proposals. */
export function SettingsProposalsSkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />
      <ProposalNumberingCardSkeleton />
    </FormContainer>
  );
}

/**
 * Card-only skeleton for /settings/drive: the "Conta Google" card. The folder
 * card only exists once connected, so the skeleton does not promise it.
 */
export function DriveCardsSkeleton() {
  return (
    <div data-testid="settings-skeleton-drive" className="flex flex-col gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-sm" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-52 rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

/** Full content skeleton for /settings/drive. */
export function SettingsDriveSkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />
      <DriveCardsSkeleton />
    </FormContainer>
  );
}

const FISCAL_STEP_COUNT = 4;

/**
 * Card-only skeleton for /settings/fiscal: the StepWizard track (compact bar
 * below sm, four circles joined by a line from sm up) and the first step card
 * ("Dados da empresa"). The status card only exists for a registered issuer.
 */
export function FiscalSettingsSkeleton() {
  return (
    <div data-testid="settings-skeleton-fiscal" className="space-y-2">
      {/* Compact indicator (< sm) */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        </div>
        <Skeleton className="mt-2 h-1 w-full rounded-full" />
      </div>

      {/* Full track (sm+) */}
      <div className="relative hidden sm:flex justify-between">
        <div className="absolute top-6 left-12 right-12 h-0.5 bg-muted" />
        {Array.from({ length: FISCAL_STEP_COUNT }).map((_, i) => (
          <div key={i} className="relative flex flex-col items-center">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="mt-2 h-4 w-20" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Step card, same frame as FormStepCard */}
      <div className="min-h-[32rem] rounded-2xl border border-border/50 bg-card p-3 sm:p-4 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 mt-2">
          <Skeleton className="h-12 flex-1 rounded-xl sm:w-32 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}

/** Full content skeleton for /settings/fiscal. */
export function SettingsFiscalSkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />
      <FiscalSettingsSkeleton />
    </FormContainer>
  );
}

/**
 * Card-only skeleton for /settings/linked-accounts: the "Integrações" card with
 * one row per integration, in the LinkedAccountRow shape.
 */
export function LinkedAccountsCardSkeleton() {
  return (
    <Card data-testid="settings-skeleton-linked-accounts">
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-sm" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-9 w-full shrink-0 rounded-md md:w-28" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Full content skeleton for /settings/linked-accounts. */
export function SettingsLinkedAccountsSkeleton() {
  return (
    <FormContainer>
      <FormHeaderSkeleton />
      <LinkedAccountsCardSkeleton />
    </FormContainer>
  );
}
