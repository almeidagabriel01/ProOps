"use client";

import { Sistema } from "@/types/automation";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Box, Cpu, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";

interface SistemaListProps {
  sistemas: Sistema[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SistemaList({ sistemas, onEdit, onDelete }: SistemaListProps) {
  if (sistemas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-muted/50">
        <div className="bg-background p-4 rounded-full shadow-sm mb-4">
          <Box className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Nenhum sistema encontrado</h3>
        <p className="text-muted-foreground max-w-sm mt-2 mb-6">
          Comece criando seu primeiro sistema de automação para configurar
          ambientes e produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sistemas.map((sistema, index) => (
        <motion.div
          key={sistema.id}
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
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg leading-none">
                    {sistema.name}
                  </h3>
                  {sistema.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {sistema.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Badge variant="secondary" className="font-normal">
                {sistema.ambientes.length}{" "}
                {sistema.ambientes.length === 1 ? "ambiente" : "ambientes"}
              </Badge>

              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(sistema.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(sistema.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-between group-hover:border-primary/50 group-hover:text-primary transition-colors mt-2"
              onClick={() => onEdit(sistema.id)}
            >
              Gerenciar
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
