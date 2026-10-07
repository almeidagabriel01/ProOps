import {
  isTenantOwnerCandidate,
  selectTenantOwnerDocs,
} from "../tenant-owner";

function userDoc(id: string, data: Record<string, unknown>) {
  return { id, get: (field: string) => data[field] };
}

const fakeTimestamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe("isTenantOwnerCandidate", () => {
  it("aceita quem não tem masterId e quem aponta para si mesmo", () => {
    expect(isTenantOwnerCandidate(userDoc("u1", { role: "ADMIN" }))).toBe(true);
    expect(isTenantOwnerCandidate(userDoc("u1", { role: "MASTER", masterId: "u1" }))).toBe(true);
  });

  it("recusa membro, mesmo com papel de administrador", () => {
    expect(isTenantOwnerCandidate(userDoc("m1", { role: "admin", masterId: "u1" }))).toBe(false);
    expect(isTenantOwnerCandidate(userDoc("m1", { role: "ADMIN", masterId: "u1" }))).toBe(false);
  });

  it("recusa superadmin", () => {
    expect(isTenantOwnerCandidate(userDoc("s1", { role: "SUPERADMIN" }))).toBe(false);
  });
});

describe("selectTenantOwnerDocs (aba Acesso do painel)", () => {
  it("caso da AWA: membro ADMIN mais novo não substitui o dono", () => {
    // A listagem vem ordenada por createdAt desc: o membro aparece antes.
    const docs = [
      userDoc("membro", {
        tenantId: "awa",
        role: "admin",
        masterId: "dono",
        createdAt: "2026-09-01T00:00:00.000Z",
      }),
      userDoc("dono", { tenantId: "awa", role: "ADMIN", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(selectTenantOwnerDocs(docs).map((d) => d.id)).toEqual(["dono"]);
  });

  it("dono gravado como MASTER com masterId igual a si mesmo", () => {
    const docs = [
      userDoc("membro", { tenantId: "t1", role: "ADMIN", masterId: "dono" }),
      userDoc("dono", { tenantId: "t1", role: "MASTER", masterId: "dono" }),
    ];
    expect(selectTenantOwnerDocs(docs).map((d) => d.id)).toEqual(["dono"]);
  });

  it("dois candidatos na mesma empresa: fica o mais antigo, como no Acessar Painel", () => {
    const docs = [
      userDoc("novo", { tenantId: "t1", role: "ADMIN", createdAt: fakeTimestamp("2026-05-01") }),
      userDoc("antigo", { tenantId: "t1", role: "ADMIN", createdAt: fakeTimestamp("2025-05-01") }),
    ];
    expect(selectTenantOwnerDocs(docs).map((d) => d.id)).toEqual(["antigo"]);
  });

  it("empresa só com membro na página some, em vez de mostrar o membro", () => {
    const docs = [userDoc("membro", { tenantId: "t1", role: "admin", masterId: "dono" })];
    expect(selectTenantOwnerDocs(docs)).toEqual([]);
  });

  it("mantém a ordem das empresas e conta free sem tenant", () => {
    const docs = [
      userDoc("b", { tenantId: "tb", role: "free" }),
      userDoc("semTenant", { role: "free" }),
      userDoc("a", { tenantId: "ta", role: "MASTER" }),
    ];
    expect(selectTenantOwnerDocs(docs).map((d) => d.id)).toEqual(["b", "semTenant", "a"]);
  });
});
