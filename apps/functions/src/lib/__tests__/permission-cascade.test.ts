/**
 * Regressão: a cascata "desligar Ver zera criar/editar/excluir" existia SÓ no
 * cliente (team-management.tsx). A API aceitava `canCreate: true` com
 * `canView: false`, gravando um estado que nenhuma tela consegue produzir e
 * que a UI não sabe representar — o membro não vê a página, mas o backend
 * autoriza a escrita.
 */

import { normalizePagePermission } from "../auth-helpers";

describe("normalizePagePermission", () => {
  it("preserva as acoes quando canView esta ligado", () => {
    expect(
      normalizePagePermission({
        canView: true,
        canCreate: true,
        canEdit: false,
        canDelete: true,
      }),
    ).toEqual({
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: true,
    });
  });

  it("zera as tres acoes quando canView esta desligado", () => {
    expect(
      normalizePagePermission({
        canView: false,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      }),
    ).toEqual({
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
  });

  it("trata campo ausente como desligado", () => {
    expect(normalizePagePermission({})).toEqual({
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
  });

  it("canView sozinho nao liga nada mais", () => {
    expect(normalizePagePermission({ canView: true })).toEqual({
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
    });
  });
});
