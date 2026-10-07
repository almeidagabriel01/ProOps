// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/**
 * De quem é o Perfil. No "Acessar Painel" ele mostrava um membro qualquer da
 * empresa no lugar do dono; no "Ver como membro" mostrava a mesma pessoa
 * errada em vez do membro visto.
 */

type TestUser = { id: string; name: string; email: string; role: string };

let authUser: TestUser | null = null;
let tenant: { id: string } | null = null;
let viewingMember: { id: string; name: string; email: string; role: string; masterId: string | null } | null = null;
let memberLoading = false;

const getTenantOwnerUser = vi.fn();
const getUserById = vi.fn();

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant }) }));
vi.mock("@/providers/viewing-member-provider", () => ({
  useViewingMember: () => ({ member: viewingMember, isLoading: memberLoading }),
}));
vi.mock("@/services/user-service", () => ({
  UserService: {
    getTenantOwnerUser: (id: string) => getTenantOwnerUser(id),
    getUserById: (id: string) => getUserById(id),
  },
}));

import { resolveProfileSubjectMode, useProfileSubject } from "../use-profile-subject";

const superadmin: TestUser = { id: "root", name: "Suporte", email: "suporte@proops.com.br", role: "superadmin" };
const dono: TestUser = { id: "dono", name: "Dono AWA", email: "dono@awa.com", role: "admin" };
const membro: TestUser = { id: "membro", name: "Vendedora", email: "vendedora@awa.com", role: "member" };

beforeEach(() => {
  authUser = superadmin;
  tenant = { id: "awa" };
  viewingMember = null;
  memberLoading = false;
  getTenantOwnerUser.mockReset().mockResolvedValue(dono);
  getUserById.mockReset().mockResolvedValue(membro);
});

describe("resolveProfileSubjectMode", () => {
  it.each([
    [{ role: "admin", viewingTenantId: "t1" }, "self"],
    [{ role: "member", viewingTenantId: "t1", viewingMemberId: "m1" }, "self"],
    [{ role: "free", viewingTenantId: "t1" }, "self"],
    [{ role: "superadmin", viewingTenantId: null }, "self"],
    [{ role: "superadmin", viewingTenantId: "t1" }, "owner"],
    [{ role: "SUPERADMIN", viewingTenantId: "t1" }, "owner"],
    [{ role: "superadmin", viewingTenantId: "t1", viewingMemberId: "m1" }, "member"],
  ])("%j → %s", (input, expected) => {
    expect(resolveProfileSubjectMode(input)).toBe(expected);
  });
});

describe("useProfileSubject", () => {
  it("usuário comum vê a própria conta, sem buscar ninguém", () => {
    authUser = dono;
    const { result } = renderHook(() => useProfileSubject());
    expect(result.current).toMatchObject({ mode: "self", subject: dono, billingUser: dono, isLoading: false });
    expect(getTenantOwnerUser).not.toHaveBeenCalled();
  });

  it("super admin no próprio painel vê a própria conta", () => {
    tenant = null;
    const { result } = renderHook(() => useProfileSubject());
    expect(result.current).toMatchObject({ mode: "self", subject: superadmin });
  });

  it("Acessar Painel: o Perfil é do dono, e a assinatura também", async () => {
    const { result } = renderHook(() => useProfileSubject());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ mode: "owner", subject: dono, billingUser: dono });
    expect(getTenantOwnerUser).toHaveBeenCalledWith("awa");
  });

  it("Ver como membro: dados pessoais do membro, assinatura do dono", async () => {
    viewingMember = { id: "membro", name: "Vendedora", email: "vendedora@awa.com", role: "MEMBER", masterId: "dono" };
    const { result } = renderHook(() => useProfileSubject());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ mode: "member", subject: membro, billingUser: dono });
    expect(getUserById).toHaveBeenCalledWith("membro");
  });

  it("Ver como membro sem acesso ao doc: cai nos dados da lista de membros", async () => {
    viewingMember = { id: "membro", name: "Vendedora", email: "vendedora@awa.com", role: "MEMBER", masterId: "dono" };
    getUserById.mockResolvedValue(null);
    const { result } = renderHook(() => useProfileSubject());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subject).toMatchObject({ id: "membro", email: "vendedora@awa.com" });
  });

  it("empresa sem dono: nada no lugar, em vez de outra pessoa", async () => {
    getTenantOwnerUser.mockResolvedValue(null);
    const { result } = renderHook(() => useProfileSubject());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ mode: "owner", subject: null, billingUser: null });
  });

  it("enquanto o membro visto carrega, não mostra o dono no lugar dele", () => {
    memberLoading = true;
    const { result } = renderHook(() => useProfileSubject());
    expect(result.current).toMatchObject({ isLoading: true, subject: null });
  });
});
