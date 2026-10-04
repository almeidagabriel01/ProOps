// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * No "Ver como membro" as leituras diretas do Firestore saem com o token do
 * superadmin, e as rules liberam tudo para ele. O "só as minhas" (tarefas, OS,
 * projetos, responsável) tem que vir do membro visto, senão o superadmin vê a
 * empresa inteira achando que está vendo o membro.
 */

let authUser: { id: string; role: string } | null = null;
let viewingMember: { id: string; role: string } | null = null;
let isMaster = false;

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: authUser }) }));
vi.mock("@/providers/viewing-member-provider", () => ({
  useViewingMember: () => ({ member: viewingMember }),
}));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/providers/permissions-provider", () => ({
  usePermissions: () => ({ isMaster, isDemo: false }),
}));

import { useEffectiveViewer } from "../use-effective-viewer";
import { useTaskReader } from "../use-task-reader";

beforeEach(() => {
  authUser = { id: "root", role: "superadmin" };
  viewingMember = null;
  isMaster = true;
});

describe("useEffectiveViewer", () => {
  it("fora da visão de membro é o usuário logado", () => {
    const { result } = renderHook(() => useEffectiveViewer());
    expect(result.current).toEqual({ uid: "root", role: "superadmin", isMemberView: false });
  });

  it("na visão de membro é o membro, com o papel dele", () => {
    viewingMember = { id: "vendedor", role: "MEMBER" };
    const { result } = renderHook(() => useEffectiveViewer());
    expect(result.current).toEqual({ uid: "vendedor", role: "member", isMemberView: true });
  });
});

describe("useTaskReader", () => {
  it("superadmin vendo a empresa lê as tarefas da empresa inteira", () => {
    const { result } = renderHook(() => useTaskReader());
    expect(result.current).toEqual({ tenantId: "t1", uid: "root", scope: "company" });
  });

  it("superadmin vendo um membro lê só as tarefas do membro", () => {
    viewingMember = { id: "vendedor", role: "MEMBER" };
    isMaster = false;
    const { result } = renderHook(() => useTaskReader());
    expect(result.current).toEqual({ tenantId: "t1", uid: "vendedor", scope: "mine" });
  });

  it("administrador visto lê a empresa inteira, como ele leria", () => {
    viewingMember = { id: "gerente", role: "ADMIN" };
    isMaster = true;
    const { result } = renderHook(() => useTaskReader());
    expect(result.current?.scope).toBe("company");
  });
});
