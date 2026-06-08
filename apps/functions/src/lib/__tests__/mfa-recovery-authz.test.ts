import { evaluateRecoveryEligibility } from "../mfa-recovery-authz";

describe("evaluateRecoveryEligibility", () => {
  it("sends when the user exists and the email is verified", () => {
    expect(
      evaluateRecoveryEligibility({ userExists: true, emailVerified: true }),
    ).toEqual({ send: true });
  });

  it("does not send when the user does not exist", () => {
    expect(
      evaluateRecoveryEligibility({ userExists: false, emailVerified: true }),
    ).toEqual({ send: false });
  });

  it("does not send when the email is not verified", () => {
    expect(
      evaluateRecoveryEligibility({ userExists: true, emailVerified: false }),
    ).toEqual({ send: false });
  });

  it("does not send when neither condition holds", () => {
    expect(
      evaluateRecoveryEligibility({ userExists: false, emailVerified: false }),
    ).toEqual({ send: false });
  });
});
