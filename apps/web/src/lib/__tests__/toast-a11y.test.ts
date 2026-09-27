// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceToastAccessibility, observeToastAccessibility } from "../toast-a11y";

/**
 * O sileo desenha o toast como um <button> com a ação ("Desfazer") num <a>
 * lá dentro, e o conteúdo de um botão some da árvore de acessibilidade: o
 * leitor de tela não achava o Desfazer. A marcação abaixo é a do sileo 0.1.5.
 */
function sileoToast(withAction = true): HTMLElement {
  const toast = document.createElement("button");
  toast.type = "button";
  toast.setAttribute("data-sileo-toast", "true");
  toast.innerHTML = `
    <div data-sileo-canvas="true"><svg><title>Sileo Notification</title></svg></div>
    <div data-sileo-header="true"><span data-sileo-title="true">Proposta excluída</span></div>
    <div data-sileo-content="true"><div data-sileo-description="true">Proposta "Casa" excluída.${
      withAction ? '<a href="#" type="button" data-sileo-button="true">Desfazer</a>' : ""
    }</div></div>`;
  return toast;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("acessibilidade do toast", () => {
  it("o toast deixa de ser botão e sai da tabulação", () => {
    const toast = sileoToast();
    document.body.append(toast);
    enhanceToastAccessibility(document.body);
    expect(toast.getAttribute("role")).toBe("group");
    expect(toast.getAttribute("tabindex")).toBe("-1");
  });

  it("o desenho com o título 'Sileo Notification' sai da leitura", () => {
    document.body.append(sileoToast());
    enhanceToastAccessibility(document.body);
    expect(document.querySelector("[data-sileo-canvas]")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("a ação vira botão e responde ao Espaço", () => {
    document.body.append(sileoToast());
    enhanceToastAccessibility(document.body);
    const action = document.querySelector<HTMLElement>("[data-sileo-button]")!;
    expect(action.getAttribute("role")).toBe("button");
    const onClick = vi.fn((e: Event) => e.preventDefault());
    action.addEventListener("click", onClick);
    action.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("aplicar duas vezes não duplica o Espaço", () => {
    document.body.append(sileoToast());
    enhanceToastAccessibility(document.body);
    enhanceToastAccessibility(document.body);
    const action = document.querySelector<HTMLElement>("[data-sileo-button]")!;
    const onClick = vi.fn((e: Event) => e.preventDefault());
    action.addEventListener("click", onClick);
    action.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("toast sem ação também vira grupo", () => {
    const toast = sileoToast(false);
    document.body.append(toast);
    enhanceToastAccessibility(document.body);
    expect(toast.getAttribute("role")).toBe("group");
    expect(document.querySelector("[data-sileo-button]")).toBeNull();
  });

  it("corrige o toast que entra depois, e para ao desligar", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const stop = observeToastAccessibility(root);

    const first = sileoToast();
    root.append(first);
    await Promise.resolve();
    expect(first.getAttribute("role")).toBe("group");

    stop();
    const second = sileoToast();
    root.append(second);
    await Promise.resolve();
    expect(second.getAttribute("role")).toBeNull();
  });
});
