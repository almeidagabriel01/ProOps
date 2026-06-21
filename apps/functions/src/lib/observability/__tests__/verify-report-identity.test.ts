process.env.NODE_ENV = "test";

const verifyIdToken = jest.fn();
jest.mock("../../../init", () => ({ auth: { verifyIdToken: (...a: unknown[]) => verifyIdToken(...a) } }));

import { verifyReportIdentity } from "../verify-report-identity";

beforeEach(() => verifyIdToken.mockReset());

it("returns uid + tenantId from verified claims", async () => {
  verifyIdToken.mockResolvedValue({ uid: "u1", tenantId: "t1" });
  await expect(verifyReportIdentity("good-token")).resolves.toEqual({ uid: "u1", tenantId: "t1" });
  expect(verifyIdToken).toHaveBeenCalledWith("good-token");
});

it("tenantId is null when the claim is absent", async () => {
  verifyIdToken.mockResolvedValue({ uid: "u2" });
  await expect(verifyReportIdentity("good-token")).resolves.toEqual({ uid: "u2", tenantId: null });
});

it("returns null for non-string input without calling verify", async () => {
  await expect(verifyReportIdentity(undefined)).resolves.toBeNull();
  await expect(verifyReportIdentity(123)).resolves.toBeNull();
  await expect(verifyReportIdentity("")).resolves.toBeNull();
  expect(verifyIdToken).not.toHaveBeenCalled();
});

it("returns null (never throws) when verification fails", async () => {
  verifyIdToken.mockRejectedValue(new Error("token expired"));
  await expect(verifyReportIdentity("bad-token")).resolves.toBeNull();
});
