import { FALLBACK_NICHE, nicheBackfillUpdate } from "../backfill-tenant-niche";

/**
 * O nicho fica travado depois de gravado. Empresa antiga sem nicho válido
 * precisa recebê-lo antes da trava, e o sistema já a tratava como automação.
 */
describe("nicheBackfillUpdate", () => {
  it.each(["automacao_residencial", "cortinas", "seguranca_eletronica"])(
    "empresa com nicho %s fica como está",
    (niche) => {
      expect(nicheBackfillUpdate({ niche })).toBeNull();
    },
  );

  it.each([undefined, null, "", "decoracao", 3])("nicho %p vira automação", (niche) => {
    expect(nicheBackfillUpdate({ niche })).toEqual({ niche: FALLBACK_NICHE });
  });

  it("o padrão é o de automação, o que o sistema já assumia", () => {
    expect(FALLBACK_NICHE).toBe("automacao_residencial");
  });
});
