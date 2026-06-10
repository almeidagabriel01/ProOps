"use client";

import * as React from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface WhatsappMfaStatus {
  /** Whether WhatsApp-MFA is enabled on the user's `users/{uid}` doc. */
  enabled: boolean;
  /** The masked/enrolled phone, when present on the doc. */
  phone?: string;
  loading: boolean;
  /** Re-reads the user doc (call after enroll/disable). */
  refresh: () => Promise<void>;
}

/**
 * Reads WhatsApp-MFA state (`whatsappMfaEnabled` / `whatsappMfaPhone`) from the
 * owner's `users/{uid}` document. The owner is allowed to read their own doc by
 * the Firestore rules, mirroring how `OverviewTab` and the auth-provider already
 * read it on the client. Writes still go exclusively through the backend service.
 */
export function useWhatsappMfaStatus(): WhatsappMfaStatus {
  const [enabled, setEnabled] = React.useState(false);
  const [phone, setPhone] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);

  const read = React.useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setEnabled(false);
      setPhone(undefined);
      setLoading(false);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      const data = snap.exists() ? snap.data() : {};
      setEnabled(Boolean(data?.whatsappMfaEnabled));
      const rawPhone = data?.whatsappMfaPhone;
      setPhone(typeof rawPhone === "string" ? rawPhone : undefined);
    } catch {
      setEnabled(false);
      setPhone(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      void read();
    });
    return () => unsubscribe();
  }, [read]);

  return { enabled, phone, loading, refresh: read };
}
