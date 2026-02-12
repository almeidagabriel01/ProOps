import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Home, Trash2, ExternalLink } from "lucide-react";
import { Ambiente } from "@/types/automation";

interface EnvironmentListProps {
  activeSystemId: string;
  linkedAmbientes: Ambiente[];
  onUnlink: (id: string) => void;
  allowDelete?: boolean;
}

export function EnvironmentList({
  activeSystemId,
  linkedAmbientes,
  onUnlink,
  allowDelete = true,
}: EnvironmentListProps) {
  return (
    <div>
      <h3 className="font-medium mb-3 flex items-center justify-between">
        Ambientes Vinculados
      </h3>

      <div className="grid gap-3">
        {linkedAmbientes.map((amb) => {
          return (
            <div
              key={amb.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">{amb.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Clique para editar produtos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-2 cursor-pointer"
                >
                  <Link
                    href={`/solutions?editSistemaId=${activeSystemId}&editAmbienteId=${amb.id}`}
                    target="_blank"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Editar Template
                  </Link>
                </Button>
                {allowDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => onUnlink(amb.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Environment Block */}
        <div className="relative">
          <Button
            asChild
            variant="outline"
            className="w-full border-dashed py-6 text-muted-foreground hover:text-primary hover:border-primary/50"
          >
            <a
              href={`/solutions?editSistemaId=${activeSystemId}`}
              target="_blank"
            >
              <Plus className="w-4 h-4 mr-2" /> Adicionar Ambiente
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
