import "dotenv/config";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

async function main() {
  console.log("Querying recent transactions...");
  const snap = await db.collection("transactions")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();

  console.log(`Found ${snap.size} transactions:`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log({
      id: doc.id,
      description: data.description,
      amount: data.amount,
      installmentNumber: data.installmentNumber,
      installmentCount: data.installmentCount,
      installmentGroupId: data.installmentGroupId,
      recurringGroupId: data.recurringGroupId,
      isRecurring: data.isRecurring,
      isInstallment: data.isInstallment,
      dueDate: data.dueDate,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
