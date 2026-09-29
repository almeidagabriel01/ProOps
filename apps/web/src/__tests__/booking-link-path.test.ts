import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O link de agendamento é montado em dois lugares: a tela de configuração (o
 * link que a empresa copia) e o e-mail de recusa do backend ("escolher outro
 * horário"). Os dois precisam cair na rota pública que existe. Ela mora sob
 * `/share` para herdar o tratamento de página pública (sem sessão, fora do
 * índice, sem 301 do apex).
 */
const WEB_SRC = path.resolve(__dirname, "..");
const ROUTE = path.join(WEB_SRC, "app", "share", "visita", "[token]", "page.tsx");

describe("caminho do link de agendamento", () => {
  it("a rota pública existe", () => {
    expect(existsSync(ROUTE)).toBe(true);
  });

  it("a tela de configuração monta o link nessa rota", () => {
    const card = readFileSync(path.join(WEB_SRC, "app", "booking", "_components", "booking-settings-panel.tsx"), "utf8");
    expect(card).toContain("/share/visita/${settings.publicToken}");
  });

  it("o e-mail de recusa do backend aponta para a mesma rota", () => {
    const service = readFileSync(
      path.resolve(WEB_SRC, "../../functions/src/api/services/booking/booking.service.ts"),
      "utf8",
    );
    expect(service).toContain("/share/visita/${rebookToken}");
    expect(service).not.toMatch(/[^e]\/visita\/\$\{/);
  });
});
