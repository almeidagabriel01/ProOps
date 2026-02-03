import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

// DEVELOPMENT ONLY: Manual endpoint to activate add-ons
// In production, this should be removed or protected
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "This endpoint is disabled in production" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { tenantId, addonType, action = "activate" } = body;

    if (!tenantId || !addonType) {
      return NextResponse.json(
        { error: "tenantId and addonType are required" },
        { status: 400 },
      );
    }

    const addonId = `${tenantId}_${addonType}`;

    if (action === "activate") {
      await setDoc(doc(db, "addons", addonId), {
        tenantId,
        addonType,
        stripeSubscriptionId: "dev_manual_activation",
        status: "active",
        purchasedAt: new Date().toISOString(),
      });

      console.log(
        `[DEV] Manually activated add-on ${addonType} for tenant ${tenantId}`,
      );

      return NextResponse.json({
        success: true,
        message: `Add-on ${addonType} activated for tenant ${tenantId}`,
        addonId,
      });
    } else if (action === "deactivate") {
      await setDoc(
        doc(db, "addons", addonId),
        {
          tenantId,
          addonType,
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
        },
        { merge: true },
      );

      console.log(
        `[DEV] Manually deactivated add-on ${addonType} for tenant ${tenantId}`,
      );

      return NextResponse.json({
        success: true,
        message: `Add-on ${addonType} deactivated for tenant ${tenantId}`,
        addonId,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in manual addon activation:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

// GET: List all addons for a tenant
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "This endpoint is disabled in production" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId query param is required" },
        { status: 400 },
      );
    }

    const addonsRef = collection(db, "addons");
    const q = query(addonsRef, where("tenantId", "==", tenantId));
    const snapshot = await getDocs(q);

    const addons = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ tenantId, addons });
  } catch (error) {
    console.error("Error fetching addons:", error);
    return NextResponse.json(
      { error: "Failed to fetch addons" },
      { status: 500 },
    );
  }
}
