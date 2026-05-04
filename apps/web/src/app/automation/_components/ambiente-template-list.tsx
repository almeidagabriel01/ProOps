"use client";

import { Ambiente } from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Pencil, Trash2, ArrowRight, Package } from "lucide-react";
import { motion } from "motion/react";

interface AmbienteTemplateListProps {
  ambientes: Ambiente[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AmbienteTemplateList({
  ambientes,
  onEdit,
  onDelete,
}: AmbienteTemplateListProps) {
  if (ambientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/50">
        <div className="bg-background p-4 rounded-full shadow-sm mb-4">
          <Home className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Nenhum ambiente encontrado</h3>
        <p className="text-muted-foreground max-w-sm mt-2 mb-6">
          Comece criando seu primeiro ambiente para configurar produtos,
          quantidades e status usados nas propostas.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {ambientes.map((ambiente, index) => {
        const itemsCount = ambiente.defaultProducts.length;

        return (
          <motion.div
            key={ambiente.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="group relative bg-card hover:bg-accent/5 border rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-lg group-hover:scale-105 transition-transform">
                    <Home className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg leading-none">
                      {ambiente.name}
                    </h3>
                    {ambiente.description ? (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {ambiente.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        Configure os itens padrão deste ambiente.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Badge variant="secondary" className="font-normal gap-1">
                  <Package className="w-3.5 h-3.5" />
                  {itemsCount} {itemsCount === 1 ? "item" : "itens"}
                </Badge>

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(ambiente.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(ambiente.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full justify-between group-hover:border-primary/50 group-hover:text-primary transition-colors mt-2"
                onClick={() => onEdit(ambiente.id)}
              >
                Gerenciar
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
