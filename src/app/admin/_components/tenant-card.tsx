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
import { TenantBillingInfo } from "@/services/admin-service";
import { LogIn, Trash2, Pencil, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { calculateNextBillingDate } from "../_utils/billing-date";

interface TenantCardProps {
  item: TenantBillingInfo;
  onEdit: (data: TenantBillingInfo) => void;
  onDelete: (id: string) => Promise<void>;
  onLoginAs: (tenant: Tenant) => void;
}

export function TenantCard({
  item,
  onEdit,
  onDelete,
  onLoginAs,
}: TenantCardProps) {
  const { tenant, planName, subscriptionStatus, billingInterval, admin } = item;
  const nextBillingDate = admin.currentPeriodEnd
    ? new Date(admin.currentPeriodEnd)
    : calculateNextBillingDate(tenant.createdAt, billingInterval);
  const isPastDue = subscriptionStatus === "past_due";

  // Controlled dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <Card
      className={`overflow-hidden border-t-4 hover:shadow-md transition-shadow group flex flex-col ${isPastDue ? "border-red-500 ring-1 ring-red-500/20" : ""}`}
      style={{
        borderTopColor: isPastDue ? undefined : tenant.primaryColor,
      }}
    >
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
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Status
          </span>
          <span
            className={`font-medium ${subscriptionStatus === "active" ? "text-emerald-600" : isPastDue ? "text-red-600" : "text-muted-foreground"}`}
          >
            {subscriptionStatus === "active"
              ? "Ativo"
              : isPastDue
                ? "Atrasado"
                : subscriptionStatus === "free"
                  ? "Gratuito"
                  : "Inativo"}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Calendar
              className={`w-3 h-3 ${isPastDue ? "text-red-500" : ""}`}
            />
            Vencimento
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${isPastDue ? "text-red-600" : "text-foreground"}`}
            >
              {nextBillingDate.toLocaleDateString("pt-BR")}
            </span>
            {isPastDue && (
              <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                !
              </Badge>
            )}
          </div>
        </div>

        <div className="h-px w-full bg-border my-2" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Desde:</span>
          <span>{new Date(tenant.createdAt).toLocaleDateString("pt-BR")}</span>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/10 p-4 border-t mt-auto">
        <Button
          className="w-full cursor-pointer bg-white dark:bg-slate-950 border hover:bg-muted/50 text-foreground transition-colors shadow-sm"
          variant="ghost"
          onClick={() => onLoginAs(tenant)}
          disabled={isDeleting}
        >
          <LogIn className="w-4 h-4 mr-2 text-primary" /> Acessar Painel
        </Button>
      </CardFooter>

      {/* Delete Confirmation Dialog - Controlled */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{tenant.name}</strong>?
              Esta ação irá excluir permanentemente a empresa e todos os seus dados
              (usuários, produtos, propostas, etc).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isDeleting ? "Removendo..." : "Remover"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
