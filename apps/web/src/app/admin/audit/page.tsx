"use client";

import * as React from "react";
import { ScrollText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import {
  AdminService,
  type AdminAuditEvent,
  type TenantIndexItem,
} from "@/services/admin-service";
import { toast } from "@/lib/toast";

/**
 * Rastro de seguranca e cobranca: o que o super admin fez em cada empresa e o
 * que o backend recusou para os usuarios delas (conta gratuita barrada, plano
 * insuficiente, limite atingido, falha de login). O backend ja gravava tudo em
 * `security_audit_events`, mas nada exibia.
 *
 * A coluna "Quem" vem do `role` do usuario que agiu, resolvido no backend: e o
 * que separa uma acao SUA dentro do painel da empresa de uma acao do usuario
 * dela. Sem ela, as duas apareciam iguais, porque carregam o mesmo tenantId.
 */

const EVENT_LABELS: Record<string, string> = {
  super_admin_impersonation_started: "Entrou no painel da empresa",
  super_admin_impersonation_stopped: "Saiu do painel da empresa",
  super_admin_tenant_write: "Alterou dados da empresa (Acessar Painel)",
  super_admin_tenant_created: "Criou empresa",
  super_admin_tenant_deactivated: "Desativou empresa",
  super_admin_tenant_reactivated: "Reativou empresa",
  super_admin_tenant_purge_requested: "Pediu exclusão definitiva",
  super_admin_plan_updated: "Trocou o plano",
  super_admin_plan_forced: "Forçou o plano",
  super_admin_subscription_updated: "Alterou a assinatura manual",
  super_admin_credentials_updated: "Alterou credenciais",
  super_admin_copy_data: "Copiou catálogo entre empresas",
  super_admin_addon_granted: "Concedeu add-on de cortesia",
  super_admin_addon_revoked: "Retirou add-on de cortesia",
  super_admin_member_created: "Criou membro",
  super_admin_member_updated: "Editou membro",
  super_admin_permissions_updated: "Alterou permissões de membro",
  super_admin_destructive_op: "Operação destrutiva",
  super_admin_prices_migrated: "Migrou preços",
  super_admin_mfa_required: "Acesso admin barrado por falta de MFA",
  mfa_reset_by_admin: "Resetou MFA de usuário",
  observability_issue_triaged: "Triou erro na observabilidade",
  // Eventos dos usuários das empresas, não do super admin.
  BILLING_SUBSCRIPTION_BLOCK: "Acesso barrado pela cobrança",
  TENANT_PLAN_CAPABILITY_BLOCKED: "Módulo fora do plano",
  TENANT_PLAN_LIMIT_BLOCKED: "Limite do plano atingido",
  TENANT_PLAN_LIMIT_WOULD_BLOCK: "Limite atingido (só monitorado)",
  TENANT_PLAN_SUPERADMIN_BYPASS: "Limite ignorado por ser super admin",
  plan_violation: "Tentativa fora do plano",
  ratelimit_triggered: "Excesso de requisições",
  cors_denied: "Origem bloqueada (CORS)",
  denial: "Acesso negado",
  login: "Login",
  AUTH_COMPAT: "Login com dados de sessão desatualizados",
  recovery_code_used: "Usou código de recuperação",
  recovery_codes_generated: "Gerou códigos de recuperação",
  mfa_recovery_code_signin: "Entrou por código de recuperação",
  whatsapp_mfa_enroll: "Ativou 2FA por WhatsApp",
  whatsapp_mfa_login_verified: "Entrou com 2FA por WhatsApp",
  whatsapp_mfa_disabled: "Desativou 2FA por WhatsApp",
  superadmin_portal_session: "Abriu portal de cobrança pelo painel",
  webhook_failed: "Webhook falhou",
};

/** Motivos que aparecem crus na coluna de detalhe. */
const REASON_LABELS: Record<string, string> = {
  FREE_TIER_FORBIDDEN_ROUTE: "conta gratuita, recurso só de plano pago",
  SUBSCRIPTION_PAST_DUE: "assinatura em atraso",
  SUBSCRIPTION_CANCELED: "assinatura cancelada",
  SUBSCRIPTION_INACTIVE: "assinatura inativa",
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminAuditPage() {
  const [events, setEvents] = React.useState<AdminAuditEvent[]>([]);
  const [tenants, setTenants] = React.useState<TenantIndexItem[]>([]);
  const [tenantId, setTenantId] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    AdminService.getTenantsIndex()
      .then(setTenants)
      .catch(() => setTenants([]));
  }, []);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setEvents(await AdminService.getAuditEvents({ tenantId, eventType, limit: 100 }));
    } catch {
      toast.error("Erro ao carregar a auditoria.");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, eventType]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const tenantName = React.useCallback(
    (id?: string | null) => (id ? tenants.find((t) => t.id === id)?.name ?? id : "-"),
    [tenants],
  );

  const actorOf = (event: AdminAuditEvent) => {
    const actor = event.actor;
    if (!actor) return { label: event.uid ? "Usuário removido" : "Sistema", isSuperAdmin: false };
    return {
      label: actor.name || actor.email || actor.uid,
      title: actor.email || actor.uid,
      isSuperAdmin: actor.isSuperAdmin,
    };
  };

  const detailOf = (event: AdminAuditEvent) => {
    const reason = event.reason || "";
    return REASON_LABELS[reason] || reason || event.route || "";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-primary" />
          Auditoria
        </h1>
        <p className="text-sm text-muted-foreground">
          O que o super admin fez em cada empresa e o que o backend recusou para
          os usuários delas. A coluna &quot;Quem&quot; separa uma ação sua, feita pelo
          Acessar Painel, de uma ação do próprio usuário da empresa.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          aria-label="Filtrar por empresa"
          className="sm:max-w-xs"
        >
          <option value="">Todas as empresas</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          aria-label="Filtrar por tipo de evento"
          className="sm:max-w-xs"
        >
          <option value="">Todos os eventos</option>
          {Object.entries(EVENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => void load()} disabled={isLoading}>
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 max-sm:p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader size="md" />
            </div>
          ) : events.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum evento encontrado.
            </p>
          ) : (
            <ul className="divide-y">
              {events.map((event) => (
                <li key={event.id} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:gap-4">
                  <span className="text-xs text-muted-foreground md:w-32 shrink-0">
                    {formatDateTime(event.createdAt)}
                  </span>
                  <span className="text-sm font-medium md:flex-1">
                    {EVENT_LABELS[event.eventType] ?? event.eventType}
                  </span>
                  <span className="text-sm text-muted-foreground md:w-48 truncate">
                    {tenantName(event.tenantId)}
                  </span>
                  <span
                    className="flex items-center gap-1.5 text-sm text-muted-foreground md:w-52 min-w-0"
                    title={actorOf(event).title}
                  >
                    <span className="truncate">{actorOf(event).label}</span>
                    {actorOf(event).isSuperAdmin && (
                      <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                        Super admin
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground md:w-56 truncate" title={event.route ?? ""}>
                    {detailOf(event)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
