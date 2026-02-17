
const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function list() {
  const snapshot = await db.collection("connected_accounts").get();
  snapshot.forEach(doc => {
    console.log(`ID: ${doc.id}, ProviderItemId: ${doc.data().providerItemId}`);
  });
}

list();
