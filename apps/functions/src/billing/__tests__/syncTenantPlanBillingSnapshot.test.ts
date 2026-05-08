/**
 * Wave 0 scaffold for Phase 19 BILL-06.
 * Plan 02 will replace test.todo placeholders with real assertions
 * against the extended syncTenantPlanBillingSnapshot.
 */
describe("syncTenantPlanBillingSnapshot (BILL-06 single writer)", () => {
  it("scaffold present", () => {
    expect(true).toBe(true);
  });
  test.todo("writes top-level fields and subscription.* atomically in one db.runTransaction()");
  test.todo("preserves existing subscription.* fields (merge semantics) when partial params provided");
  test.todo("clears scheduledPlan/At/Reason only when clearScheduled=true AND a tier resolves");
  test.todo("populates subscription.lastEventId when eventId is provided");
  test.todo("writes whatsappEnabled in a SECOND update outside the transaction (Pitfall 2)");
});
