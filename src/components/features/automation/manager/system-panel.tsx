import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Cpu, Menu, Plus } from "lucide-react";
import { Sistema } from "@/types/automation";

interface SystemPanelProps {
  sistemas: Sistema[];
  selectedSistemaId: string | null;
  onSelect: (id: string) => void;
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export function SystemPanel({
  sistemas,
  selectedSistemaId,
  onSelect,
  isMobileMenuOpen,
  onCloseMobileMenu,
}: SystemPanelProps) {
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
          <Button
            asChild
            variant="outline"
            className="w-full justify-start gap-2 text-muted-foreground"
          >
            <a href="/solutions?editSistemaId=new" target="_blank">
              <Plus className="w-3 h-3" /> Novo Sistema
            </a>
          </Button>
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
