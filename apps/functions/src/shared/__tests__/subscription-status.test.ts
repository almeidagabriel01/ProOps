import * as fs from "fs";
import * as path from "path";
import {
  deriveSubscriptionDisplayStatus,
  type DeriveSubscriptionStatusInput,
  type SubscriptionDisplayStatus,
} from "../subscription-status";

interface VectorFile {
  nowMs: number;
  cases: Array<{
    name: string;
    input: Omit<DeriveSubscriptionStatusInput, "nowMs">;
    expected: SubscriptionDisplayStatus;
  }>;
}

const vectors: VectorFile = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../../shared-test-vectors/subscription-status.vectors.json"),
    "utf8",
  ),
);

describe("deriveSubscriptionDisplayStatus (shared vectors)", () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      expect(
        deriveSubscriptionDisplayStatus({ ...c.input, nowMs: vectors.nowMs }),
      ).toBe(c.expected);
    });
  }

  it("defaults nowMs to Date.now() when omitted (lapsed cancel-at-period-end)", () => {
    expect(
      deriveSubscriptionDisplayStatus({
        planId: "pro",
        storedStatus: "active",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: "2000-01-01T00:00:00.000Z",
      }),
    ).toBe("canceled");
  });
});
