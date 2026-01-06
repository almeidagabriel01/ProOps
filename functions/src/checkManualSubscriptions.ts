import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";

export const checkManualSubscriptions = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 300,
  },
  async () => {
    console.log("Starting manual subscription check...");
    const now = new Date();

    try {
      // 1. Check for Active -> Past Due
      // Find subscriptions that are manual, active, and expired
      const activeSnapshot = await db
        .collection("users")
        .where("isManualSubscription", "==", true)
        .where("subscriptionStatus", "==", "active")
        .where("currentPeriodEnd", "<", now.toISOString())
        .get();

      if (!activeSnapshot.empty) {
        const batch = db.batch();
        let count = 0;

        activeSnapshot.docs.forEach((doc) => {
          // Double check to be safe (client-side filter if index issues)
          // But query should handle it.
          batch.update(doc.ref, {
            subscriptionStatus: "past_due",
            updatedAt: new Date().toISOString(),
          });
          count++;
        });

        await batch.commit();
        console.log(`Updated ${count} active subscriptions to past_due.`);
      } else {
        console.log("No active subscriptions found expring today.");
      }

      // 2. Check for Past Due -> Canceled (Grace Period: 7 days)
      const GRACE_PERIOD_DAYS = 7;
      const graceLimitDate = new Date();
      graceLimitDate.setDate(now.getDate() - GRACE_PERIOD_DAYS);

      const pastDueSnapshot = await db
        .collection("users")
        .where("isManualSubscription", "==", true)
        .where("subscriptionStatus", "==", "past_due")
        .where("currentPeriodEnd", "<", graceLimitDate.toISOString())
        .get();

      if (!pastDueSnapshot.empty) {
        const batch = db.batch();
        let count = 0;

        pastDueSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            subscriptionStatus: "canceled",
            planId: "free", // Downgrade to free
            updatedAt: new Date().toISOString(),
          });
          count++;
        });

        await batch.commit();
        console.log(
          `Canceled ${count} past_due subscriptions (expired > 7 days).`
        );
      } else {
        console.log(
          "No past_due subscriptions found suitable for cancellation."
        );
      }
    } catch (error) {
      console.error("Error checking manual subscriptions:", error);
    }
  }
);
