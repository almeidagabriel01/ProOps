const bookings: Array<Record<string, unknown>> = [];

const mockAdd = jest.fn(async (doc: Record<string, unknown>) => {
  bookings.push(doc);
  return { id: `b${bookings.length}` };
});

// where("date","==",X).get() e where("date",">=",..).where("date","<=",..).get()
function makeQuery(filterDate?: string) {
  return {
    where: (field: string, op: string, value: string) => {
      if (op === "==") return makeQuery(value);
      return makeQuery(filterDate);
    },
    limit: () => makeQuery(filterDate),
    get: jest.fn(async () => {
      const docs = bookings
        .filter((b) => (filterDate ? b.date === filterDate : true))
        .map((b) => ({ data: () => b }));
      return { docs, forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
    }),
  };
}

const mockRunTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
  const tx = {
    get: async (q: { get: () => Promise<unknown> }) => q.get(),
    set: (_ref: unknown, value: Record<string, unknown>) => {
      bookings.push(value);
    },
  };
  return fn(tx);
});

jest.mock("../../../init", () => ({
  db: {
    collection: jest.fn(() => ({
      where: (f: string, o: string, v: string) => makeQuery(o === "==" ? v : undefined),
      doc: () => ({ id: "newid" }),
      add: mockAdd,
    })),
    runTransaction: mockRunTransaction,
  },
}));

const mockSendEmail = jest.fn();
jest.mock("../../../services/email/send-email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { submitDemoBooking } from "../demo-booking.controller";

function mockRes() {
  const res: { statusCode?: number; body?: unknown; status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(function (this: typeof res, c: number) {
      this.statusCode = c;
      return this;
    }) as unknown as jest.Mock,
    json: jest.fn(function (this: typeof res, b: unknown) {
      this.body = b;
      return this;
    }) as unknown as jest.Mock,
  };
  return res;
}

const validBody = {
  name: "Ana Souza",
  email: "ana@example.com",
  phone: "",
  company: "ACME",
  message: "",
  date: "2026-06-19",
  startMinutes: 600,
  durationMinutes: 60,
  website: "",
};

describe("submitDemoBooking", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    // Freeze clock at 2026-06-17 12:00 BRT (= UTC-3) so "2026-06-19" is always future.
    jest.setSystemTime(new Date("2026-06-17T15:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    bookings.length = 0;
    mockSendEmail.mockClear();
    mockSendEmail.mockResolvedValue({ ok: true });
  });

  it("cria booking livre e envia dois emails (200)", async () => {
    const res = mockRes();
    await submitDemoBooking({ body: { ...validBody } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(bookings).toHaveLength(1);
  });

  it("dispara os dois emails em paralelo (ambos iniciam antes de qualquer um resolver)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockSendEmail.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true };
    });

    const res = mockRes();
    await submitDemoBooking({ body: { ...validBody } } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(maxInFlight).toBe(2);
  });

  it("falha no primeiro email não impede o segundo nem o 200", async () => {
    mockSendEmail
      .mockRejectedValueOnce(new Error("resend down"))
      .mockResolvedValueOnce({ ok: true });

    const res = mockRes();
    await submitDemoBooking({ body: { ...validBody } } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(bookings).toHaveLength(1);
  });

  it("rejeita slot ocupado com 409 e não envia email", async () => {
    bookings.push({ date: "2026-06-19", startMinutes: 600, endMinutes: 660 });
    const res = mockRes();
    await submitDemoBooking({ body: { ...validBody } } as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("honeypot preenchido → 200 sem criar nem enviar", async () => {
    const res = mockRes();
    await submitDemoBooking(
      { body: { ...validBody, website: "bot" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(bookings).toHaveLength(0);
  });

  it("slot fora da grade → 400", async () => {
    const res = mockRes();
    await submitDemoBooking(
      { body: { ...validBody, startMinutes: 545 } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
  });

  it("rejeita agendamento no passado com 400", async () => {
    const res = mockRes();
    await submitDemoBooking(
      { body: { ...validBody, date: "2026-06-16" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
  });
});
