import { MockProvider } from "./mock.provider";
import type { ProviderEvent } from "./provider.interface";

async function collect(gen: AsyncGenerator<ProviderEvent>): Promise<ProviderEvent[]> {
  const events: ProviderEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

describe("MockProvider", () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  test("createSession returns a session", () => {
    const session = provider.createSession({
      systemPrompt: "test",
      history: [],
      tools: [],
      modelName: "mock",
    });
    expect(session).toBeDefined();
    expect(typeof session.streamTurn).toBe("function");
  });

  test("unknown message yields text response then done", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    const events = await collect(session.streamTurn("olá tudo bem?"));
    expect(events.some((e) => e.type === "text")).toBe(true);
    expect(events[events.length - 1].type).toBe("done");
  });

  test("'listar' keyword triggers list_contacts tool_call", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    const events = await collect(session.streamTurn("listar contatos"));
    const toolCallEvent = events.find((e) => e.type === "tool_calls");
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type === "tool_calls") {
      expect(toolCallEvent.calls[0].name).toBe("list_contacts");
    }
  });

  test("'list' keyword (English) triggers list_contacts", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    const events = await collect(session.streamTurn("list all contacts"));
    const toolCallEvent = events.find((e) => e.type === "tool_calls");
    expect(toolCallEvent?.type).toBe("tool_calls");
  });

  test("'cria' keyword triggers create_contact tool_call", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    const events = await collect(session.streamTurn("cria um contato"));
    const toolCallEvent = events.find((e) => e.type === "tool_calls");
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type === "tool_calls") {
      expect(toolCallEvent.calls[0].name).toBe("create_contact");
    }
  });

  test("'delete' keyword triggers request_confirmation tool_call", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    const events = await collect(session.streamTurn("delete contact"));
    const toolCallEvent = events.find((e) => e.type === "tool_calls");
    expect(toolCallEvent).toBeDefined();
    if (toolCallEvent?.type === "tool_calls") {
      expect(toolCallEvent.calls[0].name).toBe("request_confirmation");
    }
  });

  test("tool result turn after list yields text with contact count", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    // First turn: trigger list
    await collect(session.streamTurn("listar contatos"));
    // Second turn: provide tool result
    const events = await collect(
      session.streamTurn([{ name: "list_contacts", response: { contacts: [{}, {}] } }]),
    );
    const textEvent = events.find((e) => e.type === "text");
    expect(textEvent?.type).toBe("text");
    if (textEvent?.type === "text") {
      expect(textEvent.content).toContain("2");
    }
  });

  test("every turn ends with a done event", async () => {
    const session = provider.createSession({ systemPrompt: "", history: [], tools: [], modelName: "mock" });
    const events = await collect(session.streamTurn("qualquer coisa"));
    expect(events[events.length - 1].type).toBe("done");
  });
});
