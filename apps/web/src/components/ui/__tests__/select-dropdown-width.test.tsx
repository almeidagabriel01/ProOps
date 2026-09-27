// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Select } from "../select";

/**
 * A lista do Select abria com a largura exata do campo. Num campo estreito
 * (a duração do tipo de visita, em Configurações > Link de agendamento) as
 * opções saíam cortadas: "1..." no lugar de "1h30".
 */
function openAt(rect: { left: number; width: number }, viewportWidth = 1280) {
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(viewportWidth);
  const { container } = render(
    <Select aria-label="Duração" value="60" onChange={() => {}} disableSort>
      <option value="60">1h</option>
      <option value="90">1h30</option>
    </Select>,
  );
  const trigger = container.querySelector("span.truncate")!.parentElement!;
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    left: rect.left,
    right: rect.left + rect.width,
    width: rect.width,
    top: 100,
    bottom: 148,
    height: 48,
    x: rect.left,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect);
  fireEvent.mouseDown(trigger);
  return document.body.querySelector('div[style*="position: fixed"]') as HTMLElement;
}

afterEach(() => vi.restoreAllMocks());

describe("largura da lista do Select", () => {
  it("tem no mínimo a largura do campo e cresce até caber a opção", () => {
    const list = openAt({ left: 100, width: 70 });
    expect(list.style.minWidth).toBe("70px");
    expect(list.style.width).toBe("max-content");
    expect(list.style.left).toBe("100px");
    expect(list.style.maxWidth).toBe(`${1280 - 100 - 8}px`);
  });

  it("campo perto da borda direita abre alinhado pela direita", () => {
    const list = openAt({ left: 300, width: 70 }, 390);
    expect(list.style.left).toBe("");
    expect(list.style.right).toBe(`${390 - 370}px`);
    expect(list.style.maxWidth).toBe(`${370 - 8}px`);
  });
});
