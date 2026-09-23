"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Mail,
  Building2,
  Users,
  Package,
  FileText,
} from "lucide-react";
import { TenantBillingInfo } from "@/services/admin-service";
import { m as motion } from "motion/react";

import { UsageIndicator } from "./usage-indicator";
import {
  formatLastSeen,
  formatLastSeenExact,
  daysSinceLastSeen,
} from "@/lib/last-seen-format";
import { StatusBadge } from "./status-badge";
import { PlanBadge } from "./plan-badge";
import { CompanyAvatar } from "./company-avatar";
import { TenantActionsMenu } from "./tenant-actions-menu";

interface TenantsTableProps {
  filteredData: TenantBillingInfo[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  onManageModules?: (item: TenantBillingInfo) => void;
}

function TableEmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2">
          <Building2 className="h-8 w-8 opacity-20" />
          <p>Nenhuma empresa encontrada.</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * A mesma empresa da linha da tabela, em card, para abaixo de md. Mostra o que
 * responde "esta empresa esta bem?" (plano, status, ultimo acesso) e deixa o
 * consumo de recursos para a tabela do desktop, onde ha largura para as barras.
 */
function TenantMobileRow({
  item,
  onManageModules,
}: {
  item: TenantBillingInfo;
  onManageModules?: (item: TenantBillingInfo) => void;
}) {
  const lastSeenDays = daysSinceLastSeen(item.tenant.lastSeenAt);
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={item.tenant.name} logoUrl={item.tenant.logoUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{item.tenant.name}</p>
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.admin.email}</span>
          </p>
        </div>
        <TenantActionsMenu item={item} onManageModules={onManageModules} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PlanBadge
          planName={item.planName}
          billingInterval={item.billingInterval || "monthly"}
        />
        <StatusBadge status={item.subscriptionStatus || "active"} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Último acesso:{" "}
        <span
          className={
            lastSeenDays === null || lastSeenDays >= 30
              ? "font-medium text-amber-600 dark:text-amber-400"
              : "font-medium text-foreground"
          }
        >
          {formatLastSeenExact(item.tenant.lastSeenAt)}
        </span>
        {item.tenant.lastSeenAt && <> ({formatLastSeen(item.tenant.lastSeenAt)})</>}
      </p>
    </li>
  );
}

interface TenantRowProps {
  item: TenantBillingInfo;
  index: number;
  onManageModules?: (item: TenantBillingInfo) => void;
}

function TenantRow({ item, index, onManageModules }: TenantRowProps) {
  const lastSeenDays = daysSinceLastSeen(item.tenant.lastSeenAt);
  return (
    <motion.tr
      key={item.tenant.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * Math.min(index, 5) }}
      className="group border-b border-muted/50 hover:bg-muted/30 transition-colors duration-200"
    >
      <TableCell className="pl-6 py-4">
        <div className="flex items-center gap-3">
          <CompanyAvatar
            name={item.tenant.name}
            logoUrl={item.tenant.logoUrl}
          />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">
              {item.tenant.name}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              {item.admin.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-4">
        <PlanBadge
          planName={item.planName}
          billingInterval={item.billingInterval || "monthly"}
        />
      </TableCell>
      <TableCell className="py-4">
        <UsageIndicator
          current={item.usage.users}
          max={item.planFeatures?.maxUsers}
        />
      </TableCell>
      <TableCell className="py-4">
        <UsageIndicator
          current={item.usage.products}
          max={item.planFeatures?.maxProducts}
        />
      </TableCell>
      <TableCell className="py-4">
        <UsageIndicator
          current={item.usage.proposals}
          max={item.planFeatures?.maxProposals}
        />
      </TableCell>
      <TableCell className="py-4 whitespace-nowrap">
        <div className="flex flex-col">
          <span
            className={
              lastSeenDays === null || lastSeenDays >= 30
                ? "text-sm text-amber-600 dark:text-amber-400"
                : "text-sm text-foreground"
            }
          >
            {formatLastSeenExact(item.tenant.lastSeenAt)}
          </span>
          {item.tenant.lastSeenAt && (
            <span className="text-xs text-muted-foreground">
              {formatLastSeen(item.tenant.lastSeenAt)}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-4">
        <StatusBadge status={item.subscriptionStatus || "active"} />
      </TableCell>
      <TableCell className="pr-6 py-4 text-right">
        <TenantActionsMenu item={item} onManageModules={onManageModules} />
      </TableCell>
    </motion.tr>
  );
}

export function TenantsTable({
  filteredData,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange,
  onManageModules,
}: TenantsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="px-6 py-5 max-sm:px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Title */}
            <div>
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Diretório de Empresas
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gerencie acessos, planos e utilização de recursos
              </p>
            </div>

            {/* Search and Filter */}
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  className="pl-9 h-10 w-64 max-sm:w-full bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
              <Select
                value={filterStatus}
                onChange={(e) => onFilterChange(e.target.value)}
                className="w-32 shrink-0"
              >
                <option value="all">Todos</option>
                <option value="active">Ativos</option>
                <option value="trialing">Em teste</option>
                <option value="canceling">Encerrando</option>
                <option value="past_due">Atrasados</option>
                <option value="canceled">Cancelados</option>
                <option value="inactive">Inativos</option>
                <option value="free">Gratuito</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 max-sm:p-0">
          {/* Abaixo de md a tabela de 8 colunas precisaria de ~950px: vira lista. */}
          <ul className="divide-y divide-muted/50 md:hidden">
            {filteredData.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma empresa encontrada.
              </li>
            ) : (
              filteredData.map((item) => (
                <TenantMobileRow
                  key={item.tenant.id}
                  item={item}
                  onManageModules={onManageModules}
                />
              ))
            )}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-0">
                  <TableHead className="pl-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Empresa
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Plano
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Usuários
                    </div>
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Produtos
                    </div>
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Propostas
                    </div>
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Último acesso
                  </TableHead>
                  <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="pr-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableEmptyState />
                ) : (
                  filteredData.map((item, index) => (
                    <TenantRow
                      key={item.tenant.id}
                      item={item}
                      index={index}
                      onManageModules={onManageModules}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/20 px-6 py-4 max-sm:px-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {filteredData.length}
            </span>{" "}
            empresas
          </span>
          <span className="text-xs text-muted-foreground">
            Dados de quando a página foi aberta
          </span>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
