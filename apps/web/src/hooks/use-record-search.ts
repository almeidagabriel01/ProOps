"use client";

import * as React from "react";
import { ProposalService } from "@/services/proposal-service";
import { ClientService } from "@/services/client-service";
import { firstSearchToken } from "@/lib/search-term";
import {
  proposalToRecord,
  clientToRecord,
  type RecordResult,
} from "@/lib/record-search";

const DEBOUNCE_MS = 250;
const MAX_PER_KIND = 5;

interface UseRecordSearchOptions {
  tenantId?: string | null;
  canSearchProposals: boolean;
  canSearchContacts: boolean;
}

/**
 * Busca propostas e contatos pelo índice `searchTokens` para a busca global
 * (Ctrl+K). Não baixa coleção nenhuma: cada termo custa no máximo duas
 * consultas com `limit`. Resposta de um termo antigo que chega depois é
 * descartada.
 */
export function useRecordSearch(
  term: string,
  { tenantId, canSearchProposals, canSearchContacts }: UseRecordSearchOptions,
) {
  const [results, setResults] = React.useState<RecordResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const requestRef = React.useRef(0);

  const searchable =
    Boolean(tenantId) &&
    (canSearchProposals || canSearchContacts) &&
    firstSearchToken(term) !== null;

  React.useEffect(() => {
    const requestId = ++requestRef.current;
    if (!searchable || !tenantId) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = window.setTimeout(async () => {
      const [proposals, clients] = await Promise.all([
        canSearchProposals
          ? ProposalService.searchProposals(tenantId, term, 20).catch(() => [])
          : Promise.resolve([]),
        canSearchContacts
          ? ClientService.searchClients(tenantId, term, 20).catch(() => [])
          : Promise.resolve([]),
      ]);
      if (requestId !== requestRef.current) return;
      setResults([
        ...proposals.slice(0, MAX_PER_KIND).map(proposalToRecord),
        ...clients.slice(0, MAX_PER_KIND).map(clientToRecord),
      ]);
      setIsLoading(false);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [term, tenantId, searchable, canSearchProposals, canSearchContacts]);

  return { results, isLoading };
}
