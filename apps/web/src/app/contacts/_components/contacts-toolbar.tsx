import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Search, Users, Building2 } from "lucide-react";
import { ContactsTypeFilter } from "../_hooks/use-contacts-ctrl";

interface ContactsToolbarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  typeFilter: ContactsTypeFilter;
  setTypeFilter: (filter: ContactsTypeFilter) => void;
  isFiltering: boolean;
  isLoadingAll: boolean;
}

export function ContactsToolbar({
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  isFiltering,
  isLoadingAll,
}: ContactsToolbarProps) {
  // items-center numa coluna centraliza os filhos e impede o campo de busca de
  // esticar — era por isso que ele saía mais estreito que o resto da página.
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
      <div className="w-full sm:max-w-md sm:flex-1">
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={
            isFiltering && isLoadingAll ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <Search className="w-4 h-4" />
            )
          }
        />
      </div>
      <div className="flex justify-center gap-2 sm:justify-start">
        <Button
          variant={typeFilter === "todos" ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter("todos")}
        >
          Todos
        </Button>
        <Button
          variant={typeFilter === "cliente" ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter("cliente")}
          className="gap-1.5"
        >
          <Users className="w-4 h-4" />
          Clientes
        </Button>
        <Button
          variant={typeFilter === "fornecedor" ? "default" : "outline"}
          size="sm"
          onClick={() => setTypeFilter("fornecedor")}
          className="gap-1.5"
        >
          <Building2 className="w-4 h-4" />
          Fornecedores
        </Button>
      </div>
    </div>
  );
}
