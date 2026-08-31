// @vitest-environment jsdom
/**
 * O contato criado junto com a proposta precisa nascer com CPF/CNPJ.
 *
 * O bug: o formulário da proposta não tinha o campo e o submit chamava
 * `createClient` sem `document`. O contato era criado sem documento, e isso só
 * aparecia muito depois — na emissão da nota, como uma lacuna que só dava para
 * resolver refazendo o cadastro pela página de Contatos.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/services/proposal-service", () => ({
  ProposalService: {
    createProposal: vi.fn(async () => ({ id: "prop-1" })),
    updateProposal: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/proposal-hide-zero-qty-storage", () => ({
  migrateDraftHideZeroQtyStateToProposal: vi.fn(),
}));
vi.mock("../submit-helpers", () => ({
  prepareCreatePayload: vi.fn(() => ({})),
}));

import { useProposalFormProductSubmit } from "../useProposalForm.product-submit";
import type { CreateClientData } from "@/hooks/useClientActions";

/** Assinatura real — sem ela `mock.calls` vira tupla vazia e não se indexa. */
type CreateClientFn = (
  data: CreateClientData,
  options?: { suppressSuccessToast?: boolean },
) => Promise<{ success: boolean; clientId: string; message: string } | null>;

const createClient = vi.fn<CreateClientFn>(async () => ({
  success: true,
  clientId: "cli-1",
  message: "ok",
}));

/** `{}` quando não houve chamada — a asserção falha em vez de estourar. */
function createClientPayload(): Partial<CreateClientData> {
  const [payload] = createClient.mock.calls[0] ?? [];
  return payload ?? {};
}

function buildCtx(overrides: Record<string, unknown> = {}) {
  return {
    formData: {
      title: "Casa Silva",
      clientName: "José Francisco",
      clientEmail: "jose@exemplo.com",
      clientPhone: "(35) 99999-9999",
      clientAddress: "Rua A, 100",
      products: [],
    },
    setFormData: vi.fn(),
    selectedSistemas: [],
    products: [],
    proposalId: undefined,
    canCreateProposal: vi.fn(async () => true),
    getProposalCount: vi.fn(async () => 0),
    setCurrentProposalCount: vi.fn(),
    setShowLimitModal: vi.fn(),
    tenant: { id: "tenant-1" },
    setIsSaving: vi.fn(),
    selectedClientId: undefined,
    isNewClient: true,
    createClient,
    clientTypes: ["cliente"],
    latestStateRef: { current: { hasSaved: false } },
    router: { push: vi.fn() },
    ...overrides,
  };
}

async function submit(ctx: ReturnType<typeof buildCtx>) {
  const { result } = renderHook(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useProposalFormProductSubmit(ctx as any),
  );
  await act(async () => {
    await result.current.handleSubmit({
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent);
  });
}

describe("criação do contato junto com a proposta", () => {
  beforeEach(() => createClient.mockClear());

  it("envia o CPF/CNPJ digitado no formulário", async () => {
    await submit(buildCtx({ newClientDocument: "529.982.247-25" }));

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClientPayload()).toMatchObject({
      name: "José Francisco",
      document: "529.982.247-25",
    });
  });

  it("omite o documento quando não foi preenchido, em vez de mandar vazio", async () => {
    // O campo é opcional; string vazia faria o backend tratar como informado.
    await submit(buildCtx({ newClientDocument: "" }));

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClientPayload().document).toBeUndefined();
  });

  it("omite documento em branco só de espaços", async () => {
    await submit(buildCtx({ newClientDocument: "   " }));

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClientPayload().document).toBeUndefined();
  });

  it("não cria contato nenhum quando um já foi selecionado", async () => {
    await submit(
      buildCtx({
        isNewClient: false,
        selectedClientId: "cli-existente",
        newClientDocument: "529.982.247-25",
      }),
    );

    expect(createClient).not.toHaveBeenCalled();
  });
});
