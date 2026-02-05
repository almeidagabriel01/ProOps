import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Pencil, Trash2 } from "lucide-react";
import { Sistema } from "@/types/automation";

interface SystemHeaderProps {
  selectedSistema: Sistema | null;
  isEditingName: boolean;
  editingName: string;
  onEditNameChange: (v: string) => void;
  onStartEditing: () => void;
  onSaveName: () => void;
  onDelete: () => void;
  onOpenMobileMenu: () => void;
}

export function SystemHeader({
  selectedSistema,
  isEditingName,
  editingName,
  onEditNameChange,
  onStartEditing,
  onSaveName,
  onDelete,
  onOpenMobileMenu,
}: SystemHeaderProps) {
  return (
    <div className="p-6 pr-12 border-b flex items-start justify-between gap-4 relative">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden -ml-2"
            onClick={onOpenMobileMenu}
          >
            <Menu className="w-4 h-4" />
          </Button>

          {selectedSistema ? (
            isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  className="h-8 text-lg font-bold w-[200px]"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && onSaveName()}
                />
                <Button size="sm" onClick={onSaveName}>
                  Salvar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-xl font-bold">{selectedSistema.name}</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={onStartEditing}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            )
          ) : (
            <h2 className="text-xl font-bold text-muted-foreground">
              Selecione um sistema
            </h2>
          )}
        </div>
        <p className="text-sm text-muted-foreground ml-8 md:ml-0">
          Gerencie os ambientes e produtos deste sistema.
        </p>
      </div>

      {selectedSistema && (
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 cursor-pointer"
          onClick={onDelete}
          title="Excluir Sistema"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
