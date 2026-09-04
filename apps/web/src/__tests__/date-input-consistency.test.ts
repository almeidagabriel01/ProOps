import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O projeto tem um seletor de data proprio — `DatePicker` (`ui/date-picker.tsx`),
 * com calendario em portugues, navegacao por mes/ano, atalhos "Hoje" e "Limpar",
 * e popover em portal (funciona dentro de dialogo com `overflow-hidden`). Ele
 * esta em ~15 telas.
 *
 * Um `<input type="date">` nativo ao lado dele nao e so estetica: o controle do
 * navegador tem aparencia e idioma proprios por sistema operacional, e a ordem
 * dos campos muda com o locale — no mesmo formulario, dois campos de data se
 * comportariam de formas diferentes.
 *
 * Este guard varre o codigo porque a divergencia nao aparece em teste de rota:
 * os dois renderizam, os dois aceitam uma data, e a diferenca so existe aos
 * olhos de quem usa.
 *
 * Ao trocar um pelo outro, atencao a uma perda silenciosa: o `DatePicker`
 * repassa `min`/`max` apenas ao input ESCONDIDO, e o calendario nao os aplica —
 * quem dependia da validacao nativa precisa de aviso proprio.
 */

const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("seletor de data padronizado", () => {
  it("nenhuma tela usa o input de data nativo", () => {
    const infratores = walk(SRC)
      .filter((file) => file !== path.join(SRC, "components", "ui", "date-picker.tsx"))
      .filter((file) => /type=["']date["']/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));

    expect(infratores).toEqual([]);
  });
});
