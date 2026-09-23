"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TenantBillingInfo, AdminService } from "@/services/admin-service";
import { canAccessTenantPanel } from "@/lib/tenant-panel-access";
import { toast } from "@/lib/toast";
import {
  LogIn,
  Trash2,
  Pencil,
  ShieldOff,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
  Copy,
  Power,
  RotateCcw,
  Ban,
  LayoutGrid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateBR } from "@/utils/date-format";
import { formatLastSeen, daysSinceLastSeen } from "@/lib/last-seen-format";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";

interface TenantCardProps {
  item: TenantBillingInfo;
  onEdit: (data: TenantBillingInfo) => void;
  onDeactivate: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
  onPurge: (id: string, confirmName: string) => Promise<void>;
  onLoginAs: (item: TenantBillingInfo) => void;
  onCopy?: (data: TenantBillingInfo) => void;
  onManageModules?: (data: TenantBillingInfo) => void;
}

export function TenantCard({
  item,
  onEdit,
  onDeactivate,
  onReactivate,
  onPurge,
  onLoginAs,
  onCopy,
  onManageModules,
}: TenantCardProps) {
  const { tenant, planName, subscriptionStatus, billingInterval, admin, isBillingStale } = item;
  const isFreePlan = item.planId === "free";
  const accountStatus = tenant.accountStatus || "active";
  const isDeactivated = accountStatus === "deactivated";
  const isPurging = accountStatus === "purging" || accountStatus === "purged";
  const canAccessPanel = canAccessTenantPanel(item) && accountStatus === "active";
  // Empresa sumida (ou que nunca entrou) fica destacada: é o sinal que o
  // contador de propostas não dá, porque ele nunca volta a zero.
  const lastSeenDays = daysSinceLastSeen(tenant.lastSeenAt);
  const currentPeriodEnd = admin.currentPeriodEnd;
  const isStaleWithNoDate = isBillingStale && !currentPeriodEnd;

  let formattedBillingDate: string;
  if (currentPeriodEnd) {
    const [yyyy, mm, dd] = currentPeriodEnd.split("T")[0].split("-");
    formattedBillingDate = `${dd}/${mm}/${yyyy}`;
  } else if (isFreePlan) {
    formattedBillingDate = "—";
  } else {
    formattedBillingDate = "Não disponível";
  }

  // `subscriptionStatus` here is the already-derived display status enum
  // (SubscriptionDisplayStatus), computed once by the backend on load and by the
  // onSnapshot listener on refresh via the shared deriveSubscriptionDisplayStatus.
  // Consumers must NOT re-derive it (re-deriving "canceling" would fall back to
  // "active"). The card just maps the enum to UI.
  const displayStatus = subscriptionStatus;
  const isActive = displayStatus === "active";
  const isTrialing = displayStatus === "trialing";
  const isPastDue = displayStatus === "past_due";
  const isCanceled = displayStatus === "canceled";
  const isInactive = displayStatus === "inactive";
  // Ativo mas com cancelamento agendado para o fim do período
  const isCancelingAtPeriodEnd = displayStatus === "canceling";

  function cardBorderClass() {
    if (isPastDue) return "border-red-500 ring-1 ring-red-500/20";
    if (isCancelingAtPeriodEnd) return "border-amber-400 ring-1 ring-amber-400/20";
    if (isCanceled) return "border-slate-400 ring-1 ring-slate-300/30";
    if (isInactive) return "border-slate-300 ring-1 ring-slate-200/20 opacity-80";
    return "";
  }

  function cardBorderTopColor() {
    if (isPastDue || isCancelingAtPeriodEnd || isCanceled || isInactive) return undefined;
    return tenant.primaryColor;
  }

  // Controlled dialog state
  const [openDialog, setOpenDialog] = useState<"deactivate" | "purge" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isResetMfaDialogOpen, setIsResetMfaDialogOpen] = useState(false);
  const [isResettingMfa, setIsResettingMfa] = useState(false);

  const runLifecycle = async (action: () => Promise<void>) => {
    setIsDeleting(true);
    try {
      await action();
      setOpenDialog(null);
      setConfirmName("");
    } catch {
      // O toast de erro sai do hook; o dialogo fica aberto para tentar de novo.
    } finally {
      setIsDeleting(false);
    }
  };

  const nameMatches =
    confirmName.trim().toLowerCase() === tenant.name.trim().toLowerCase();

  const handleResetMfa = async () => {
    setIsResettingMfa(true);
    try {
      await AdminService.resetMemberMfa(admin.id);
      toast.success("Verificação em dois fatores do admin redefinida.");
      setIsResetMfaDialogOpen(false);
    } catch {
      toast.error("Erro ao resetar MFA. Tente novamente.");
    } finally {
      setIsResettingMfa(false);
    }
  };

  return (
    <Card
      className={`overflow-hidden border-t-4 hover:shadow-md transition-shadow group flex flex-col ${cardBorderClass()}`}
      style={{ borderTopColor: cardBorderTopColor() }}
    >
      {/* Banner de estado crítico — visível sem hover */}
      {(isDeactivated || isPurging) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Ban className="w-3 h-3 shrink-0" />
          {isPurging ? "Exclusão em andamento" : "Empresa desativada"}
        </div>
      )}
      {!isDeactivated && !isPurging && (isCancelingAtPeriodEnd || isCanceled || isInactive) && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
            isCancelingAtPeriodEnd
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              : isCanceled
                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"
          }`}
        >
          {isCancelingAtPeriodEnd && (
            <>
              <Clock className="w-3 h-3 shrink-0" />
              Cancela em {formattedBillingDate}
            </>
          )}
          {isCanceled && (
            <>
              <XCircle className="w-3 h-3 shrink-0" />
              Assinatura cancelada
            </>
          )}
          {isInactive && (
            <>
              <MinusCircle className="w-3 h-3 shrink-0" />
              Conta inativa
            </>
          )}
        </div>
      )}

      <CardHeader className="pb-2 pt-6">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border p-1">
            {tenant.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={tenant.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">
                {tenant.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(item)}
              disabled={isDeleting}
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            {onManageModules && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onManageModules(item)}
                disabled={isDeleting}
                title="Plano e módulos"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            )}
            {onCopy && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-brand"
                onClick={() => onCopy(item)}
                disabled={isDeleting}
                title="Clonar Dados (Produtos, Serviços, etc)"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-amber-600"
              onClick={() => setIsResetMfaDialogOpen(true)}
              disabled={isDeleting || isResettingMfa}
              title="Resetar verificação em dois fatores do admin"
            >
              <ShieldOff className="w-4 h-4" />
            </Button>
            {isDeactivated ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                  onClick={() => runLifecycle(() => onReactivate(tenant.id))}
                  disabled={isDeleting}
                  title="Reativar empresa"
                >
                  {isDeleting ? <Loader size="sm" /> : <RotateCcw className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setOpenDialog("purge")}
                  disabled={isDeleting}
                  title="Excluir definitivamente"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              !isPurging && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => setOpenDialog("deactivate")}
                  disabled={isDeleting}
                  title="Desativar empresa"
                >
                  <Power className="w-4 h-4" />
                </Button>
              )
            )}
          </div>
        </div>
        <div className="mt-4">
          <h3
            className="font-bold text-lg leading-tight truncate"
            title={tenant.name}
          >
            {tenant.name}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={isActive ? "default" : "secondary"}
              className="text-[10px] h-5 px-1.5 capitalize"
            >
              {planName}
            </Badge>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-muted">
              {billingInterval === "yearly" ? "Anual" : "Mensal"}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            {isCanceled ? (
              <XCircle className="w-3 h-3 text-red-400" />
            ) : isInactive ? (
              <MinusCircle className="w-3 h-3 text-slate-400" />
            ) : isCancelingAtPeriodEnd ? (
              <Clock className="w-3 h-3 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            )}
            Status
          </span>
          <span
            className={`font-medium ${
              isCanceled
                ? "text-red-500"
                : isInactive
                  ? "text-slate-400"
                  : isCancelingAtPeriodEnd
                    ? "text-amber-600 dark:text-amber-400"
                    : isPastDue
                      ? "text-red-600"
                      : isActive
                        ? "text-emerald-600"
                        : isTrialing
                          ? "text-sky-600"
                          : "text-muted-foreground"
            }`}
          >
            {isCanceled
              ? "Cancelado"
              : isInactive
                ? "Inativo"
                : isCancelingAtPeriodEnd
                  ? "Encerrando"
                  : isPastDue
                    ? "Atrasado"
                    : isActive
                      ? "Ativo"
                      : isTrialing
                        ? "Em teste"
                        : displayStatus === "free"
                        ? "Gratuito"
                        : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Calendar
              className={`w-3 h-3 ${isPastDue ? "text-red-500" : isCancelingAtPeriodEnd ? "text-amber-500" : ""}`}
            />
            {isCancelingAtPeriodEnd ? "Encerra em" : "Vencimento"}
          </span>
          <div className="flex items-center gap-2">
            {isStaleWithNoDate ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <span
                className={`font-medium ${
                  isPastDue
                    ? "text-red-600"
                    : isCancelingAtPeriodEnd
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-foreground"
                }`}
              >
                {formattedBillingDate}
              </span>
            )}
            {isPastDue && (
              <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                !
              </Badge>
            )}
            {isCancelingAtPeriodEnd && (
              <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400">
                ⏱
              </Badge>
            )}
          </div>
        </div>

        <div className="h-px w-full bg-border my-2" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Desde:</span>
          <span>{formatDateBR(tenant.createdAt)}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Último acesso:</span>
          <span
            className={
              lastSeenDays === null || lastSeenDays >= 30
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "font-medium text-foreground"
            }
            title={tenant.lastSeenAt || "Sem registro de acesso"}
          >
            {formatLastSeen(tenant.lastSeenAt)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/10 p-4 border-t mt-auto">
        {/* span wrapper: disabled button tem pointer-events-none, então o title
            (tooltip nativo) precisa ficar no elemento pai para ser exibido */}
        <span
          className="w-full"
          title={
            canAccessPanel
              ? undefined
              : accountStatus !== "active"
                ? "Empresa desativada: reative para acessar o painel"
                : "Conta no plano gratuito não possui acesso ao painel ERP"
          }
        >
          <Button
            className="w-full cursor-pointer bg-white dark:bg-slate-950 border hover:bg-muted/50 text-foreground transition-colors shadow-sm"
            variant="ghost"
            onClick={() => onLoginAs(item)}
            disabled={isDeleting || !canAccessPanel}
          >
            <LogIn className="w-4 h-4 mr-2 text-primary" /> Acessar Painel
          </Button>
        </span>
      </CardFooter>

      <AlertDialog
        open={openDialog === "deactivate"}
        onOpenChange={(open) => !isDeleting && setOpenDialog(open ? "deactivate" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {tenant.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Nenhum dado é apagado. Ao desativar:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>a assinatura e os add-ons no Stripe são cancelados e a cobrança para;</li>
                  <li>todos os usuários da empresa perdem o acesso na hora.</li>
                </ul>
                <p>
                  Dá para reativar depois; a assinatura cancelada não volta
                  sozinha. Para apagar os dados, use &quot;Excluir definitivamente&quot;
                  com a empresa já desativada.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => runLifecycle(() => onDeactivate(tenant.id))}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting && <Loader size="sm" className="mr-2" />}
              {isDeleting ? "Desativando..." : "Desativar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={openDialog === "purge"}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setOpenDialog(open ? "purge" : null);
          if (!open) setConfirmName("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {tenant.name} definitivamente?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Usuários, propostas, contatos, lançamentos, carteiras, CRM,
                  agenda, integrações e arquivos da empresa serão apagados. Não
                  dá para desfazer.
                </p>
                <p>
                  As notas fiscais e o arquivo fiscal ficam guardados pelo prazo
                  legal de 5 anos.
                </p>
                <p>
                  Para confirmar, digite o nome da empresa: <strong>{tenant.name}</strong>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={tenant.name}
            aria-label="Nome da empresa para confirmar a exclusão"
            disabled={isDeleting}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => runLifecycle(() => onPurge(tenant.id, confirmName))}
              disabled={isDeleting || !nameMatches}
              variant="destructive"
            >
              {isDeleting && <Loader size="sm" className="mr-2" />}
              {isDeleting ? "Iniciando..." : "Excluir definitivamente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset MFA Confirmation Dialog - Controlled */}
      <AlertDialog
        open={isResetMfaDialogOpen}
        onOpenChange={setIsResetMfaDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Resetar verificação em dois fatores
            </AlertDialogTitle>
            <AlertDialogDescription>
              A verificação em dois fatores do administrador de{" "}
              <strong>{tenant.name}</strong> ({admin.email}) será removida. Ele
              poderá entrar sem o código e reconfigurar pelo próprio perfil. Use
              quando ele perder o acesso ao app autenticador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResettingMfa}>
              Cancelar
            </AlertDialogCancel>
            <Button onClick={handleResetMfa} disabled={isResettingMfa}>
              {isResettingMfa && <Loader size="sm" className="mr-2" />}
              {isResettingMfa ? "Resetando..." : "Resetar MFA"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
