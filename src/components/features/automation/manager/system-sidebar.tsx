import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Menu, Plus, Check, Trash2 } from "lucide-react";
import { Sistema } from "@/types/automation";

interface SystemSidebarProps {
  sistemas: Sistema[];
  selectedSistemaId: string | null;
  onSelect: (id: string) => void;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  isCreating: boolean;
  setIsCreating: (v: boolean) => void;
  newSystemName: string;
  setNewSystemName: (v: string) => void;
  onCreate: () => void;
}

export function SystemSidebar({
  sistemas,
  selectedSistemaId,
  onSelect,
  isMobileMenuOpen,
  onCloseMobileMenu,
  isCreating,
  setIsCreating,
  newSystemName,
  setNewSystemName,
  onCreate,
}: SystemSidebarProps) {
  return (
    <>
      <div
        className={cn(
          "w-64 border-r bg-muted/20 flex flex-col transition-transform absolute z-20 h-full md:relative md:translate-x-0 bg-background md:bg-muted/20",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-4 border-b flex items-center justify-between bg-muted/10">
          <h3 className="font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Sistemas
          </h3>
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={onCloseMobileMenu}
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sistemas.map((sys) => (
            <button
              key={sys.id}
              onClick={() => {
                onSelect(sys.id);
                onCloseMobileMenu();
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between group cursor-pointer",
                selectedSistemaId === sys.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="truncate">{sys.name}</span>
            </button>
          ))}
        </div>

        <div className="p-2 border-t mt-auto">
          {isCreating ? (
            <div className="flex gap-1 items-center px-1">
              <Input
                placeholder="Nome do sistema..."
                className="h-8 text-sm"
                value={newSystemName}
                onChange={(e) => setNewSystemName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && onCreate()}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onCreate}
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => setIsCreating(false)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-3 h-3" /> Novo Sistema
            </Button>
          )}
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="absolute inset-0 bg-black/50 z-10 md:hidden"
          onClick={onCloseMobileMenu}
        />
      )}
    </>
  );
}
