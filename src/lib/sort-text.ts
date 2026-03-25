const PT_BR_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  numeric: true,
});

const DISPLAY_ITEM_TYPE_ORDER = {
  product: 0,
  service: 1,
} as const;

type DisplayItemType = keyof typeof DISPLAY_ITEM_TYPE_ORDER;

export function normalizeSortText(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function compareDisplayText(a: string, b: string): number {
  const normalizedA = normalizeSortText(a);
  const normalizedB = normalizeSortText(b);

  const byNormalized = PT_BR_COLLATOR.compare(normalizedA, normalizedB);
  if (byNormalized !== 0) return byNormalized;

  const byTrimmed = PT_BR_COLLATOR.compare(a.trim(), b.trim());
  if (byTrimmed !== 0) return byTrimmed;

  return PT_BR_COLLATOR.compare(a, b);
}

function resolveDisplayItemType(itemType?: string): DisplayItemType {
  return itemType === "service" ? "service" : "product";
}

function compareDisplayItemType(a?: string, b?: string): number {
  return (
    DISPLAY_ITEM_TYPE_ORDER[resolveDisplayItemType(a)] -
    DISPLAY_ITEM_TYPE_ORDER[resolveDisplayItemType(b)]
  );
}

export function compareCatalogDisplayItem<
  T extends {
    itemType?: "product" | "service";
    name?: string;
    id?: string;
  },
>(a: T, b: T): number {
  const byType = compareDisplayItemType(a.itemType, b.itemType);
  if (byType !== 0) return byType;

  const byName = compareDisplayText(a.name || "", b.name || "");
  if (byName !== 0) return byName;

  return PT_BR_COLLATOR.compare(String(a.id || ""), String(b.id || ""));
}

export function compareConfiguredDisplayItem<
  T extends {
    itemType?: "product" | "service";
    productName?: string;
    productId?: string;
    lineItemId?: string;
  },
>(a: T, b: T): number {
  const byType = compareDisplayItemType(a.itemType, b.itemType);
  if (byType !== 0) return byType;

  const byName = compareDisplayText(a.productName || "", b.productName || "");
  if (byName !== 0) return byName;

  const byProductId = PT_BR_COLLATOR.compare(
    String(a.productId || ""),
    String(b.productId || ""),
  );
  if (byProductId !== 0) return byProductId;

  return PT_BR_COLLATOR.compare(
    String(a.lineItemId || ""),
    String(b.lineItemId || ""),
  );
}

export function compareConfiguredDisplayItemWithExtras<
  T extends {
    itemType?: "product" | "service";
    isExtra?: boolean;
    productName?: string;
    productId?: string;
    lineItemId?: string;
  },
>(a: T, b: T): number {
  const byType = compareDisplayItemType(a.itemType, b.itemType);
  if (byType !== 0) return byType;

  const byExtra = Number(Boolean(a.isExtra)) - Number(Boolean(b.isExtra));
  if (byExtra !== 0) return byExtra;

  return compareConfiguredDisplayItem(a, b);
}
