import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Loader2 } from "lucide-react";
import { Wallet } from "@/types";
import { WalletCard } from "./wallet-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface WalletsGridProps {
  filteredWallets: Wallet[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (w: Wallet) => void;
  onDelete: (w: Wallet) => void;
  onTransfer: (w: Wallet) => void;
  onAdjust: (w: Wallet) => void;
  onArchive: (w: Wallet) => void;
  onSetDefault: (w: Wallet) => void;
  onViewHistory: (w: Wallet) => void;
}

export function WalletsGrid({
  filteredWallets,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onTransfer,
  onAdjust,
  onArchive,
  onSetDefault,
  onViewHistory,
}: WalletsGridProps) {
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(
    filteredWallets,
    6,
  );

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {displayedItems.map((wallet) => (
          <WalletCard
            key={wallet.id}
            wallet={wallet}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={onEdit}
            onDelete={onDelete}
            onTransfer={onTransfer}
            onAdjust={onAdjust}
            onArchive={onArchive}
            onSetDefault={onSetDefault}
            onViewHistory={onViewHistory}
          />
        ))}
      </div>
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
        >
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function WalletsGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <Skeleton className="w-10 h-10" />
              <div className="flex-1">
                <Skeleton className="h-5 w-24 mb-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
