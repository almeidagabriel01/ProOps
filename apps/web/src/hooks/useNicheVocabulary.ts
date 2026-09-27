"use client";

import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import type { NicheVocabulary } from "@/lib/niches/vocabulary";

/**
 * O vocabulário do nicho da empresa (local e grupo). Só dentro do app: no PDF e
 * no `/share`, que rodam sem TenantProvider, use
 * `getNicheConfig(tenantNiche).vocabulary`.
 */
export function useNicheVocabulary(): NicheVocabulary {
  return useCurrentNicheConfig().vocabulary;
}
