import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Home, Trash2, ExternalLink } from "lucide-react";
import { Ambiente } from "@/types/automation";

interface EnvironmentListProps {
  activeSystemId: string;
  linkedAmbientes: Ambiente[];
  onUnlink: (id: string) => void;

  isAdding: boolean;
  setIsAdding: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  showSelector: boolean;
  setShowSelector: (v: boolean) => void;
  availableToAdd: Ambiente[];
  onLink: (id: string) => void;
  onCreate: () => void;
}

export function EnvironmentList({
  activeSystemId,
  linkedAmbientes,
  onUnlink,
  isAdding,
  setIsAdding,
  newName,
  setNewName,
  search,
  setSearch,
  showSelector,
  setShowSelector,
  availableToAdd,
  onLink,
  onCreate,
}: EnvironmentListProps) {
  return (
    <div>
      <h3 className="font-medium mb-3 flex items-center justify-between">
        Ambientes Vinculados
      </h3>

      <div className="grid gap-3">
        {linkedAmbientes.map((amb) => (
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
                  {amb.defaultProducts?.length || 0} produtos configurados
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
                  href={`/automation?editSistemaId=${activeSystemId}&editAmbienteId=${amb.id}`}
                  target="_blank"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Editar Template
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive cursor-pointer"
                onClick={() => onUnlink(amb.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        {/* Add Environment Block */}
        <div className="relative">
          {!isAdding ? (
            <Button
              variant="outline"
              className="w-full border-dashed py-6 text-muted-foreground hover:text-primary hover:border-primary/50"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Adicionar Ambiente
            </Button>
          ) : (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <h4 className="text-sm font-medium">Novo/Vincular Ambiente</h4>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do novo ambiente..."
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        setShowSelector(false); // Creating new
                      }}
                    />
                    {/* Or Select Existing */}
                    <Button
                      variant="outline"
                      onClick={() => setShowSelector(!showSelector)}
                      title="Selecionar existente"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>

                  {showSelector && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-popover border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                      <div className="p-2 sticky top-0 bg-popover border-b">
                        <Input
                          placeholder="Buscar..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                      </div>
                      {availableToAdd.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">
                          Nada encontrado
                        </div>
                      ) : (
                        availableToAdd.map((a) => (
                          <button
                            key={a.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => onLink(a.id)}
                          >
                            {a.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Button onClick={onCreate}>Criar</Button>
                <Button variant="ghost" onClick={() => setIsAdding(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
