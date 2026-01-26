import { Request, Response, NextFunction } from "express";
import { auth, db } from "../../init";

// Extend Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        email_verified?: boolean;
        tenantId?: string;
        role?: string;
        masterId?: string;
        stripeId?: string;
        [key: string]: unknown;
      };
    }
  }
}

export const validateFirebaseIdToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // console.log("Check if request is authorized with Firebase ID token");

  if (req.method === "OPTIONS") {
    return next();
  }

  // Permitir acesso público às rotas de compartilhamento
  if (req.path.startsWith("/v1/share/") || req.path.startsWith("/share/")) {
    return next();
  }

  if (
    (!req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer ")) &&
    !(req.cookies && req.cookies.__session)
  ) {
    // console.error("No Firebase ID token passed.");
    res.status(403).send("Unauthorized");
    return;
  }

  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else if (req.cookies) {
    idToken = req.cookies.__session;
  } else {
    res.status(403).send("Unauthorized");
    return;
  }

  try {
    const decodedIdToken = await auth.verifyIdToken(idToken);
    // console.log("ID Token correctly decoded", decodedIdToken.uid);
    req.user = decodedIdToken;

    // --- SELF-HEALING CUSTOM CLAIMS LOGIC ---
    // If tenantId is not in the token (legacy user or first login), fetch and set it.
    if (!decodedIdToken.tenantId || !decodedIdToken.role) {
      console.log(
        `[AUTH] Missing claims for ${decodedIdToken.uid}. Fetching from DB...`,
      );
      try {
        const userDoc = await db
          .collection("users")
          .doc(decodedIdToken.uid)
          .get();
        if (userDoc.exists) {
          const userData = userDoc.data()!;
          const tenantId = userData.tenantId || userData.companyId; // Handle legacy companyId
          const role = userData.role;

          const masterId = userData.masterId || null;
          const stripeId = userData.stripeId || null;

          if (tenantId && role) {
            // Set Custom Claims for NEXT time
            await auth.setCustomUserClaims(decodedIdToken.uid, {
              tenantId,
              role,
              masterId,
              stripeId,
            });
            console.log(
              `[AUTH] Claims updated for ${decodedIdToken.uid}: ${tenantId}`,
            );

            // Update current request object immediately
            if (req.user) {
              req.user.tenantId = tenantId;
              req.user.role = role;
              req.user.masterId = masterId || undefined;
              req.user.stripeId = stripeId || undefined;
            }
          } else {
            console.warn(
              `[AUTH] User ${decodedIdToken.uid} has incomplete profile (no tenantId/role).`,
            );
          }
        }
      } catch (dbError) {
        console.error(
          `[AUTH] Failed to fetch user profile for claims:`,
          dbError,
        );
        // Continue without claims, Controller might fail or fetch again, but don't block auth if valid token
      }
    }
    // ----------------------------------------

    next();
    return;
  } catch (error) {
    console.error("Error while verifying Firebase ID token:", error);
    res.status(403).send("Unauthorized");
    return;
  }
};
