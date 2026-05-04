/**
 * Calculate the next billing date based on tenant creation date and billing interval
 */
export function calculateNextBillingDate(
  createdAt: string,
  billingInterval: string | null | undefined
): Date {
  const createdDate = new Date(createdAt);
  const billingDay = createdDate.getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nextBillingDate: Date;

  if (billingInterval === "yearly") {
    // Annual: Match creation month/day of current year
    nextBillingDate = new Date(
      today.getFullYear(),
      createdDate.getMonth(),
      billingDay
    );
    nextBillingDate.setHours(0, 0, 0, 0);

    // If that date refers to today or past, next billing is next year
    if (nextBillingDate <= today) {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }
  } else {
    // Monthly: Match creation day of current month
    nextBillingDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      billingDay
    );
    nextBillingDate.setHours(0, 0, 0, 0);

    // If that date refers to today or past, next billing is next month
    if (nextBillingDate <= today) {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }
  }

  return nextBillingDate;
}
