import { mapSeverity } from "../severity";

describe("mapSeverity", () => {
  it("5xx or unhandled is critical", () => {
    expect(mapSeverity({ status: 500, source: "functions", handled: false })).toBe("critical");
    expect(mapSeverity({ status: null, source: "functions", handled: false })).toBe("critical");
    expect(mapSeverity({ status: 503, source: "web", handled: true })).toBe("critical");
  });

  it("handled 4xx domain errors are warning", () => {
    expect(mapSeverity({ status: 400, source: "functions", handled: true })).toBe("warning");
    expect(mapSeverity({ status: 404, source: "functions", handled: true })).toBe("warning");
  });

  it("everything else is error", () => {
    expect(mapSeverity({ status: 200, source: "web", handled: true })).toBe("error");
    expect(mapSeverity({ status: null, source: "web", handled: true })).toBe("error");
  });
});
