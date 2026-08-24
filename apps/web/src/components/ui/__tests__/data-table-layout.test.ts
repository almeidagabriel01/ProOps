import { describe, expect, it } from "vitest";

import {
  resolveColumnLayout,
  type DataTableColumn,
} from "@/components/ui/data-table";

type Row = { id: string };

const col = (
  key: string,
  priority?: DataTableColumn<Row>["priority"],
): DataTableColumn<Row> => ({
  key,
  header: key,
  render: () => null,
  ...(priority ? { priority } : {}),
});

describe("resolveColumnLayout", () => {
  it("mantém call sites antigos funcionando sem declarar priority", () => {
    const layout = resolveColumnLayout([
      col("title"),
      col("client"),
      col("status"),
      col("environment"),
      col("validUntil"),
      col("actions"),
    ]);

    expect(layout.primary?.key).toBe("title");
    expect(layout.secondary.map((c) => c.key)).toEqual(["client", "status"]);
    expect(layout.actions?.key).toBe("actions");
  });

  it("reconhece a coluna actions por chave, esteja onde estiver", () => {
    const layout = resolveColumnLayout([
      col("actions"),
      col("name"),
      col("price"),
    ]);

    expect(layout.actions?.key).toBe("actions");
    expect(layout.primary?.key).toBe("name");
    expect(layout.secondary.map((c) => c.key)).toEqual(["price"]);
  });

  it("respeita priority explícito acima da ordem das colunas", () => {
    const layout = resolveColumnLayout([
      col("image", "hidden"),
      col("name", "primary"),
      col("category", "secondary"),
      col("internalCode", "hidden"),
      col("price", "secondary"),
      col("actions", "actions"),
    ]);

    expect(layout.primary?.key).toBe("name");
    expect(layout.secondary.map((c) => c.key)).toEqual(["category", "price"]);
    expect(layout.actions?.key).toBe("actions");
  });

  it("degrada um segundo primary para secondary em vez de descartá-lo", () => {
    const layout = resolveColumnLayout([
      col("a", "primary"),
      col("b", "primary"),
    ]);

    expect(layout.primary?.key).toBe("a");
    expect(layout.secondary.map((c) => c.key)).toEqual(["b"]);
  });

  it("não quebra quando não há coluna de ações nem colunas suficientes", () => {
    const layout = resolveColumnLayout([col("name")]);

    expect(layout.primary?.key).toBe("name");
    expect(layout.secondary).toEqual([]);
    expect(layout.actions).toBeNull();
  });
});
