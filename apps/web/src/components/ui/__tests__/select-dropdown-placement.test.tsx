// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Select } from "../select";
import { SearchableSelect } from "../searchable-select";

/**
 * As listas abriam sempre para baixo. Um campo no fim da página (a
 * "Antecedência" e o "Mostrar horários para os próximos" do link de
 * agendamento) abria a lista para fora da tela. Perto do rodapé ela abre para
 * cima; com espaço embaixo, continua abrindo para baixo.
 */

const VIEWPORT_HEIGHT = 800;

function rectAt(top: number, height = 48): DOMRect {
  return {
    left: 100,
    right: 400,
    width: 300,
    top,
    bottom: top + height,
    height,
    x: 100,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

afterEach(() => vi.restoreAllMocks());

describe("lado em que a lista do Select abre", () => {
  function openSelectAt(top: number) {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
    const { container } = render(
      <Select aria-label="Antecedência" value="0" onChange={() => {}} disableSort>
        {[0, 2, 4, 12, 24, 48].map((h) => (
          <option key={h} value={h}>
            {h} horas
          </option>
        ))}
      </Select>,
    );
    const trigger = container.querySelector("span.truncate")!.parentElement!;
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(rectAt(top));
    fireEvent.mouseDown(trigger);
    return document.body.querySelector('div[style*="position: fixed"]') as HTMLElement;
  }

  it("campo no alto da tela abre para baixo", () => {
    const list = openSelectAt(100);
    expect(list.style.top).toBe(`${100 + 48 + 4}px`);
    expect(list.style.bottom).toBe("");
  });

  it("campo perto do rodapé abre para cima, colado no campo", () => {
    const list = openSelectAt(740);
    expect(list.style.top).toBe("");
    expect(list.style.bottom).toBe(`${VIEWPORT_HEIGHT - 740 + 4}px`);
    // A altura sai do espaço de cima, não do aperto de baixo.
    expect((list.firstElementChild as HTMLElement).style.maxHeight).toBe("250px");
  });

  it("lista curta que cabe embaixo não vira, mesmo perto do rodapé", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
    const { container } = render(
      <Select aria-label="Curto" value="a" onChange={() => {}}>
        <option value="a">A</option>
      </Select>,
    );
    const trigger = container.querySelector("span.truncate")!.parentElement!;
    // 800 - 16 - 700 = 84px embaixo; uma opção pede 48.
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(rectAt(652));
    fireEvent.mouseDown(trigger);
    const list = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement;
    expect(list.style.bottom).toBe("");
  });
});

describe("lado em que a lista do SearchableSelect abre", () => {
  function openSearchableAt(top: number) {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rectAt(top));
    const { container } = render(
      <SearchableSelect
        aria-label="Cliente"
        value=""
        onValueChange={() => {}}
        options={[
          { value: "1", label: "Ana" },
          { value: "2", label: "Bruno" },
        ]}
      />,
    );
    // O campo de busca, não o <select> nativo escondido que guarda o valor.
    fireEvent.focus(container.querySelector("input")!);
    return container.querySelector("div.max-h-60") as HTMLElement;
  }

  it("campo no alto da tela abre para baixo", () => {
    const list = openSearchableAt(100);
    expect(list).toHaveClass("top-full");
    expect(list).not.toHaveClass("bottom-full");
  });

  it("campo perto do rodapé abre para cima", () => {
    const list = openSearchableAt(700);
    expect(list).toHaveClass("bottom-full");
    expect(list).not.toHaveClass("top-full");
  });
});
