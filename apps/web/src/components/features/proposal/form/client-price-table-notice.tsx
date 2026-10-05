import { Tags } from "lucide-react";
import {
  describePriceTableAdjustment,
  type PriceTable,
} from "@/lib/pricing/price-table";

interface ClientPriceTableNoticeProps {
  table: PriceTable;
}

/**
 * Avisa que o cliente da proposta tem tabela de preço própria. Os itens que
 * entram depois de escolher o cliente já saem com o preço dela; os que já
 * estavam mantêm o preço com que entraram.
 */
export function ClientPriceTableNotice({ table }: ClientPriceTableNoticeProps) {
  const specificCount =
    Object.keys(table.productPrices ?? {}).length +
    Object.keys(table.servicePrices ?? {}).length;
  const detail = [
    describePriceTableAdjustment(table.adjustmentPercent),
    specificCount > 0
      ? `${specificCount} ${specificCount === 1 ? "item com preço próprio" : "itens com preço próprio"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
    >
      <Tags className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p>
        Este cliente usa a tabela <strong>{table.name}</strong> ({detail}). Os
        itens que você acrescentar já saem com esses preços; os que já estavam
        na proposta mantêm o preço.
      </p>
    </div>
  );
}
