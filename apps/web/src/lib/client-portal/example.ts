import type { PortalView } from "@/services/client-portal-service";

/**
 * O portal de exemplo da conta de demonstração, aberto em
 * `/share/portal/exemplo`. É dado fixo no front, sem API: a conta free não
 * gera link, e o tenant de demonstração não tem lançamentos ligados a contato.
 */
export const EXAMPLE_PORTAL_TOKEN = "exemplo";

/** Visita do exemplo: daqui a 3 dias, das 09:00 às 12:00, para nunca ficar no passado. */
function exampleVisit() {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return {
    stageName: "Configuração",
    isAllDay: false,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    startDate: null,
    endDate: null,
  };
}

export const EXAMPLE_PORTAL: PortalView = {
  company: { name: "Sua empresa", logoUrl: null, primaryColor: null },
  client: { firstName: "Ana" },
  proposals: [
    {
      id: "ex-p1",
      title: "Automação da sala e do home theater",
      code: "0000124SP",
      state: "approved",
      value: 18400,
      createdAt: "2026-08-12T12:00:00.000Z",
      validUntil: null,
    },
    {
      id: "ex-p2",
      title: "Persianas motorizadas dos quartos",
      code: "0000131SP",
      state: "open",
      value: 6200,
      createdAt: "2026-09-18T12:00:00.000Z",
      validUntil: "2026-10-18",
    },
  ],
  payments: [
    { id: "ex-t2", description: "Parcela 2 de 3", amount: 6133.33, dueDate: "2026-10-10", status: "pending", isDownPayment: false },
    { id: "ex-t3", description: "Parcela 3 de 3", amount: 6133.33, dueDate: "2026-11-10", status: "pending", isDownPayment: false },
    { id: "ex-t1", description: "Entrada", amount: 6133.34, dueDate: "2026-08-15", status: "paid", isDownPayment: true },
  ],
  canPayOnline: true,
  projects: [
    {
      id: "ex-o1",
      title: "Automação da sala e do home theater",
      status: "active",
      stagesDone: 2,
      stagesTotal: 4,
      deliveryAccepted: false,
      nextVisit: exampleVisit(),
    },
  ],
  invoices: [
    { id: "ex-n1", type: "nfse", number: "58", amount: 6133.34, issuedAt: "2026-08-15T12:00:00.000Z", pdfUrl: "" },
  ],
  contracts: [
    {
      id: "ex-c1",
      code: "CT-0003",
      title: "Suporte mensal da automação",
      type: "support",
      monthlyAmount: 180,
      billingDay: 10,
      nextVisitDate: exampleVisit().startsAt.slice(0, 10),
      isPmoc: false,
    },
  ],
  serviceOrders: [
    {
      id: "ex-os1",
      code: "OS-0012",
      title: "Ajuste dos cenários da sala",
      state: "completed",
      date: "2026-09-20T15:00:00.000Z",
      technicianName: "Diego",
      signed: true,
    },
  ],
};
