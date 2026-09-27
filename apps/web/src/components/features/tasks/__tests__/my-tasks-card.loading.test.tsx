// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * O card de tarefas do Dashboard mostrava um "carregando" de 128px que sumia
 * quando não havia tarefa, e os gráficos subiam de uma vez: CLS de 0,15 no CI.
 * Agora ele não desenha nada enquanto carrega e avisa o Dashboard, que só
 * mostra a parte de cima com tudo pronto.
 */

const m = vi.hoisted(() => ({
  perm: { canView: true, canEdit: true, canDelete: true },
  tasks: { reader: { tenantId: "t1", uid: "u1", scope: "company" } as unknown, isDemo: false, tasks: [] as unknown[], loading: true },
}));

vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perm }));
vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ ...m.tasks, people: [], upsert: vi.fn(), removeLocal: vi.fn(), toggleDone: vi.fn() }),
}));
vi.mock("../task-dialog", () => ({ TaskDialog: () => null }));
vi.mock("../task-row", () => ({ TaskRow: () => null }));

import { MyTasksCard } from "../my-tasks-card";

beforeEach(() => {
  m.perm = { canView: true, canEdit: true, canDelete: true };
  m.tasks = { reader: { tenantId: "t1", uid: "u1", scope: "company" }, isDemo: false, tasks: [], loading: true };
});

describe("Minhas tarefas no Dashboard", () => {
  it("carregando: não ocupa espaço e avisa que ainda carrega", () => {
    const onLoadingChange = vi.fn();
    const { container } = render(<MyTasksCard onLoadingChange={onLoadingChange} />);
    expect(container).toBeEmptyDOMElement();
    expect(onLoadingChange).toHaveBeenLastCalledWith(true);
  });

  it("carregado e sem tarefa: continua sem ocupar espaço e libera o Dashboard", () => {
    m.tasks.loading = false;
    const onLoadingChange = vi.fn();
    const { container } = render(<MyTasksCard onLoadingChange={onLoadingChange} />);
    expect(container).toBeEmptyDOMElement();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });

  it("sem acesso a Tarefas: libera o Dashboard na hora", () => {
    m.perm = { canView: false, canEdit: false, canDelete: false };
    const onLoadingChange = vi.fn();
    render(<MyTasksCard onLoadingChange={onLoadingChange} />);
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });
});
