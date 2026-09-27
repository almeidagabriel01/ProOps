"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { mapProposalDoc } from "@/services/proposal-service";
import { isFirestorePermissionError } from "@/lib/firestore-error";
import type { Proposal } from "@/types/proposal";

export interface ClientResponses {
  /** Os dois listeners já responderam; antes disso, vale o dado da lista. */
  ready: boolean;
  /** Propostas com aceite do cliente aguardando confirmação. */
  acceptances: Map<string, Proposal>;
  /** Propostas com pedido de mudanças aberto. */
  changeRequests: Map<string, Proposal>;
}

const EMPTY: ClientResponses = { ready: false, acceptances: new Map(), changeRequests: new Map() };
const MAX_OPEN_RESPONSES = 100;

/**
 * Respostas do cliente pelo link (aceite pendente e pedido de mudanças) em
 * tempo real. A lista de propostas é lida uma vez e não saberia do aceite que
 * chegou com a tela aberta: sem isto era preciso F5 para ver o selo.
 *
 * Só escuta o que está EM ABERTO (duas consultas por igualdade, índice
 * automático), então o custo é o de poucos documentos, não o da coleção.
 */
export function useClientResponses(tenantId: string | undefined | null): ClientResponses {
  const [acceptances, setAcceptances] = React.useState<Map<string, Proposal> | null>(null);
  const [changeRequests, setChangeRequests] = React.useState<Map<string, Proposal> | null>(null);

  React.useEffect(() => {
    if (!tenantId) return;
    setAcceptances(null);
    setChangeRequests(null);

    const listen = (
      field: string,
      value: string,
      set: (map: Map<string, Proposal>) => void,
    ) =>
      onSnapshot(
        query(
          collection(db, "proposals"),
          where("tenantId", "==", tenantId),
          where(field, "==", value),
          limit(MAX_OPEN_RESPONSES),
        ),
        (snap) => set(new Map(snap.docs.map((d) => [d.id, mapProposalDoc(d)]))),
        (error) => {
          // Sem permissão (ou índice), cai no dado da lista em vez de quebrar a tela.
          if (!isFirestorePermissionError(error)) {
            console.error("[useClientResponses] listener error:", error);
          }
          set(new Map());
        },
      );

    const stopAcceptances = listen("clientAcceptance.status", "pending", setAcceptances);
    const stopChanges = listen("clientChangeRequest.status", "open", setChangeRequests);
    return () => {
      stopAcceptances();
      stopChanges();
    };
  }, [tenantId]);

  return React.useMemo(
    () =>
      acceptances && changeRequests
        ? { ready: true, acceptances, changeRequests }
        : EMPTY,
    [acceptances, changeRequests],
  );
}
