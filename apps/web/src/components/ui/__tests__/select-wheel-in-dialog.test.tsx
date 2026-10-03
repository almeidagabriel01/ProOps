// @vitest-environment jsdom
/**
 * A lista do Select abre num portal fora da janela, e a trava de rolagem do
 * Radix (que escuta no document) cancelava a roda do mouse nela: dentro de
 * uma janela a lista não rolava. A lista para a propagação do evento.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

function Harness() {
  const [value, setValue] = React.useState("1");
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Novo</DialogTitle>
        <DialogDescription>Teste</DialogDescription>
        <Select id="dia" value={value} onChange={(e) => setValue(e.target.value)} disableSort>
          {Array.from({ length: 28 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              Todo dia {i + 1}
            </option>
          ))}
        </Select>
      </DialogContent>
    </Dialog>
  );
}

const listeners: Array<() => void> = [];
afterEach(() => listeners.splice(0).forEach((off) => off()));

function onDocument(type: string) {
  const spy = vi.fn();
  document.addEventListener(type, spy);
  listeners.push(() => document.removeEventListener(type, spy));
  return spy;
}

describe("Select dentro de janela", () => {
  it("a roda do mouse e o toque na lista não chegam ao document (onde a trava escuta)", () => {
    render(<Harness />);
    const trigger = screen.getByText("Todo dia 1", { selector: "span" });
    fireEvent.mouseDown(trigger);
    const option = screen.getByText("Todo dia 28", { selector: "span" });

    const wheel = onDocument("wheel");
    const touch = onDocument("touchmove");
    fireEvent.wheel(option, { deltaY: 200 });
    fireEvent.touchMove(option);
    expect(wheel).not.toHaveBeenCalled();
    expect(touch).not.toHaveBeenCalled();
  });

  it("fora da lista, o evento segue normal", () => {
    render(<Harness />);
    const wheel = onDocument("wheel");
    fireEvent.wheel(screen.getByText("Novo"), { deltaY: 200 });
    expect(wheel).toHaveBeenCalled();
  });
});
