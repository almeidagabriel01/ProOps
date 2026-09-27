import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  flattenMenuItems,
  menuItems,
} from "@/components/layout/navigation-config";

/**
 * Toda tela do menu tem o próprio `error.tsx`.
 *
 * Antes só existia o da raiz: um erro em qualquer módulo trocava a área
 * inteira por "Algo deu errado", sem dizer qual tela falhou e sem reportar ao
 * pipeline de observabilidade (o boundary do Next captura antes do `window`).
 * O `error.tsx` de cada rota usa `RouteError`, que reporta e mantém o menu.
 */

const APP_DIR = path.resolve(__dirname, "../app");

describe("error.tsx por módulo", () => {
  it("cada destino do menu tem error.tsx na pasta da rota", () => {
    const hrefs = new Set(flattenMenuItems(menuItems).map((item) => item.href));
    const missing = Array.from(hrefs).filter((href) => {
      const segment = href.split("/").filter(Boolean)[0];
      return !fs.existsSync(path.join(APP_DIR, segment, "error.tsx"));
    });
    expect(missing).toEqual([]);
  });

  it("os error.tsx usam RouteError, que reporta o erro", () => {
    const hrefs = new Set(flattenMenuItems(menuItems).map((item) => item.href));
    const offenders = Array.from(hrefs).filter((href) => {
      const segment = href.split("/").filter(Boolean)[0];
      const file = path.join(APP_DIR, segment, "error.tsx");
      return fs.existsSync(file) && !fs.readFileSync(file, "utf8").includes("RouteError");
    });
    expect(offenders).toEqual([]);
  });
});
