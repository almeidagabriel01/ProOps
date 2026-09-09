import { describe, expect, it } from "vitest";

import {
  flattenMenuItems,
  menuItems,
} from "@/components/layout/navigation-config";
import { PERMISSION_PAGES } from "@/lib/permissions/pages";
import { PAGE_CONFIG } from "@/lib/page-config";

/**
 * O menu declara chaves que outras listas precisam reconhecer. Uma chave que só
 * existe aqui não dá erro em lugar nenhum: ela nega todo mundo, para sempre, em
 * silêncio. Foi o que aconteceu com o pageId "financial", que o achatamento
 * gravava nos três filhos do Financeiro e que PERMISSION_PAGES nunca teve.
 */

const KNOWN_PAGE_IDS = new Set(PERMISSION_PAGES.map((page) => page.id));

describe("menuItems", () => {
  it("todo pageId declarado existe em PERMISSION_PAGES", () => {
    const declared = new Set<string>();
    for (const item of menuItems) {
      if (item.pageId) declared.add(item.pageId);
      for (const child of item.children ?? []) {
        if (child.pageId) declared.add(child.pageId);
      }
    }

    const desconhecidos = [...declared].filter((id) => !KNOWN_PAGE_IDS.has(id));
    expect(desconhecidos).toEqual([]);
  });

  it("todo destino de folha existe em PAGE_CONFIG", () => {
    const semConfig = flattenMenuItems(menuItems)
      .filter((leaf) => !leaf.href.startsWith("http"))
      .map((leaf) => leaf.href)
      .filter((href) => !(href in PAGE_CONFIG));

    expect(semConfig).toEqual([]);
  });

  it("o pageId de um filho concorda com o que PAGE_CONFIG diz da rota dele", () => {
    for (const item of menuItems) {
      for (const child of item.children ?? []) {
        const config = PAGE_CONFIG[child.href];
        if (!config?.pageId || !child.pageId) continue;
        expect(
          { href: child.href, pageId: child.pageId },
          `${child.label} diverge de PAGE_CONFIG`,
        ).toEqual({ href: child.href, pageId: config.pageId });
      }
    }
  });

  it("a dock oferece 8 destinos de topo", () => {
    expect(menuItems).toHaveLength(8);
  });

  it("grupo nao declara href nem pageId proprios", () => {
    for (const item of menuItems) {
      if (!item.children) continue;
      expect({ label: item.label, href: item.href, pageId: item.pageId }).toEqual(
        { label: item.label, href: undefined, pageId: undefined },
      );
    }
  });
});
