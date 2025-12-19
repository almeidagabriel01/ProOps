"use client";

import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Mail, Building2, Users, Package, FileText } from "lucide-react";
import { TenantBillingInfo } from "@/services/admin-service";
import { motion } from "motion/react";

import { UsageIndicator } from "./usage-indicator";
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
  onEditLimits: (item: TenantBillingInfo) => void;
}

function TableEmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
        <div className="flex flex-col items-center justify-center gap-2">
          <Building2 className="h-8 w-8 opacity-20" />
          <p>Nenhuma empresa encontrada.</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface TenantRowProps {
  item: TenantBillingInfo;
  index: number;
  onEditLimits: (item: TenantBillingInfo) => void;
}

function TenantRow({ item, index, onEditLimits }: TenantRowProps) {
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
          billingInterval={item.billingInterval}
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
      <TableCell className="py-4">
        <StatusBadge status={item.subscriptionStatus} />
      </TableCell>
      <TableCell className="pr-6 py-4 text-right">
        <TenantActionsMenu item={item} onEditLimits={onEditLimits} />
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
  onEditLimits,
}: TenantsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="px-6 py-5">
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
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  className="pl-9 h-10 w-64 bg-muted/50 border-0 focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 h-10">
                <span className="text-xs font-medium text-muted-foreground">Status:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => onFilterChange(e.target.value)}
                  className="text-sm font-medium bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer text-foreground pr-6 appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0 center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.25em 1.25em',
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="free">Gratuito</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                      onEditLimits={onEditLimits}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="border-t bg-muted/20 px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {filteredData.length}
            </span>{" "}
            empresas
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Atualizado em tempo real
          </span>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
