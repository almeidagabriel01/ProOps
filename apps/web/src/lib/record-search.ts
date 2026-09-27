import type { RecentRecord } from "@/lib/command-palette-recents";

/** Registro achado pela busca global; mesmo formato do recente. */
export type RecordResult = RecentRecord;

interface ProposalLike {
  id: string;
  title?: string;
  clientName?: string;
  proposalCode?: string | null;
}

interface ClientLike {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export function proposalToRecord(proposal: ProposalLike): RecordResult {
  const description = [proposal.proposalCode, proposal.clientName]
    .filter(Boolean)
    .join(" · ");
  return {
    kind: "proposal",
    id: proposal.id,
    label: proposal.title?.trim() || "Proposta sem título",
    description: description || undefined,
    path: `/proposals/${proposal.id}`,
  };
}

export function clientToRecord(client: ClientLike): RecordResult {
  return {
    kind: "contact",
    id: client.id,
    label: client.name?.trim() || "Contato sem nome",
    description: client.email || client.phone || undefined,
    path: `/contacts/${client.id}`,
  };
}
