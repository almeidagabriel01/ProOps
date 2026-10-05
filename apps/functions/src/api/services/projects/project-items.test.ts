/**
 * Itens da obra: a cópia dos produtos da proposta não pode levar valor nenhum
 * (o técnico lê o projeto e não pode ver preço), deixa serviço e linha inativa
 * de fora, e a marcação de situação guarda quem e quando.
 */

import {
  MAX_PROJECT_ITEMS,
  PROJECT_ITEM_FIELDS,
  UpdateItemsStatusSchema,
  applyItemsStatus,
  buildProjectItemsFromProposal,
  type ProjectItem,
} from "./project-items";

/** Linha de proposta como o formulário grava, com TODOS os campos de valor. */
function line(over: Record<string, unknown> = {}) {
  return {
    lineItemId: "li_1",
    productId: "prod_1",
    itemType: "product",
    productName: "Módulo de iluminação",
    productDescription: "Descrição comercial",
    productImage: "https://img/1.png",
    quantity: 2,
    unitPrice: 437.5,
    markup: 40,
    priceManuallyEdited: true,
    total: 1225,
    manufacturer: "Sonoff",
    category: "Iluminação",
    ambienteInstanceId: "sis_luz-amb_sala",
    systemInstanceId: "sis_luz-amb_sala",
    isExtra: false,
    status: "active",
    pricingDetails: { mode: "standard" },
    ...over,
  };
}

const SISTEMAS = [
  {
    sistemaId: "sis_luz",
    sistemaName: "Iluminação",
    ambientes: [
      { ambienteId: "amb_sala", ambienteName: "Sala", productIds: ["prod_1"] },
      { ambienteId: "amb_suite", ambienteName: "Suíte", productIds: ["prod_2"] },
    ],
  },
];

let seq = 0;
const nextId = () => `gen_${++seq}`;

beforeEach(() => {
  seq = 0;
});

describe("buildProjectItemsFromProposal", () => {
  it("copia só os campos permitidos: nenhum preço, total, markup ou forma de pagamento", () => {
    const items = buildProjectItemsFromProposal(
      {
        products: [line(), line({ lineItemId: "li_2", productId: "prod_2", ambienteInstanceId: "sis_luz-amb_suite" })],
        sistemas: SISTEMAS,
        // Campos da proposta que nunca podem chegar ao projeto.
        ...({ totalValue: 9999, closedValue: 8888, downPaymentValue: 100, installmentsCount: 3 } as object),
      },
      nextId,
    );

    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual([...PROJECT_ITEM_FIELDS].sort());
    }
    const json = JSON.stringify(items);
    for (const forbidden of [
      "unitPrice",
      "markup",
      "total",
      "price",
      "Price",
      "productDescription",
      "productImage",
      "437.5",
      "1225",
      "9999",
      "8888",
      "installments",
      "downPayment",
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("guarda nome, fabricante, quantidade, grupo e local, tudo pendente", () => {
    const [item] = buildProjectItemsFromProposal({ products: [line()], sistemas: SISTEMAS }, nextId);
    expect(item).toEqual<ProjectItem>({
      id: "li_1",
      productId: "prod_1",
      name: "Módulo de iluminação",
      manufacturer: "Sonoff",
      quantity: 2,
      groupName: "Iluminação",
      placeName: "Sala",
      measure: null,
      status: "pending",
      statusAt: null,
      statusBy: null,
      statusByName: null,
    });
  });

  it("deixa de fora serviço, linha inativa e linha sem nome", () => {
    const items = buildProjectItemsFromProposal(
      {
        products: [
          line({ lineItemId: "a" }),
          line({ lineItemId: "b", itemType: "service", productName: "Instalação" }),
          line({ lineItemId: "c", status: "inactive" }),
          line({ lineItemId: "d", _isInactive: true }),
          line({ lineItemId: "e", productName: "", name: "" }),
        ],
        sistemas: SISTEMAS,
      },
      nextId,
    );
    expect(items.map((i) => i.id)).toEqual(["a"]);
  });

  it("linha por medida guarda a medida e conta as peças, não a área", () => {
    const items = buildProjectItemsFromProposal(
      {
        products: [
          line({
            lineItemId: "rolo",
            quantity: 8.64,
            pricingDetails: { mode: "curtain_meter", width: 1.8, height: 2.4, area: 4.32, panels: 2 },
          }),
          line({
            lineItemId: "wave",
            pricingDetails: { mode: "curtain_height", width: 3.2, tierId: "t30", maxHeight: 3, panels: 1 },
          }),
          line({ lineItemId: "toldo", pricingDetails: { mode: "curtain_width", width: 4, panels: 1 } }),
          // Medida sem largura (linha nunca preenchida) não é medida.
          line({ lineItemId: "vazio", quantity: 3, pricingDetails: { mode: "curtain_width", width: 0, panels: 1 } }),
        ],
        sistemas: SISTEMAS,
      },
      nextId,
    );
    expect(items[0]).toMatchObject({
      quantity: 2,
      measure: { mode: "curtain_meter", width: 1.8, height: 2.4, panels: 2 },
    });
    expect(items[0].measure).not.toHaveProperty("area");
    expect(items[1].measure).toEqual({ mode: "curtain_height", width: 3.2, maxHeight: 3, panels: 1 });
    expect(items[1].measure).not.toHaveProperty("tierId");
    expect(items[2].measure).toEqual({ mode: "curtain_width", width: 4, panels: 1 });
    expect(items[3]).toMatchObject({ measure: null, quantity: 3 });
  });

  it("id repetido ou ausente ganha um novo; linha sem grupo fica sem local", () => {
    const items = buildProjectItemsFromProposal(
      {
        products: [
          line({ lineItemId: "x" }),
          line({ lineItemId: "x" }),
          line({ lineItemId: "", ambienteInstanceId: "", systemInstanceId: "" }),
        ],
        sistemas: SISTEMAS,
      },
      nextId,
    );
    expect(items.map((i) => i.id)).toEqual(["x", "gen_1", "gen_2"]);
    expect(items[2]).toMatchObject({ groupName: null, placeName: null });
  });

  it("proposta sem produtos ou malformada vira lista vazia", () => {
    expect(buildProjectItemsFromProposal({}, nextId)).toEqual([]);
    expect(buildProjectItemsFromProposal({ products: "x", sistemas: 3 }, nextId)).toEqual([]);
    expect(buildProjectItemsFromProposal({ products: [null, 7] }, nextId)).toEqual([]);
  });

  it("respeita o teto da lista", () => {
    const products = Array.from({ length: MAX_PROJECT_ITEMS + 5 }, (_, i) => line({ lineItemId: `l${i}` }));
    expect(buildProjectItemsFromProposal({ products }, nextId)).toHaveLength(MAX_PROJECT_ITEMS);
  });
});

describe("applyItemsStatus", () => {
  const base = () =>
    buildProjectItemsFromProposal(
      { products: [line({ lineItemId: "a" }), line({ lineItemId: "b" }), line({ lineItemId: "c" })] },
      nextId,
    );
  const actor = { uid: "u1", name: "Ana", now: "2026-10-05T12:00:00.000Z" };

  it("marca vários de uma vez com quem e quando", () => {
    const result = applyItemsStatus(base(), ["a", "c"], "in_stock", actor);
    expect(result.changed).toBe(2);
    expect(result.missing).toEqual([]);
    expect(result.items.map((i) => i.status)).toEqual(["in_stock", "pending", "in_stock"]);
    expect(result.items[0]).toMatchObject({ statusAt: actor.now, statusBy: "u1", statusByName: "Ana" });
    expect(result.items[1].statusBy).toBeNull();
  });

  it("item que já estava na situação mantém a marcação original", () => {
    const first = applyItemsStatus(base(), ["a"], "installed", actor).items;
    const again = applyItemsStatus(first, ["a", "b"], "installed", { uid: "u2", name: "Bia", now: "2026-10-06T00:00:00.000Z" });
    expect(again.changed).toBe(1);
    expect(again.items[0]).toMatchObject({ statusBy: "u1", statusAt: actor.now });
    expect(again.items[1]).toMatchObject({ statusBy: "u2" });
  });

  it("aponta o id que não existe", () => {
    expect(applyItemsStatus(base(), ["a", "zzz"], "installed", actor).missing).toEqual(["zzz"]);
  });
});

describe("UpdateItemsStatusSchema", () => {
  it("aceita as quatro situações e recusa o resto", () => {
    for (const status of ["pending", "purchase_requested", "in_stock", "installed"]) {
      expect(UpdateItemsStatusSchema.safeParse({ itemIds: ["a"], status }).success).toBe(true);
    }
    expect(UpdateItemsStatusSchema.safeParse({ itemIds: ["a"], status: "delivered" }).success).toBe(false);
    expect(UpdateItemsStatusSchema.safeParse({ itemIds: [], status: "installed" }).success).toBe(false);
    expect(UpdateItemsStatusSchema.safeParse({ itemIds: ["a"], status: "installed", price: 1 }).success).toBe(false);
  });
});
