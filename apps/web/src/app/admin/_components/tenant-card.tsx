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
import { Tenant } from "@/types";
import { TenantBillingInfo, AdminService } from "@/services/admin-service";
import { toast } from "@/lib/toast";
import { LogIn, Trash2, Pencil, ShieldOff, Calendar, CheckCircle2, Clock, XCircle, MinusCircle } from "lucide-react";
import { formatDateBR } from "@/utils/date-format";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";

interface TenantCardProps {
  item: TenantBillingInfo;
  onEdit: (data: TenantBillingInfo) => void;
  onDelete: (id: string) => Promise<void>;
  onLoginAs: (tenant: Tenant) => void;
  onCopy?: (data: TenantBillingInfo) => void;
}

export function TenantCard({
  item,
  onEdit,
  onDelete,
  onLoginAs,
  onCopy,
}: TenantCardProps) {
  const { tenant, planName, subscriptionStatus, billingInterval, admin, isBillingStale } = item;
  const isFreePlan = item.planId === "free";
  const currentPeriodEnd = admin.currentPeriodEnd;
  const cancelAtPeriodEnd = admin.subscription?.cancelAtPeriodEnd ?? false;
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

  const isPastDue = subscriptionStatus === "past_due";
  const isCanceled = subscriptionStatus === "canceled";
  const isInactive = subscriptionStatus === "inactive" || subscriptionStatus === "unpaid";
  // Ativo mas com cancelamento agendado para o fim do período
  const isCancelingAtPeriodEnd = subscriptionStatus === "active" && cancelAtPeriodEnd;

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetMfaDialogOpen, setIsResetMfaDialogOpen] = useState(false);
  const [isResettingMfa, setIsResettingMfa] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(tenant.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Delete failed:", error);
      // Keep dialog open on error so user can see the error toast
    } finally {
      setIsDeleting(false);
    }
  };

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
      {(isCancelingAtPeriodEnd || isCanceled || isInactive) && (
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
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            {onCopy && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-brand"
                onClick={() => onCopy(item)}
                disabled={isDeleting}
                title="Clonar Dados (Produtos, Serviços, etc)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              title="Excluir"
            >
              {isDeleting ? (
                <Loader size="sm" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
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
              variant={
                subscriptionStatus === "active" ? "default" : "secondary"
              }
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
                      : subscriptionStatus === "active"
                        ? "text-emerald-600"
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
                    : subscriptionStatus === "active"
                      ? "Ativo"
                      : subscriptionStatus === "free"
                        ? "Gratuito"
                        : subscriptionStatus ?? "—"}
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
      </CardContent>

      <CardFooter className="bg-muted/10 p-4 border-t mt-auto">
        <Button
          className="w-full cursor-pointer bg-white dark:bg-slate-950 border hover:bg-muted/50 text-foreground transition-colors shadow-sm"
          variant="ghost"
          onClick={() => onLoginAs(tenant as Tenant)}
          disabled={isDeleting}
        >
          <LogIn className="w-4 h-4 mr-2 text-primary" /> Acessar Painel
        </Button>
      </CardFooter>

      {/* Delete Confirmation Dialog - Controlled */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{tenant.name}</strong>?
              Esta ação irá excluir permanentemente a empresa e todos os seus
              dados (usuários, produtos, propostas, etc).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting && <Loader size="sm" className="mr-2" />}
              {isDeleting ? "Removendo..." : "Remover"}
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
