
import { db } from "../init";

async function listConnectedAccounts() {
  const snapshot = await db.collection("connected_accounts").get();
  snapshot.forEach((doc: any) => {
    console.log(doc.id, doc.data().providerItemId);
  });
}

listConnectedAccounts().catch(console.error);
