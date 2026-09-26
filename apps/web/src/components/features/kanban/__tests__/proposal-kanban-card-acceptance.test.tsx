// @vitest-environment jsdom
/** O card do quadro avisa quando o cliente aceitou e a empresa ainda não confirmou. */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalKanbanCard } from "../kanban-card";

describe("ProposalKanbanCard", () => {
  it("mostra o selo do aceite pendente", () => {
    render(<ProposalKanbanCard title="Casa" awaitingAcceptanceConfirmation />);
    expect(screen.getByText(/Aceite do cliente: confirme/)).toBeInTheDocument();
  });

  it("sem aceite pendente, sem selo", () => {
    render(<ProposalKanbanCard title="Casa" />);
    expect(screen.queryByText(/Aceite do cliente/)).toBeNull();
  });
});
