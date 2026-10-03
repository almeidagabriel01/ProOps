import { defaultPdfDisplaySettings } from "@/types/pdf-display-settings";

/**
 * `pdfSettings` da proposta (e `proposalDefaults` da empresa) guardam duas
 * metades num objeto só: o estilo, que o editor de PDF edita (tema, cor,
 * capa, seções), e as caixinhas de exibição, que o formulário da proposta
 * edita (mostrar preço, imagem, descrição...). O backend grava o campo
 * inteiro, sem mesclar.
 *
 * O editor gravava só a metade dele, e salvar no editor apagava as caixinhas:
 * o preço voltava a ficar oculto no PDF. Aqui o editor substitui as chaves
 * que ele conhece (inclusive para remover uma capa) e mantém o resto como
 * estava gravado.
 */
export function mergeEditorPdfSettings(
  saved: Record<string, unknown> | null | undefined,
  editor: Record<string, unknown>,
): Record<string, unknown> {
  const preserved = Object.fromEntries(
    Object.entries(saved ?? {}).filter(([key]) => !(key in editor)),
  );
  return { ...preserved, ...editor };
}

/**
 * Só as caixinhas de exibição, para guardar como padrão da empresa. São as
 * chaves que o backend aceita mudar sem o editor de PDF
 * (`PDF_DISPLAY_DEFAULT_KEYS`, em `catalog-plan-guards.ts`).
 */
export const PDF_DISPLAY_DEFAULT_KEYS = Object.keys(defaultPdfDisplaySettings);

export function pickPdfDisplayDefaults(
  settings: Record<string, unknown>,
): Record<string, boolean> {
  return Object.fromEntries(
    PDF_DISPLAY_DEFAULT_KEYS.filter((key) => typeof settings[key] === "boolean").map(
      (key) => [key, settings[key] as boolean],
    ),
  );
}
