import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_MAX_REQUESTS = 45;
const ADMIN_RATE_LIMIT_STATE = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();

  if (ADMIN_RATE_LIMIT_STATE.size > 10_000) {
    ADMIN_RATE_LIMIT_STATE.forEach((entry, entryKey) => {
      if (now - entry.windowStart > ADMIN_RATE_LIMIT_WINDOW_MS * 2) {
        ADMIN_RATE_LIMIT_STATE.delete(entryKey);
      }
    });
  }

  const current = ADMIN_RATE_LIMIT_STATE.get(key);
  if (!current || now - current.windowStart >= ADMIN_RATE_LIMIT_WINDOW_MS) {
    ADMIN_RATE_LIMIT_STATE.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  current.count += 1;
  ADMIN_RATE_LIMIT_STATE.set(key, current);
  if (current.count <= ADMIN_RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: true };
  }

  const retryAfterSeconds = Math.ceil(
    (ADMIN_RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000,
  );
  return {
    allowed: false,
    retryAfterSeconds: Math.max(retryAfterSeconds, 1),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error("REQUEST_TIMEOUT"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const adminAuth = getAdminAuth();
    const db = getAdminFirestore();

    const decodedToken = await adminAuth.verifyIdToken(token, true);
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    const role = String(
      userRecord.customClaims?.role || decodedToken.role || "",
    ).toLowerCase().trim();

    if (role !== "superadmin") {
      return new NextResponse("Forbidden: Superadmin access required", {
        status: 403,
      });
    }

    const rateLimitKey = `${getClientIp(req)}:${decodedToken.uid}`;
    const rateLimitResult = checkRateLimit(rateLimitKey);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      if (rateLimitResult.retryAfterSeconds) {
        response.headers.set(
          "Retry-After",
          String(rateLimitResult.retryAfterSeconds),
        );
      }
      return response;
    }

    const timeoutMs = Number(process.env.ADMIN_ROUTE_TIMEOUT_MS || 15_000);
    const tenantsSnap = await withTimeout(db.collection("tenants").get(), timeoutMs);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

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

    const usageResults = await withTimeout(Promise.all(usagePromises), timeoutMs);
    const usageMap = new Map();
    usageResults.forEach((usageResult) => {
      if (usageResult.usage) {
        usageMap.set(usageResult.tenantId, usageResult.usage);
      }
    });

    const results = tenantsSnap.docs.map((doc) => {
      const tenant = doc.data();
      const usage = usageMap.get(doc.id);

      const monthlyLimit = tenant.whatsappMonthlyLimit || 2000;
      const totalMessages = usage?.totalMessages || 0;

      const overageMessages = usage?.overageMessages || 0;

      const estimatedCost = usage?.estimatedCost || 0;
      const overageCost = usage?.overageCost || 0;

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
        monthlyLimit,
        totalMessages,
        overageMessages,
        estimatedCost: parseFloat(estimatedCost.toFixed(2)),
        overageCost: parseFloat(overageCost.toFixed(2)),
        usagePercentage: parseFloat(usagePercentage.toFixed(2)),
      };
    });

    results.sort((a, b) => {
      if (b.overageCost !== a.overageCost) {
        return b.overageCost - a.overageCost;
      }
      return b.usagePercentage - a.usagePercentage;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in admin whatsapp-usage:", error);
    if (error instanceof Error && error.message === "REQUEST_TIMEOUT") {
      return new NextResponse("Request timeout", { status: 408 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
