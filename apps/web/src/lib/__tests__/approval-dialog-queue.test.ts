import { beforeEach, describe, expect, it } from "vitest";
import {
  APPROVAL_DIALOG_PRIORITY,
  hasApprovalDialogTurn,
  releaseApprovalDialog,
  requestApprovalDialog,
  resetApprovalDialogQueue,
} from "../approval-dialog-queue";

const { invoice, project } = APPROVAL_DIALOG_PRIORITY;

beforeEach(() => resetApprovalDialogQueue());

describe("fila de diálogos pós-aprovação", () => {
  it("chegando juntos, a nota fiscal passa na frente do projeto", () => {
    requestApprovalDialog("nota", invoice);
    requestApprovalDialog("projeto", project);
    expect(hasApprovalDialogTurn("nota")).toBe(true);
    expect(hasApprovalDialogTurn("projeto")).toBe(false);

    releaseApprovalDialog("nota");
    expect(hasApprovalDialogTurn("projeto")).toBe(true);
  });

  it("quem já está na tela não é trocado por um de prioridade maior que chegou depois", () => {
    requestApprovalDialog("projeto", project);
    requestApprovalDialog("nota", invoice);
    expect(hasApprovalDialogTurn("projeto")).toBe(true);
    expect(hasApprovalDialogTurn("nota")).toBe(false);

    releaseApprovalDialog("projeto");
    expect(hasApprovalDialogTurn("nota")).toBe(true);
  });

  it("pedir duas vezes não duplica; soltar quem não está na fila não quebra", () => {
    requestApprovalDialog("nota", invoice);
    requestApprovalDialog("nota", invoice);
    releaseApprovalDialog("nota");
    releaseApprovalDialog("nota");
    expect(hasApprovalDialogTurn("nota")).toBe(false);
  });

  it("fila vazia: ninguém tem a vez", () => {
    expect(hasApprovalDialogTurn("projeto")).toBe(false);
  });
});
