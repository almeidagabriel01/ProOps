// @vitest-environment jsdom
/**
 * Um clique sem querer fora da janela fechava a OS em montagem e levava tudo
 * o que já tinha sido digitado. As janelas do módulo só fecham pelo X, pelo
 * Esc ou pelos botões.
 */

import "@testing-library/jest-dom/vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { keepOpenOnOutsideClick } from "@/lib/field-service/service-orders";

function Harness({ guarded }: { guarded: boolean }) {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <button type="button">Fora da janela</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onInteractOutside={guarded ? keepOpenOnOutsideClick : undefined}>
          <DialogTitle>Nova OS</DialogTitle>
          <DialogDescription>Formulário</DialogDescription>
          <input aria-label="Título" defaultValue="Troca do compressor" />
        </DialogContent>
      </Dialog>
    </>
  );
}

// O Radix só passa a escutar o clique fora um tick depois de abrir.
async function clickOutside() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const outside = screen.getByText("Fora da janela");
  fireEvent.pointerDown(outside);
  fireEvent.mouseDown(outside);
  fireEvent.pointerUp(outside);
  fireEvent.click(outside);
}

describe("janelas da assistência técnica", () => {
  it("não fecham com clique fora", async () => {
    render(<Harness guarded />);
    await clickOutside();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Troca do compressor");
  });

  it("continuam fechando pelo Esc", () => {
    render(<Harness guarded />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sem a proteção, o clique fora fecha (o teste mede o que diz medir)", async () => {
    render(<Harness guarded={false} />);
    await clickOutside();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toda janela de formulário do módulo usa a proteção", () => {
    const root = path.resolve(__dirname, "../../../..");
    const files = [
      "app/service-orders/[id]/page.tsx",
      "components/features/field-service/catalog-picker-dialog.tsx",
      "app/service-orders/_components/complete-dialog.tsx",
      "app/service-orders/_components/launch-transaction-dialog.tsx",
      "components/features/field-service/equipment-form-dialog.tsx",
      "components/features/field-service/project-equipment-dialog.tsx",
      "components/features/field-service/service-order-form-dialog.tsx",
      "app/contracts/_components/activate-contract-dialog.tsx",
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const contents = source.match(/<DialogContent\b[^>]*>/g) ?? [];
      expect(contents.length, file).toBeGreaterThan(0);
      for (const tag of contents) {
        expect(tag, file).toContain("onInteractOutside={keepOpenOnOutsideClick}");
      }
    }
  });
});
