const STORAGE_PREFIX = "proposal-hide-zero-qty-by-environment";
const DRAFT_SCOPE = "draft";

function normalizeState(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, boolean>
  >((acc, [key, raw]) => {
    if (typeof raw === "boolean") {
      acc[key] = raw;
    }
    return acc;
  }, {});
}

export function getProposalHideZeroQtyStorageKey(proposalId?: string): string {
  const scope =
    typeof proposalId === "string" && proposalId.trim().length > 0
      ? proposalId.trim()
      : DRAFT_SCOPE;
  return `${STORAGE_PREFIX}:${scope}`;
}

export function readProposalHideZeroQtyState(
  proposalId?: string,
): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(
      getProposalHideZeroQtyStorageKey(proposalId),
    );
    if (!raw) return {};
    return normalizeState(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeProposalHideZeroQtyState(
  state: Record<string, boolean>,
  proposalId?: string,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getProposalHideZeroQtyStorageKey(proposalId),
      JSON.stringify(normalizeState(state)),
    );
  } catch {
    // ignore localStorage errors
  }
}

export function migrateDraftHideZeroQtyStateToProposal(proposalId: string): void {
  if (!proposalId || typeof window === "undefined") return;

  try {
    const draftKey = getProposalHideZeroQtyStorageKey();
    const proposalKey = getProposalHideZeroQtyStorageKey(proposalId);
    if (draftKey === proposalKey) return;

    const draftRaw = window.localStorage.getItem(draftKey);
    if (!draftRaw) return;

    const draftState = normalizeState(JSON.parse(draftRaw));
    if (Object.keys(draftState).length === 0) {
      window.localStorage.removeItem(draftKey);
      return;
    }

    const proposalRaw = window.localStorage.getItem(proposalKey);
    const proposalState = proposalRaw
      ? normalizeState(JSON.parse(proposalRaw))
      : {};

    const nextState = { ...draftState, ...proposalState };
    window.localStorage.setItem(proposalKey, JSON.stringify(nextState));
    window.localStorage.removeItem(draftKey);
  } catch {
    // ignore localStorage errors
  }
}
