import type {
  PdfDefinition,
  ProposalGroupsStepCopy,
  SolutionsPageDefinition,
  SolutionsPageMode,
} from "./config-types";
import { cap, do_, os, um, type NicheVocabulary } from "./vocabulary";

/**
 * Textos de tela que saem do vocabulário do nicho. Um nicho novo declara só o
 * vocabulário e ganha estes textos prontos; `overrides` fica para o texto
 * autoral ("Soluções de Automação").
 */

export function solutionsPageFor(
  v: NicheVocabulary,
  mode: SolutionsPageMode,
  overrides: Partial<SolutionsPageDefinition> = {},
): SolutionsPageDefinition {
  const title = cap(mode === "environment" ? v.place.plural : v.group.plural);
  return {
    navigationLabel: title,
    pageTitle: title,
    pageDescription:
      mode === "environment"
        ? `Gerencie ${os(v.place)} ${v.place.plural} e configure os produtos padrão de cada um.`
        : `Central de gerenciamento de ${v.group.plural} e ${v.place.plural}.`,
    mode,
    ...overrides,
  };
}

export function groupsStepFor(
  v: NicheVocabulary,
  overrides: Partial<ProposalGroupsStepCopy> = {},
): ProposalGroupsStepCopy {
  return {
    stepTitle: cap(v.group.plural),
    stepDescription: `Selecionar ${v.group.plural}`,
    heading: cap(v.group.plural),
    subheading: `Adicione ${os(v.group)} ${v.group.plural} da proposta`,
    cardDescription: `Adicione ${um(v.group)} ou mais ${v.group.plural} à proposta`,
    emptySelectionError: `Selecione pelo menos 1 ${v.group.singular} com produtos`,
    ...overrides,
  };
}

export function pdfCopyFor(
  v: NicheVocabulary,
  layout: Pick<PdfDefinition, "singleEnvironmentLayout" | "showEnvironmentHeaders">,
): PdfDefinition {
  return {
    ...layout,
    groupSubtotalLabel: `Subtotal ${do_(v.group)} ${cap(v.group.singular)}:`,
    groupSubtotalOptionLabel: `Mostrar subtotal por ${v.group.singular}`,
  };
}
