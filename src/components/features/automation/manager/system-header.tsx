import { Button } from "@/components/ui/button";
import { Menu, Pencil } from "lucide-react";
import { Sistema } from "@/types/automation";

interface SystemHeaderProps {
  selectedSistema: Sistema | null;
  onOpenMobileMenu: () => void;
}

export function SystemHeader({
  selectedSistema,
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
            <div className="flex items-center gap-2 group">
              <h2 className="text-xl font-bold">{selectedSistema.name}</h2>
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <a
                  href={`/solutions?editSistemaId=${selectedSistema.id}`}
                  target="_blank"
                >
                  <Pencil className="w-3 h-3" />
                </a>
              </Button>
            </div>
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
    </div>
  );
}
