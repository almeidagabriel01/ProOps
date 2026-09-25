import { connectStorageEmulator, getStorage } from "firebase/storage";
import { app, useFirebaseEmulators } from "@/lib/firebase";

declare global {
  interface Window {
    __proopsStorageEmulatorConnected?: boolean;
  }
}

/**
 * Firebase Storage, separado de lib/firebase.ts para o SDK só entrar no
 * bundle das telas que sobem ou apagam arquivo (via storage-service).
 */
const storage = getStorage(app);

if (useFirebaseEmulators && typeof window !== "undefined") {
  if (!window.__proopsStorageEmulatorConnected) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    window.__proopsStorageEmulatorConnected = true;
  }
}

export { storage };
