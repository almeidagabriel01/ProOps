import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import { hasResolvableEmailDomain } from "../contact-validation";

jest.mock("node:dns/promises", () => ({
  resolveMx: jest.fn(),
  resolve4: jest.fn(),
  resolve6: jest.fn(),
}));

const mockMx = resolveMx as jest.Mock;
const mock4 = resolve4 as jest.Mock;
const mock6 = resolve6 as jest.Mock;

// Each test uses a unique domain so the in-memory domain cache never bleeds a
// result from one case into another.
let domainCounter = 0;
function uniqueEmail(): string {
  domainCounter += 1;
  return `user@example-${domainCounter}.test`;
}

describe("hasResolvableEmailDomain — DNS short-circuit", () => {
  beforeEach(() => {
    mockMx.mockReset();
    mock4.mockReset();
    mock6.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves true as soon as the MX lookup returns records", async () => {
    mockMx.mockResolvedValue([{ exchange: "mail.example.com", priority: 10 }]);
    mock4.mockRejectedValue(new Error("ENOTFOUND"));
    mock6.mockRejectedValue(new Error("ENOTFOUND"));

    await expect(hasResolvableEmailDomain(uniqueEmail())).resolves.toBe(true);
  });

  it("resolves true when only the A record resolves (MX/AAAA fail)", async () => {
    mockMx.mockRejectedValue(new Error("ENOTFOUND"));
    mock4.mockResolvedValue(["93.184.216.34"]);
    mock6.mockRejectedValue(new Error("ENOTFOUND"));

    await expect(hasResolvableEmailDomain(uniqueEmail())).resolves.toBe(true);
  });

  it("returns true without waiting for slower record types (short-circuit)", async () => {
    jest.useFakeTimers();
    // MX resolves immediately; A and AAAA never settle. If the implementation
    // still awaited all three (Promise.allSettled), this would hang on the
    // per-record timeout instead of returning on the MX success.
    mockMx.mockResolvedValue([{ exchange: "mail.example.com", priority: 10 }]);
    mock4.mockReturnValue(new Promise(() => {}));
    mock6.mockReturnValue(new Promise(() => {}));

    await expect(hasResolvableEmailDomain(uniqueEmail())).resolves.toBe(true);
  });

  it("resolves false when every record type fails", async () => {
    mockMx.mockRejectedValue(new Error("ENOTFOUND"));
    mock4.mockRejectedValue(new Error("ENOTFOUND"));
    mock6.mockRejectedValue(new Error("ENOTFOUND"));

    await expect(hasResolvableEmailDomain(uniqueEmail())).resolves.toBe(false);
  });

  it("resolves false when record lookups return empty arrays", async () => {
    mockMx.mockResolvedValue([]);
    mock4.mockResolvedValue([]);
    mock6.mockResolvedValue([]);

    await expect(hasResolvableEmailDomain(uniqueEmail())).resolves.toBe(false);
  });
});
