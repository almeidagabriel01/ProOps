import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableColumn } from "@/components/ui/data-table";
import { Client } from "@/services/client-service";
import { Mail, Phone, Edit, Trash2 } from "lucide-react";

interface CreateColumnsProps {
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (client: Client) => void;
}

const sourceConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  manual: { label: "Manual", variant: "default" },
  proposal: { label: "Proposta", variant: "success" },
  financial: { label: "Financeiro", variant: "warning" },
};

const typeConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  cliente: { label: "Cliente", variant: "default" },
  fornecedor: { label: "Fornecedor", variant: "outline" },
};

export const createColumns = ({
  canEdit,
  canDelete,
  onDelete,
}: CreateColumnsProps): DataTableColumn<Client>[] => [
  {
    key: "name",
    header: "Nome",
    render: (client) => (
      <div className="min-w-0">
        <Link
          href={`/contacts/${client.id}`}
          className="font-medium hover:underline truncate block"
        >
          {client.name}
        </Link>
      </div>
    ),
  },
  {
    key: "types",
    header: "Tipo",
    render: (client) => {
      const clientTypes = client.types || ["cliente"];
      return (
        <div className="flex flex-wrap gap-1 justify-start">
          {clientTypes.map((t) => {
            const cfg = typeConfig[t] || typeConfig.cliente;
            return (
              <Badge key={t} variant={cfg.variant} className="text-xs">
                {cfg.label}
              </Badge>
            );
          })}
        </div>
      );
    },
  },
  {
    key: "address",
    header: "Endereço",
    className: "",
    headerClassName: "whitespace-nowrap",
    render: (client) => (
      <div className="text-sm text-muted-foreground truncate">
        {client.address || "-"}
      </div>
    ),
  },
  {
    key: "email",
    header: "Contato",
    render: (client) => (
      <div className="space-y-1 min-w-0">
        {client.email && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">{client.phone}</span>
          </div>
        )}
        {!client.email && !client.phone && (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>
    ),
  },
  {
    key: "source",
    header: "Origem",
    className: "",
    headerClassName: "",
    render: (client) => {
      const source = sourceConfig[client.source] || sourceConfig.manual;
      return <Badge variant={source.variant}>{source.label}</Badge>;
    },
  },
  {
    key: "actions",
    header: "Ações",
    className: "text-right",
    headerClassName: "flex justify-end",
    sortable: false,
    render: (client) => (
      <div className="flex items-center justify-end gap-1">
        {canEdit && (
          <Link href={`/contacts/${client.id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Editar"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </Link>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(client)}
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    ),
  },
];
