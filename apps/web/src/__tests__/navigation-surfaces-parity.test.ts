import { describe, expect, it } from "vitest";

import {
  flattenMenuItems,
  menuItems,
} from "@/components/layout/navigation-config";
import { searchItems } from "@/components/ui/command-palette-items";

/**
 * O projeto tem quatro listas de navegação: o menu, o command palette, o
 * PAGE_CONFIG e as páginas de permissão. Elas servem a coisas diferentes, e por
 * isso não podem ser uma só, mas já divergiram antes em silêncio: Comissões e
 * Ambientes existiram no menu e não no palette, e ninguém percebeu porque
 * nenhuma delas quebra nada ao faltar, só some.
 *
 * Este guard afirma a direção que importa: todo destino que o menu oferece tem
 * que ser encontrável na busca. O contrário não vale, o palette tem atalhos de
 * ação ("Nova Receita") e destinos de conta que nunca foram itens de menu.
 */

const CAMINHOS_SO_DO_PALETTE = new Set([
  // Alcançados pelo menu do avatar, não pela dock.
  "/profile",
  "/profile?tab=billing",
  "/settings",
  "/settings/team",
  // Atalhos de criação, não destinos de navegação.
  "/proposals/new",
  "/products/new",
  "/services/new",
  "/contacts/new",
  "/transactions/new?type=income",
  "/transactions/new?type=expense",
]);

describe("paridade entre o menu e o command palette", () => {
  it("todo destino do menu é encontrável na busca", () => {
    const caminhosDoPalette = new Set(searchItems.map((item) => item.path));

    const ausentes = flattenMenuItems(menuItems)
      .map((leaf) => leaf.href)
      .filter((href) => !caminhosDoPalette.has(href));

    expect(ausentes).toEqual([]);
  });

  it("todo destino do palette é do menu ou está declarado como exceção", () => {
    const caminhosDoMenu = new Set(
      flattenMenuItems(menuItems).map((leaf) => leaf.href),
    );

    const naoExplicados = searchItems
      .map((item) => item.path)
      .filter(
        (path) =>
          !caminhosDoMenu.has(path) && !CAMINHOS_SO_DO_PALETTE.has(path),
      );

    expect(naoExplicados).toEqual([]);
  });
});
