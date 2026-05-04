import * as admin from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";

const PROJECT_ID = "demo-proops-test";

export function getTestDb(): Firestore {
  const app =
    admin.apps.length > 0
      ? admin.apps[0]!
      : admin.initializeApp({ projectId: PROJECT_ID });
  return app.firestore();
}
