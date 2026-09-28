// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  view: vi.fn(),
  submit: vi.fn(),
  captchaConfigured: false,
  captchaToken: "",
}));

vi.mock("@/services/booking-service", () => ({
  BookingService: {
    publicView: (...a: unknown[]) => m.view(...a),
    submit: (...a: unknown[]) => m.submit(...a),
  },
}));
vi.mock("@/lib/captcha", () => ({
  mountCaptcha: vi.fn(),
  isCaptchaConfigured: () => m.captchaConfigured,
  getCaptchaToken: () => Promise.resolve(m.captchaToken),
}));

import { PublicBooking } from "../public-booking";

function makeView() {
  return {
    company: { name: "Casa Viva", logoUrl: null, primaryColor: "#0ea5e9" },
    visitTypes: [
      { id: "visita_tecnica", label: "Visita técnica", durationMin: 60 },
      { id: "orcamento", label: "Orçamento rápido", durationMin: 30 },
    ],
    slots: {
      visita_tecnica: [
        { date: "2026-09-28", starts: [540, 600] },
        { date: "2026-09-29", starts: [] },
        { date: "2026-09-30", starts: [660, 840] },
        { date: "2026-10-02", starts: [540] },
      ],
      orcamento: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.captchaConfigured = false;
  m.captchaToken = "";
  m.view.mockResolvedValue(makeView());
  m.submit.mockResolvedValue(undefined);
});

async function pickTenOClock() {
  await userEvent.click(await screen.findByRole("button", { name: "10:00" }));
  await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
  await userEvent.type(screen.getByLabelText("Nome"), "Carla");
  await userEvent.type(screen.getByLabelText("Telefone (WhatsApp)"), "11988887777");
}

describe("link público de agendamento", () => {
  it("mostra só os dias com horário livre e envia o pedido", async () => {
    render(<PublicBooking token="tok12345" />);
    expect(await screen.findByText("Casa Viva")).toBeInTheDocument();
    expect(m.view).toHaveBeenCalledWith("tok12345");
    // Dia sem horário fica apagado no calendário, sem botão.
    expect(screen.getByText("setembro de 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "terça-feira, 29 de setembro" })).toBeNull();
    expect(screen.getByRole("button", { name: "quarta-feira, 30 de setembro" })).toBeInTheDocument();

    await pickTenOClock();
    await userEvent.click(screen.getByRole("button", { name: "Pedir a visita" }));

    await waitFor(() =>
      expect(m.submit).toHaveBeenCalledWith("tok12345", {
        visitTypeId: "visita_tecnica",
        date: "2026-09-28",
        startMin: 600,
        name: "Carla",
        phone: "(11) 98888-7777",
        email: undefined,
        address: undefined,
        notes: undefined,
        website: undefined,
        captchaToken: undefined,
      }),
    );
    expect(await screen.findByText("Pedido enviado")).toBeInTheDocument();
    expect(screen.getByText(/vai confirmar o horário com você por telefone/)).toBeInTheDocument();
  });

  it("o telefone ganha a máscara enquanto a pessoa digita", async () => {
    render(<PublicBooking token="tok12345" />);
    await userEvent.click(await screen.findByRole("button", { name: "10:00" }));
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    const phone = screen.getByLabelText("Telefone (WhatsApp)");
    await userEvent.type(phone, "1133334444");
    expect(phone).toHaveValue("(11) 3333-4444");
    await userEvent.clear(phone);
    await userEvent.type(phone, "11988887777999");
    expect(phone).toHaveValue("(11) 98888-7777");
  });

  it("trocar de dia mostra os horários daquele dia, separados por período", async () => {
    render(<PublicBooking token="tok12345" />);
    await userEvent.click(await screen.findByRole("button", { name: "quarta-feira, 30 de setembro" }));
    expect(screen.getByRole("group", { name: "Manhã" })).toHaveTextContent("11:00");
    expect(screen.getByRole("group", { name: "Tarde" })).toHaveTextContent("14:00");
    expect(screen.queryByRole("button", { name: "10:00" })).toBeNull();
  });

  it("anda de mês só dentro do horizonte com horário livre", async () => {
    render(<PublicBooking token="tok12345" />);
    await screen.findByText("setembro de 2026");
    expect(screen.getByRole("button", { name: "Mês anterior" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "sexta-feira, 2 de outubro" }));
    expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument();
  });

  it("só segue para os dados depois de escolher o horário, e volta sem perder a escolha", async () => {
    render(<PublicBooking token="tok12345" />);
    await screen.findByText("setembro de 2026");
    expect(screen.queryByRole("button", { name: /Continuar/ })).toBeNull();
    await pickTenOClock();
    expect(screen.getByLabelText("Nome")).toHaveValue("Carla");
    await userEvent.click(screen.getByRole("button", { name: "Trocar horário" }));
    expect(screen.getByRole("button", { name: "10:00" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    // O que já foi digitado continua lá.
    expect(screen.getByLabelText("Nome")).toHaveValue("Carla");
  });

  it("tipo de visita sem horário livre diz para falar com a empresa", async () => {
    render(<PublicBooking token="tok12345" />);
    await userEvent.click(await screen.findByRole("button", { name: /Orçamento rápido/ }));
    expect(screen.getByText(/Não há horário livre nos próximos dias/)).toBeInTheDocument();
  });

  it("não envia sem nome e telefone com DDD", async () => {
    render(<PublicBooking token="tok12345" />);
    await userEvent.click(await screen.findByRole("button", { name: "10:00" }));
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    await userEvent.type(screen.getByLabelText("Nome"), "Carla");
    await userEvent.type(screen.getByLabelText("Telefone (WhatsApp)"), "98887777");
    await userEvent.click(screen.getByRole("button", { name: "Pedir a visita" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o seu nome e um telefone com DDD.");
    expect(m.submit).not.toHaveBeenCalled();
  });

  it("horário ocupado no meio do caminho recarrega os horários", async () => {
    m.submit.mockRejectedValue(Object.assign(new Error("ocupado"), { status: 409 }));
    render(<PublicBooking token="tok12345" />);
    await pickTenOClock();
    await userEvent.click(screen.getByRole("button", { name: "Pedir a visita" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esse horário acabou de ser ocupado");
    await waitFor(() => expect(m.view).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Pedido enviado")).toBeNull();
    // Volta para o calendário, sem horário escolhido.
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.getByRole("button", { name: "10:00" })).toHaveAttribute("aria-pressed", "false");
  });

  it("com captcha ligado e sem token, não envia", async () => {
    m.captchaConfigured = true;
    render(<PublicBooking token="tok12345" />);
    await pickTenOClock();
    await userEvent.click(screen.getByRole("button", { name: "Pedir a visita" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("não é um robô");
    expect(m.submit).not.toHaveBeenCalled();
  });

  it("manda o token do captcha quando há", async () => {
    m.captchaConfigured = true;
    m.captchaToken = "turnstile-ok";
    render(<PublicBooking token="tok12345" />);
    await pickTenOClock();
    await userEvent.click(screen.getByRole("button", { name: "Pedir a visita" }));
    await waitFor(() =>
      expect(m.submit).toHaveBeenCalledWith("tok12345", expect.objectContaining({ captchaToken: "turnstile-ok" })),
    );
  });

  it("a isca de robô fica fora da árvore acessível", async () => {
    render(<PublicBooking token="tok12345" />);
    await userEvent.click(await screen.findByRole("button", { name: "10:00" }));
    await userEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(screen.queryByRole("textbox", { name: "Site" })).toBeNull();
  });

  it("link desligado ou inválido", async () => {
    m.view.mockRejectedValue(Object.assign(new Error("404"), { status: 404 }));
    render(<PublicBooking token="tok12345" />);
    expect(await screen.findByText("Link indisponível")).toBeInTheDocument();
  });
});
