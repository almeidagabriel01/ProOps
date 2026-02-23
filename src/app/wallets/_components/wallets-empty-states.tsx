import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet as WalletIcon, Plus } from "lucide-react";

interface WalletsEmptyStateProps {
  canCreate: boolean;
  onCreate: () => void;
}

export function WalletsEmptyState({
  canCreate,
  onCreate,
}: WalletsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <WalletIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          Nenhuma carteira cadastrada
        </h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          Comece criando sua primeira carteira para gerenciar seu dinheiro.
        </p>
        {canCreate && (
          <Button className="gap-2" onClick={onCreate}>
            <Plus className="w-4 h-4" />
            Criar Primeira Carteira
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function WalletsNoResults() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <WalletIcon className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          Nenhum resultado encontrado
        </h3>
        <p className="text-muted-foreground text-center">
          Tente buscar por outro termo ou remova os filtros.
        </p>
      </CardContent>
    </Card>
  );
}
