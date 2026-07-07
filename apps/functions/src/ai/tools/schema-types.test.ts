/**
 * Guards for the local SchemaType replica:
 * 1. the tool definitions module must never require the SDK at runtime
 *    (cold-start regression guard, same pattern as calendar lazy-load test);
 * 2. runtime values must stay identical to the SDK enum (the SDK lives in
 *    devDependencies, so this only runs where devDeps are installed — CI/dev).
 *
 * ORDER MATTERS: the no-load assertion runs first — the value-parity test
 * requires the SDK, which would pollute require.cache for the check.
 */

import { SchemaType as LocalSchemaType } from "./schema-types";

describe("local SchemaType replica", () => {
  it("definitions module does not load @google/generative-ai at runtime", () => {
    jest.isolateModules(() => {
      require("./definitions");
    });
    const loaded = Object.keys(require.cache).some((p) =>
      p.replace(/\\/g, "/").includes("@google/generative-ai"),
    );
    expect(loaded).toBe(false);
  });

  it("matches the SDK enum values", () => {
    const { SchemaType: SdkSchemaType } = require("@google/generative-ai");
    expect({ ...LocalSchemaType }).toEqual({ ...SdkSchemaType });
  });
});
