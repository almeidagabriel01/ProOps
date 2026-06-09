import {
  EMULATOR_RATE_LIMIT_MAX,
  isEmulatedRuntime,
  resolveEffectiveRateLimitMax,
} from "../emulator";

describe("rate-limit emulator detection", () => {
  describe("isEmulatedRuntime", () => {
    it("detects the Firestore emulator via FIRESTORE_EMULATOR_HOST", () => {
      expect(isEmulatedRuntime({ FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" })).toBe(
        true,
      );
    });

    it("detects the functions emulator via FUNCTIONS_EMULATOR=true (real Firestore)", () => {
      // `npm run dev:backend` against the cloud project: only this var is set.
      expect(isEmulatedRuntime({ FUNCTIONS_EMULATOR: "true" })).toBe(true);
    });

    it("treats a non-emulator runtime (Cloud Run) as not emulated", () => {
      expect(isEmulatedRuntime({})).toBe(false);
    });

    it("does not treat FUNCTIONS_EMULATOR=false as emulated", () => {
      expect(isEmulatedRuntime({ FUNCTIONS_EMULATOR: "false" })).toBe(false);
    });
  });

  describe("resolveEffectiveRateLimitMax", () => {
    it("raises the ceiling when running in the functions emulator", () => {
      expect(
        resolveEffectiveRateLimitMax(240, { FUNCTIONS_EMULATOR: "true" }),
      ).toBe(EMULATOR_RATE_LIMIT_MAX);
    });

    it("raises the ceiling when running in the Firestore emulator", () => {
      expect(
        resolveEffectiveRateLimitMax(240, {
          FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
        }),
      ).toBe(EMULATOR_RATE_LIMIT_MAX);
    });

    it("keeps the configured limit in a deployed (non-emulator) runtime", () => {
      expect(resolveEffectiveRateLimitMax(240, {})).toBe(240);
    });
  });
});
