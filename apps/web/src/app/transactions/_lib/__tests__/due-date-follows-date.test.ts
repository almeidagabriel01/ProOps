import { describe, it, expect } from "vitest";
import { dueDateAfterDateChange } from "../due-date-follows-date";

describe("dueDateAfterDateChange", () => {
  it("vencimento vazio passa a seguir a data", () => {
    expect(
      dueDateAfterDateChange({ date: "2026-09-25", dueDate: "" }, "2026-10-01"),
    ).toBe("2026-10-01");
  });

  it("vencimento igual à data continua acompanhando", () => {
    expect(
      dueDateAfterDateChange(
        { date: "2026-09-25", dueDate: "2026-09-25" },
        "2026-10-01",
      ),
    ).toBe("2026-10-01");
  });

  it("vencimento escolhido à parte não é sobrescrito", () => {
    expect(
      dueDateAfterDateChange(
        { date: "2026-09-25", dueDate: "2026-11-10" },
        "2026-10-01",
      ),
    ).toBe("2026-11-10");
  });
});
