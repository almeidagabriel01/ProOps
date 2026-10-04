// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({ onIdTokenChanged: vi.fn(() => () => {}) }));

import {
  MAX_EVENTS_PER_TAB,
  __flushActivityForTest,
  __resetActivityTrackerForTest,
  setActivityViewer,
  trackActivity,
  trackPageView,
} from "../activity-tracker";
import { __setCachedIdTokenForTest } from "@/lib/observability/identity-token-cache";

interface Posted {
  idToken: string;
  sessionId: string;
  events: Array<{ type: string; route: string | null; meta?: Record<string, unknown>; at: number }>;
}

let fetchBodies: Posted[] = [];
let beaconBodies: Posted[] = [];

async function readBlob(blob: Blob): Promise<string> {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  fetchBodies = [];
  beaconBodies = [];
  sessionStorage.clear();
  __resetActivityTrackerForTest();
  __setCachedIdTokenForTest("tok-1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body?: string }) => {
      if (init?.body) fetchBodies.push(JSON.parse(init.body));
      return { ok: true } as Response;
    }),
  );
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: vi.fn((_url: string, blob: Blob) => {
      void readBlob(blob).then((text) => beaconBodies.push(JSON.parse(text)));
      return true;
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __setCachedIdTokenForTest(null);
});

function allEvents() {
  return fetchBodies.flatMap((b) => b.events);
}

describe("activity tracker", () => {
  it("junta os eventos e manda um lote depois de 5 segundos, com o token e sem tenantId", () => {
    trackPageView("/dashboard");
    vi.advanceTimersByTime(1000);
    trackPageView("/proposals");
    vi.advanceTimersByTime(3000);
    expect(fetchBodies).toHaveLength(0);
    vi.advanceTimersByTime(1500);
    expect(fetchBodies).toHaveLength(1);
    const body = fetchBodies[0];
    expect(body.idToken).toBe("tok-1");
    expect(body.sessionId).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("tenantId");
    expect(body.events.map((e) => e.route)).toEqual(["/dashboard", "/proposals"]);
  });

  it("a mesma tela seguida conta uma vez", () => {
    trackPageView("/proposals");
    vi.advanceTimersByTime(2000);
    trackPageView("/proposals");
    vi.advanceTimersByTime(6000);
    expect(allEvents()).toHaveLength(1);
  });

  it("redirecionamento logo em seguida substitui a tela anterior", () => {
    trackPageView("/");
    vi.advanceTimersByTime(100);
    trackPageView("/dashboard");
    vi.advanceTimersByTime(6000);
    expect(allEvents().map((e) => e.route)).toEqual(["/dashboard"]);
  });

  it("normaliza a rota: id vira [id] e a query sai", () => {
    trackPageView("/proposals/aB3dE9fG7hJ2kL1mN0pQ/edit?tab=items");
    vi.advanceTimersByTime(6000);
    expect(allEvents()[0].route).toBe("/proposals/[id]/edit");
  });

  it("o mesmo erro conta uma vez por minuto", () => {
    const meta = { method: "POST", path: "/v1/proposals", status: 402 };
    trackActivity("api_error", { meta });
    trackActivity("api_error", { meta });
    vi.advanceTimersByTime(6000);
    expect(allEvents()).toHaveLength(1);
    vi.advanceTimersByTime(60_000);
    trackActivity("api_error", { meta });
    vi.advanceTimersByTime(6000);
    expect(allEvents()).toHaveLength(2);
  });

  it("flush: true manda na hora por beacon (a página vai sair para o checkout)", async () => {
    trackActivity("subscribe_clicked", { meta: { source: "landing_pricing", plan: "pro" }, flush: true });
    await vi.runAllTimersAsync();
    expect(beaconBodies).toHaveLength(1);
    expect(beaconBodies[0].events[0]).toMatchObject({ type: "subscribe_clicked", meta: { source: "landing_pricing", plan: "pro" } });
  });

  it("ao esconder a aba, despeja o que sobrou por beacon", async () => {
    trackPageView("/dashboard");
    window.dispatchEvent(new Event("pagehide"));
    await vi.runAllTimersAsync();
    expect(beaconBodies).toHaveLength(1);
  });

  it("meta indefinida não vai no corpo", () => {
    trackActivity("api_error", { meta: { method: "GET", path: "/v1/x", status: 0, code: undefined } });
    vi.advanceTimersByTime(6000);
    expect(allEvents()[0].meta).toEqual({ method: "GET", path: "/v1/x", status: 0 });
  });

  it("super admin não é registrado", () => {
    setActivityViewer({ role: "SUPERADMIN" });
    trackPageView("/dashboard");
    trackActivity("api_error", { meta: { status: 500 } });
    vi.advanceTimersByTime(6000);
    expect(fetchBodies).toHaveLength(0);
  });

  it("no Acessar Painel nada é registrado", () => {
    sessionStorage.setItem("viewingAsTenant", "tenant_x");
    trackPageView("/dashboard");
    vi.advanceTimersByTime(6000);
    expect(fetchBodies).toHaveLength(0);
  });

  it("sem login (sem token) nada sai", () => {
    __setCachedIdTokenForTest(null);
    trackPageView("/dashboard");
    vi.advanceTimersByTime(6000);
    expect(fetchBodies).toHaveLength(0);
  });

  it(`para de registrar depois de ${MAX_EVENTS_PER_TAB} eventos na aba`, () => {
    for (let i = 0; i < MAX_EVENTS_PER_TAB + 20; i += 1) {
      trackActivity("onboarding_step_completed", { meta: { stepId: `s${i}` } });
    }
    __flushActivityForTest();
    expect(allEvents()).toHaveLength(MAX_EVENTS_PER_TAB);
  });

  it("lote cheio (25) sai sem esperar o debounce", () => {
    for (let i = 0; i < 25; i += 1) trackActivity("onboarding_step_completed", { meta: { stepId: `s${i}` } });
    expect(fetchBodies).toHaveLength(1);
    expect(fetchBodies[0].events).toHaveLength(25);
  });

  it("nunca lança, nem com fetch quebrado", () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("offline");
    });
    expect(() => {
      trackPageView("/dashboard");
      __flushActivityForTest();
    }).not.toThrow();
  });
});
