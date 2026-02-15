import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search, Plus } from "lucide-react";

interface ContactsEmptyStateProps {
  canCreate: boolean;
}

export function ContactsEmptyState({ canCreate }: ContactsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          Nenhum cliente cadastrado
        </h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Cadastre seus clientes manualmente ou eles serão adicionados
          automaticamente ao criar propostas.
        </p>
        {canCreate && (
          <Link href="/contacts/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Cadastrar Primeiro Cliente
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function ContactsNoResults() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Search className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          Nenhum resultado encontrado
        </h3>
        <p className="text-muted-foreground text-center">
          Tente buscar por outro termo.
        </p>
      </CardContent>
    </Card>
  );
}
