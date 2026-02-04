"use client";

import { Sistema } from "@/types/automation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
// import * as Icons from "lucide-react";

interface SistemaListProps {
  sistemas: Sistema[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SistemaList({ sistemas, onEdit, onDelete }: SistemaListProps) {
  if (sistemas.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum sistema cadastrado. Clique em &quot;Novo Sistema&quot; para
        começar.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Ambientes Configurados</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sistemas.map((sistema) => (
            <TableRow key={sistema.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {/* {sistema.icon && Icons[sistema.icon as keyof typeof Icons] && (
                    <span className="text-muted-foreground">
                      {React.createElement(Icons[sistema.icon as keyof typeof Icons] as any, { size: 16 })}
                    </span>
                  )} */}
                  {sistema.name}
                </div>
              </TableCell>
              <TableCell>{sistema.description}</TableCell>
              <TableCell>
                {sistema.ambientes.length > 0 ? (
                  `${sistema.ambientes.length} ambientes`
                ) : (
                  <span className="text-muted-foreground italic">Nenhum</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(sistema.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(sistema.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
