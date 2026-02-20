import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 1. Authentication & Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const adminAuth = getAdminAuth();
    const db = getAdminFirestore();

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error("Token verification failed:", error);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Check Role (Fetch user to be sure, or trust custom claims if implemented)
    // Safest approach: Fetch user doc
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return new NextResponse("User not found", { status: 403 });
    }

    const userData = userDoc.data();
    if (userData?.role !== "superadmin") {
      return new NextResponse("Forbidden: Superadmin access required", {
        status: 403,
      });
    }

    // 2. Fetch Data
    const tenantsSnap = await db.collection("tenants").get();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // We can't do a simple db.collection("whatsappUsage").get() anymore because data is deep.
    // Efficient approach:
    // Option A: Collection Group Query for 'months' where ID == currentMonth
    // Option B: Iterate tenants and get their specific month doc (Parallelized)

    // Using Option B for predictability and since we already have tenants list.
    // (If tenants > 100, might want to chunk this)

    const usagePromises = tenantsSnap.docs.map(async (tenantDoc) => {
      const usageRef = db
        .collection("whatsappUsage")
        .doc(tenantDoc.id)
        .collection("months")
        .doc(currentMonth);
      const usageSnap = await usageRef.get();
      return {
        tenantId: tenantDoc.id,
        usage: usageSnap.exists ? usageSnap.data() : null,
      };
    });

    const usageResults = await Promise.all(usagePromises);
    const usageMap = new Map();
    usageResults.forEach((res) => {
      if (res.usage) {
        usageMap.set(res.tenantId, res.usage);
      }
    });

    const results = tenantsSnap.docs.map((doc) => {
      const tenant = doc.data();
      const usage = usageMap.get(doc.id);

      const monthlyLimit = tenant.whatsappMonthlyLimit || 2000;
      const totalMessages = usage?.totalMessages || 0;

      // New fields from subcollection
      const overageMessages = usage?.overageMessages || 0;

      // Calculate costs if not stored (or trust stored)
      // Stored: includedCost, overageCost, estimatedCost
      const estimatedCost = usage?.estimatedCost || 0;
      const overageCost = usage?.overageCost || 0;

      // Recalculate if missing (legacy/migration safety)
      // const COST_PER_MSG = 0.35; // Don't hardcode if possible, or fetch from env/config
      // For now, trust DB or default to 0.

      // Calculate Percentage
      let usagePercentage = 0;
      if (monthlyLimit > 0) {
        usagePercentage = (totalMessages / monthlyLimit) * 100;
      }

      return {
        tenantId: doc.id,
        companyName: tenant.name || "Unknown",
        whatsappEnabled: tenant.whatsappEnabled === true,
        whatsappAllowOverage: tenant.whatsappAllowOverage === true,
        whatsappPlan: tenant.whatsappPlan || "none",
        monthlyLimit: monthlyLimit,
        totalMessages: totalMessages,
        overageMessages: overageMessages,
        estimatedCost: parseFloat(estimatedCost.toFixed(2)),
        overageCost: parseFloat(overageCost.toFixed(2)),
        usagePercentage: parseFloat(usagePercentage.toFixed(2)),
      };
    });

    // Sort by Overage Cost descending (prioritize high revenue/problematic), then Usage %
    results.sort((a, b) => {
      if (b.overageCost !== a.overageCost) {
        return b.overageCost - a.overageCost;
      }
      return b.usagePercentage - a.usagePercentage;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in admin whatsapp-usage:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
