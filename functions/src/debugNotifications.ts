
import { db } from "./init";

async function main() {
  console.log("Checking for superadmins...");
  
  // Check lowercase
  const superAdminsSnap = await db
    .collection("users")
    .where("role", "==", "superadmin")
    .get();

  console.log(`Found ${superAdminsSnap.size} superadmins with role 'superadmin'`);
  superAdminsSnap.docs.forEach(doc => {
    console.log(`- ${doc.id}: ${JSON.stringify(doc.data().role)}`);
  });

  // Check uppercase just in case
  const superAdminsSnapUpper = await db
    .collection("users")
    .where("role", "==", "SUPERADMIN")
    .get();

  console.log(`Found ${superAdminsSnapUpper.size} superadmins with role 'SUPERADMIN'`);

  if (superAdminsSnap.empty && superAdminsSnapUpper.empty) {
    console.error("NO SUPERADMINS FOUND!");
    return;
  }

  // Create test notification
  console.log("Creating test system notification...");
  const notification = {
    tenantId: "system",
    type: "system",
    title: "Debug Notification",
    message: "Test system notification created manually via debug script.",
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  const ref = await db.collection("notifications").add(notification);
  console.log(`Notification created with ID: ${ref.id}`);
  console.log("Please check your dashboard notifications.");
}

main().catch(console.error);
